"use client";
import { profileContext } from "@/lib/player-profile";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Copy,
  Save,
  Check,
  Send,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import {
  generateOutreach,
  outreachWarning,
  analyzeReply,
} from "@/lib/intelligence";
import { Choice, Status, dateLabel } from "./shared";
import type { Platform } from "@/types";
import { toast } from "sonner";
export function Outreach({
  initialId,
  initialPlatform = "Email",
  onLinkedIn,
}: {
  initialId?: string;
  initialPlatform?: string;
  onLinkedIn: (id: string) => void;
}) {
  const { db, mutate, recordSent } = useStore();
  const [id, setId] = useState(initialId || db.contacts[0]?.id || "");
  const [platform, setPlatform] = useState<Platform>(
    initialPlatform as Platform,
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [review, setReview] = useState(false);
  const [approved, setApproved] = useState(false);
  const [drafts, setDrafts] = useState(false);
  const c = db.contacts.find((c) => c.id === id)!;
  useEffect(() => {setBody(db.messages.find(m=>m.contactId===id&&m.platform===platform&&m.status==="Draft")?.body||"");setApproved(false);},[id,platform]);
  if (!c)
    return (
      <section className="panel">
        <h3>No contacts to message yet</h3>
        <p className="muted">
          Add a real club and contact before creating outreach.
        </p>
      </section>
    );
  const club = db.clubs.find((x) => x.id === c.clubId)!;
  const history = db.messages.filter(
    (m) => m.contactId === id && m.status !== "Draft",
  );
  const warning = outreachWarning(c, db);
  async function generate(style = "") {
    if (warning) {
      toast.error(warning);
      return;
    }
    if (style === "Add Achievements" && !profileContext(db.player).achievements) {
      toast.info("Add your real achievements in Player Profile first.");
      return;
    }
    setBusy("Analyzing relationship history…");
    await new Promise((r) => setTimeout(r, 650));
    setBusy("Personalizing your message…");
    await new Promise((r) => setTimeout(r, 650));
    const text = generateOutreach(c, db, platform, style);
    setBody(text);
    setBusy("");
    setApproved(false);
    mutate("Message generated · " + platform, (d) => {}, id);
  }
  return (
    <div className="outreach-layout">
      <section className="panel composer">
        <div className="panel-heading">
          <h3>Make your first touch count.</h3>
          <Status value="Draft workspace" />
        </div>
        <p className="panel-sub">
          Your voice. Their context. A clear next step.
        </p>
        <Tabs
          value={platform}
          onValueChange={(v) => {
            if (v === "LinkedIn") { onLinkedIn(id); return; }
            setPlatform(v as Platform);
            setBody("");
            setApproved(false);
          }}
        >
          <TabsList>
            {["Email", "Instagram DM", "LinkedIn", "Follow-up"].map((p) => (
              <TabsTrigger value={p} key={p}>
                {p}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="composer-recipient">
          <small>TO</small>
          <Choice
            label="Outreach recipient"
            value={c.name}
            onChange={(v) => {
              setId(db.contacts.find((x) => x.name === v)!.id);
              setBody("");
              setApproved(false);
            }}
            options={db.contacts.filter((c) => !c.archived).map((c) => c.name)}
          />
          <span>{club.name}</span>
        </div>
        {warning && <p className="notice amber">{warning}</p>}
        <div className="composer-subject">
          <small>SUBJECT</small>
          <span>
            {history.length
              ? "Following up — player opportunity"
              : (db.player.position || "Player") + " · Player evaluation at " + club.name}
          </span>
        </div>
        {busy ? (
          <div className="generation-loading">
            <Sparkles className="animate-pulse" />
            <p>{busy}</p>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : (
          <textarea
            className="message-editor"
            aria-label="Message body"
            placeholder="Choose a contact and generate a personalized draft, or write your own message here…"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setApproved(false);
            }}
          />
        )}
        <div className="composer-toolbar">
          <span>{body.length} characters</span>
          <span>Simulated generation · Human review required</span>
        </div>
        <div className="style-controls">
          {[
            "Shorter",
            "More Confident",
            "More Casual",
            "More Professional",
            "Add Achievements",
            "Mention Highlights",
            "Mention Trial Availability",
          ].map((s) => (
            <button
              key={s}
              disabled={!!busy || !!warning}
              onClick={() => generate(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="button-row composer-actions">
          <button
            className="btn primary"
            disabled={!!busy || !!warning}
            onClick={() => generate()}
          >
            <Sparkles size={15} />
            {body ? "Regenerate" : "Generate message"}
          </button>
          <button
            className="btn"
            disabled={!body || !!busy}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(body);
                toast.success("Message copied");
              } catch {
                toast.error(
                  "Clipboard unavailable. Select and copy the message manually.",
                );
              }
            }}
          >
            <Copy size={15} />
            Copy
          </button>
          <button
            className="btn"
            disabled={!body || !!busy}
            onClick={async () => {
              if (!await mutate(
                "Draft saved",
                (d) => {
                  const draft = d.messages.find(
                    (m) =>
                      m.contactId === id &&
                      m.platform === platform &&
                      m.status === "Draft",
                  );
                  if (draft) {
                    draft.body = body;
                    draft.date = new Date().toISOString();
                  } else
                    d.messages.push({
                      id: crypto.randomUUID(),
                      contactId: id,
                      platform,
                      body,
                      direction: "out",
                      date: new Date().toISOString(),
                      status: "Draft",
                      followUp: history.length > 0,
                    });
                },
                id,
              )) return;
              toast.success("Draft saved");
            }}
          >
            <Save size={15} />
            Save draft
          </button>
          <button
            className="btn"
            disabled={!body || !!busy || !!warning}
            onClick={() => setReview(true)}
          >
            <Check size={15} />
            Review & mark sent
          </button>
        </div>
        <p className="notice">
          No messages are sent by this demo. Copy your reviewed message, send it
          manually, then record it here.
        </p>
      </section>
      <aside className="stack">
        <section className="panel">
          <h3>
            <ShieldCheck size={17} />
            Relationship context
          </h3>
          <div className="detail-line">
            <span>Previous messages</span>
            <b>{history.filter((m) => m.direction === "out").length}</b>
          </div>
          <div className="detail-line">
            <span>Last contacted</span>
            <b>{dateLabel(c.lastContacted)}</b>
          </div>
          <div className="detail-line">
            <span>Follow-up</span>
            <b>{dateLabel(c.nextFollowUp)}</b>
          </div>
          <p className="muted">
            {history.some((m) => m.direction === "in")
              ? "This person has replied. Your draft responds to the conversation."
              : history.length
                ? "This person already knows your introduction. Your draft continues the relationship."
                : "First conversation. Lead with your player profile and a relevant ask."}
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>Saved drafts</h3>
            <span className="count-label">
              {db.messages.filter((m) => m.status === "Draft").length}
            </span>
          </div>
          {db.messages
            .filter((m) => m.status === "Draft")
            .map((m) => (
              <button
                className="draft-item"
                key={m.id}
                onClick={() => {
                  setId(m.contactId);
                  setPlatform(m.platform);
                  setBody(m.body);
                }}
              >
                <b>{db.contacts.find((c) => c.id === m.contactId)?.name}</b>
                <small>
                  {m.platform} · {dateLabel(m.date)}
                </small>
              </button>
            ))}
        </section>
      </aside>
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review before recording</DialogTitle>
            <DialogDescription>
              To {c.name} · {platform}. This records an action you performed
              yourself; it does not send a message.
            </DialogDescription>
          </DialogHeader>
          <div className="review-message">{body}</div>
          <label className="check-row">
            <Checkbox
              checked={approved}
              onCheckedChange={(v) => setApproved(v === true)}
            />
            I reviewed this message and sent it manually.
          </label>
          <button
            className="btn primary"
            disabled={!approved || !!warning}
            onClick={async () => {
              if (await recordSent(id, body, platform)) {
                setReview(false);
                setBody("");
                setApproved(false);
                toast.success("Message recorded and follow-up plan updated");
              }
            }}
          >
            Mark as sent
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
