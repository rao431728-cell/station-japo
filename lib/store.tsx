"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { Database, Contact, Message, Platform } from "@/types";
import { createEmpty } from "@/data/empty";
import {
  localRepository,
  loadDemoData,
  PERSONAL_KEY,
  DEMO_KEY,
} from "./repository";
import { personalRecords, type WorkspaceMode } from "./provenance";
import { loadWorkspace, saveWorkspace } from "./cloud-repository";
import {
  analyzeReply,
  day,
  duplicateOf,
  outreachWarning,
} from "./intelligence";
type Mutate = (
  action: string,
  fn: (d: Database) => void,
  contactId?: string,
) => Promise<boolean>;
const Ctx = createContext<{
  db: Database;
  ready: boolean;
  error: string;
  mutate: Mutate;
  save: Mutate;
  saving: boolean;
  refresh: () => Promise<void>;
  addContact: (c: Contact) => Promise<string>;
  recordSent: (id: string, body: string, platform: Platform) => Promise<boolean>;
  receiveReply: (id: string, body: string) => Promise<boolean>;
  mode: WorkspaceMode;
  changeMode: (mode: WorkspaceMode) => void;
}>(null!);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState(createEmpty);
  const [mode, setMode] = useState<WorkspaceMode>("personal");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = useRef(db);
  const revision = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await loadWorkspace();
        let data = saved.db;
        let rev = saved.revision;
        if (!data) {
          // One-time migration; the old browser data remains a recoverable backup.
          data = { ...personalRecords(localRepository.load()), workspaceMode: "personal" as const };
          try { rev = await saveWorkspace(data, 0); }
          catch (e) { const concurrent = await loadWorkspace(); if (!concurrent.db) throw e; data = concurrent.db; rev = concurrent.revision; }
        }
        if (active) { current.current = data; revision.current = rev; setDb(data); setReady(true); }
      } catch (e) { if (active) setError((e as Error).message); }
    })();
    return () => { active = false; };
  }, []);
  const mutate: Mutate = useCallback(
    async (action, fn, contactId) => {
      if (!ready || busy.current) {
        toast.error("Wait for the current save to finish, then try again.");
        return false;
      }
      busy.current = true;
      setSaving(true);
      try {
        const next = structuredClone(current.current);
        fn(next);
        const collections = ["clubs", "contacts", "messages", "conversations", "opportunities", "followUps", "research", "assets"] as const;
        for (const key of collections) {
          const oldIds = new Set(current.current[key].map(r => r.id));
          for (const record of next[key]) if (!record.provenance?.length && !oldIds.has(record.id)) record.provenance = [{ source: "Manually Added", recordedAt: new Date().toISOString(), detail: action }];
        }
        next.audit.unshift({
          id: crypto.randomUUID(),
          action,
          date: new Date().toISOString(),
          contactId,
        });
        if (mode === "demo") localRepository.save(next, mode);
        else revision.current = await saveWorkspace(next, revision.current);
        current.current = next;
        setDb(next);
        setError("");
        return true;
      } catch (e) {
        toast.error((e as Error).message || "Could not save changes. Your existing data is unchanged.");
        setError((e as Error).message);
        return false;
      } finally {
        busy.current = false;
        setSaving(false);
      }
    },
    [ready, mode],
  );
  const changeMode = async (next: WorkspaceMode) => {
    if (busy.current) { toast.info("Wait for saving to finish."); return; }
    try {
      let data: Database;
      if (next === "demo") data = { ...loadDemoData(), workspaceMode: "demo" };
      else { const cloud = await loadWorkspace(); if (!cloud.db) throw new Error("Personal workspace unavailable"); data = cloud.db; revision.current = cloud.revision; }
      current.current = data;
      setDb(data);
      setMode(next);
      setError("");
    } catch (e) {
      setError(String(e));
      toast.error("Could not open workspace. Your data is unchanged.");
    }
  };
  const refresh = async () => {
    if (busy.current) return;
    try {
      if (mode === "demo") current.current = { ...loadDemoData(), workspaceMode: "demo" };
      else { const latest = await loadWorkspace(); if (!latest.db) throw new Error("Workspace not initialized. Reload this page to retry."); current.current = latest.db; revision.current = latest.revision; }
      setDb(current.current); setReady(true); setError("");
      toast.info("Latest saved data loaded. Review your open form, then retry saving.");
    } catch(e) { setError((e as Error).message); }
  };
  const addContact = async (c: Contact) => {
    c = { ...c, demo: mode === "demo" };
    let id = c.id;
    const ok = await mutate(
      "Contact added or sources merged",
      (d) => {
        const dupe = duplicateOf(c, d.contacts);
        if (dupe) {
          id = dupe.id;
          dupe.sources = [...new Set([...dupe.sources, ...c.sources])];
        } else d.contacts.push(c);
      },
      c.id,
    );
    return ok ? id : "";
  };
  const recordSent = async (id: string, body: string, platform: Platform) => {
    const c = db.contacts.find((c) => c.id === id)!;
    const warning = outreachWarning(c, db);
    if (warning) {
      toast.error(warning);
      return false;
    }
    if (!body.trim()) {
      toast.error("Write a message first.");
      return false;
    }
    return mutate(
      "Message manually marked as sent",
      (d) => {
        const contact = d.contacts.find((c) => c.id === id)!;
        const prior = d.messages.filter(
          (m) => m.contactId === id && m.status === "Sent",
        );
        const replied = d.messages.some(
          (m) => m.contactId === id && m.direction === "in",
        );
        const followUp = prior.length > 0 && !replied;
        d.messages = d.messages.filter(
          (m) =>
            !(
              m.contactId === id &&
              m.platform === platform &&
              m.status === "Draft"
            ),
        );
        d.messages.push({
          id: crypto.randomUUID(),
          contactId: id,
          body,
          platform,
          direction: "out",
          status: "Sent",
          date: new Date().toISOString(),
          followUp,
        });
        contact.lastContacted = new Date().toISOString();
        d.followUps
          .filter((f) => f.contactId === id && f.status === "Scheduled")
          .forEach((f) => (f.status = "Completed"));
        const followCount =
          prior.filter((m) => m.followUp).length + (followUp ? 1 : 0);
        if (!replied && followCount >= 2) {
          contact.status = "Dormant";
          contact.nextFollowUp = null;
        } else if (!replied) {
          contact.status = "Contacted";
          const due = day(followUp ? 7 : 5);
          contact.nextFollowUp = due;
          d.followUps.push({
            id: crypto.randomUUID(),
            contactId: id,
            date: due,
            status: "Scheduled",
            sequence: followCount + 1,
          });
        } else {
          const requested = d.conversations.find((v) => v.contactId === id)
            ?.analysis.followUpDate;
          contact.nextFollowUp =
            requested && requested > day() ? requested : null;
          if (contact.nextFollowUp)
            d.followUps.push({
              id: crypto.randomUUID(),
              contactId: id,
              date: contact.nextFollowUp,
              status: "Scheduled",
              sequence: 1,
            });
        }
      },
      id,
    );
  };
  const receiveReply = async (id: string, body: string) => {
    if (!body.trim()) return false;
    return mutate(
      "Reply received and analyzed",
      (d) => {
        const analysis = analyzeReply(body);
        d.messages.push({
          id: crypto.randomUUID(),
          contactId: id,
          body,
          platform: "Email",
          direction: "in",
          status: "Received",
          date: new Date().toISOString(),
          followUp: false,
        });
        const conv = d.conversations.find((c) => c.contactId === id);
        if (conv) {
          conv.analysis = analysis;
          conv.read = false;
        } else
          d.conversations.push({
            id: crypto.randomUUID(),
            contactId: id,
            analysis,
            read: false,
          });
        const c = d.contacts.find((c) => c.id === id)!;
        c.status = analysis.trialMentioned
          ? "Trial"
          : analysis.sentiment === "Positive"
            ? "Interested"
            : analysis.sentiment === "Negative"
              ? "Closed"
              : "Replied";
        c.nextFollowUp = analysis.followUpDate;
        if (analysis.sentiment === "Negative")
          d.opportunities
            .filter((o) => o.contactId === id)
            .forEach((o) => {
              o.stage = "Closed";
              o.nextStep = analysis.nextAction;
            });
        d.followUps
          .filter((f) => f.contactId === id && f.status === "Scheduled")
          .forEach((f) => (f.status = "Skipped"));
        if (analysis.followUpDate)
          d.followUps.push({
            id: crypto.randomUUID(),
            contactId: id,
            date: analysis.followUpDate,
            status: "Scheduled",
            sequence: 1,
          });
        if (analysis.sentiment === "Positive") {
          const stage = analysis.trialMentioned
            ? "Trial Discussion"
            : analysis.requestedItems.some((x) => /match|Highlights/.test(x))
              ? "Footage Review"
              : "Profile Review";
          const opp = d.opportunities.find((o) => o.contactId === id);
          if (opp) {
            opp.stage = stage;
            opp.nextStep = analysis.nextAction;
          } else
            d.opportunities.push({
              id: crypto.randomUUID(),
              contactId: id,
              type: analysis.trialMentioned ? "Trial" : "Recruitment Review",
              stage,
              nextStep: analysis.nextAction,
              createdAt: new Date().toISOString(),
            });
        }
        d.notifications.unshift({
          id: crypto.randomUUID(),
          text: "New reply from " + c.name,
          read: false,
          route: "Inbox",
        });
      },
      id,
    );
  };
  return (
    <Ctx.Provider
      value={{
        db: {
          ...(mode === "personal" ? personalRecords(db) : db),
          workspaceMode: mode,
        },
        ready,
        error,
        mutate,
        save: mutate,
        saving,
        refresh,
        addContact,
        recordSent,
        receiveReply,
        mode,
        changeMode,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export const useStore = () => useContext(Ctx);
