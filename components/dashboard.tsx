"use client";
import { useState } from "react";
import {
  Users,
  Shield,
  Send,
  Inbox,
  Trophy,
  Target,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { dashboardMetrics, type Metric } from "@/lib/provenance";
import { nextActions, day, stages } from "@/lib/intelligence";
import { Hint, EmptyState, type Navigate } from "./shared";
import { ContactTable } from "./contacts";
import { GettingStarted } from "./getting-started";
import { SetupPanel } from "./setup-panel";
import { linkedInActions } from "@/lib/linkedin";
import { researchActions } from "@/lib/research";
export function Dashboard({
  navigate,
  onOpen,
  onCompose,
}: {
  navigate: Navigate;
  onOpen: (id: string) => void;
  onCompose: (id: string, p?: string) => void;
}) {
  const { db, mode, ready } = useStore();
  const [selected, setSelected] = useState<Metric | null>(null);
  const metrics = dashboardMetrics(db, mode);
  const icons = [Users, Shield, Send, Inbox, Users, Trophy];
  const linkedin = linkedInActions(db);
  const actions = [...nextActions(db).filter(a => !linkedin.some(l => l.contactId === a.contactId)), ...linkedin].sort((a,b) => b.priority-a.priority);
  const empty =
    !db.contacts.length &&
    !db.messages.length &&
    !db.conversations.length &&
    !db.opportunities.length;
  const details = (
    label: string,
    explanation: string,
    route: string,
    records: Metric["records"],
  ) => setSelected({ label, explanation, route, records });
  return (
    <>
      <SetupPanel navigate={navigate}/>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-label">YOUR NEXT CHAPTER</span>
          <h2>
            Turn your talent
            <br />
            into <em>opportunity.</em>
          </h2>
          <p>
            Build your network. Remember every conversation.
            <br />
            Your progress starts with your own records.
          </p>
          <button className="btn hero-btn" onClick={() => navigate("Contacts")}>
            Build your contact network <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-stat">
          <span>{mode === "demo" ? "DEMO DATA" : "YOUR WORKSPACE"}</span>
          <b>
            Beyond borders.
            <br />
            On the pitch.
          </b>
          <small>{db.player.nationality || "YOUR JOURNEY"} → THE WORLD</small>
        </div>
        <div className="pitch" aria-hidden="true">
          <div />
          <i />
          <b />
        </div>
      </section>
      <div className="metrics provenance-metrics">
        {metrics.map((m, i) => {
          const Icon = icons[i];
          return (
            <Hint
              key={m.label}
              text={
                m.explanation + " Click to inspect every contributing record."
              }
            >
              <button
                className="metric"
                onClick={() => setSelected(m)}
                disabled={!ready}
              >
                <div>
                  <span>{m.label}</span>
                  <Icon size={17} />
                </div>
                <strong>{ready ? m.records.length : "—"}</strong>
                <small>
                  {mode === "demo" ? "DEMO DATA · " : ""}View contributing
                  records
                </small>
              </button>
            </Hint>
          );
        })}
      </div>
      <p className="panel-sub">
        {mode === "demo"
          ? "DEMO DATA — sample records in an isolated workspace."
          : "Personal workspace — saved records only. Demo records are excluded."}{" "}
        Click any count to inspect its source. Saved outreach history remains counted after archiving; archived contacts do not contribute to active conversations.
      </p>
      {empty && <GettingStarted navigate={navigate} />}
      <button className="btn" onClick={() => details("Open opportunities", "Saved opportunities whose stage is not Closed.", "Opportunities", db.opportunities.filter(o => o.stage !== "Closed").map(o => ({ id: o.id, contactId: o.contactId, label: db.contacts.find(c => c.id === o.contactId)?.name || o.contactId, detail: o.stage + " · " + o.nextStep })))}>Opportunities: {db.opportunities.filter(o => o.stage !== "Closed").length} · View contributing records</button>
      <div className="dashboard-grid" style={{ marginTop: 22 }}>
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <Target size={18} />
              Next best actions
            </h3>
          </div>
          {actions.length ? (
            actions.slice(0, 4).map((a) => (
              <button
                className="action-row"
                key={a.contactId + a.route}
                onClick={() =>
                  a.route === "LinkedIn" ? navigate("LinkedIn", a.contactId) : a.route === "Inbox"
                    ? navigate("Inbox", a.contactId)
                    : onCompose(a.contactId, "Follow-up")
                }
              >
                <div>
                  <b>{a.title}</b>
                  <small>
                    {db.contacts.find((c) => c.id === a.contactId)?.name} ·{" "}
                    {a.reason}
                  </small>
                </div>
                <ArrowUpRight size={16} />
              </button>
            ))
          ) : (
            <EmptyState
              title="No pending actions"
              description="Saved replies and scheduled follow-ups will create actions here."
            />
          )}
          {researchActions(db).map(a=><button className="action-row" key={a.jobId} onClick={()=>navigate("Research","job:"+a.jobId)}><div><b>{a.title}</b><small>{a.reason}</small></div><ArrowUpRight size={16}/></button>)}
          {(db.outreachQueue||[]).filter(q=>db.contacts.some(c=>c.id===q.contactId&&!c.archived&&!['Closed','Dormant'].includes(c.status))&&!db.messages.some(m=>m.contactId===q.contactId&&m.status==='Sent')).map(q=>{const c=db.contacts.find(c=>c.id===q.contactId)!;return <button className="action-row" key={q.id} onClick={()=>onCompose(c.id,c.linkedin?'LinkedIn':c.email?'Email':'Instagram DM')}><div><b>Draft outreach to {c.name}</b><small>Manually queued from saved research · no sent message recorded</small></div><ArrowUpRight size={16}/></button>;})}
        </section>
        <section className="panel">
          <h3>
            <Clock3 size={18} />
            Today's action center
          </h3>
          {[
            {
              label: "Follow-ups due",
              route: "Follow-ups",
              explanation:
                "Scheduled follow-ups due today or earlier for non-archived contacts.",
              records: db.followUps
                .filter(
                  (f) =>
                    f.status === "Scheduled" &&
                    f.date <= day() &&
                    db.contacts.some(
                      (c) => c.id === f.contactId && !c.archived,
                    ),
                )
                .map((f) => ({
                  id: f.id,
                  label: db.contacts.find((c) => c.id === f.contactId)!.name,
                  detail: f.date,
                  contactId: f.contactId,
                })),
            },
            {
              label: "Unread conversations",
              route: "Inbox",
              explanation: "Saved conversations not yet marked read.",
              records: db.conversations
                .filter((v) => !v.read)
                .map((v) => ({
                  id: v.id,
                  label:
                    db.contacts.find((c) => c.id === v.contactId)?.name ||
                    v.contactId,
                  detail: v.analysis.responseType,
                  contactId: v.contactId,
                })),
            },
            {
              label: "Drafts to review",
              route: "Outreach",
              explanation: "Saved message records with Draft status.",
              records: db.messages
                .filter((m) => m.status === "Draft")
                .map((m) => ({
                  id: m.id,
                  label:
                    db.contacts.find((c) => c.id === m.contactId)?.name ||
                    m.contactId,
                  detail: m.body,
                  contactId: m.contactId,
                })),
            },
          ].map((m) => (
            <button
              className="today-row"
              key={m.label}
              onClick={() => setSelected(m)}
            >
              <span>{m.records.length}</span>
              <div>
                <b>{m.label}</b>
                <small>Inspect saved records</small>
              </div>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </section>
      </div>
      <section className="panel pipeline-panel">
        <div className="panel-heading">
          <h3>Your contact pipeline</h3>
          <span className="muted">Current saved status</span>
        </div>
        <div className="pipeline">
          {stages.map((s) => {
            const records = db.contacts
              .filter((c) => !c.archived && c.status === s)
              .map((c) => ({
                id: c.id,
                label: c.name,
                detail: c.role,
                contactId: c.id,
              }));
            return (
              <button
                key={s}
                title={"Saved non-archived contacts with status " + s}
                onClick={() =>
                  details(
                    s + " contacts",
                    "Saved non-archived contacts whose current status is " +
                      s +
                      ".",
                    "Contacts",
                    records,
                  )
                }
              >
                <span>{s}</span>
                <b>{records.length}</b>
              </button>
            );
          })}
        </div>
      </section>
      {!empty && (
        <div className="dashboard-lower">
          <ContactTable compact onOpen={onOpen} onCompose={onCompose} />
        </div>
      )}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.label}: {selected?.records.length}
            </DialogTitle>
            <DialogDescription>
              {selected?.explanation}{" "}
              {mode === "demo"
                ? "DEMO DATA — not your personal history."
                : "Source: persisted personal workspace."}
            </DialogDescription>
          </DialogHeader>
          <div className="metric-records">
            {selected?.records.map((r) => (
              <button
                className="draft-item"
                key={r.id}
                onClick={() => {
                  setSelected(null);
                  if (r.contactId) onOpen(r.contactId);
                  else navigate(selected.route);
                }}
              >
                <b>{r.label}</b>
                <small>{r.detail}</small>
                <small>Record ID: {r.id}</small>
              </button>
            ))}
            {!selected?.records.length && (
              <EmptyState
                title="No contributing records"
                description="This metric stays at zero until matching real records are saved."
              />
            )}
          </div>
          <button
            className="btn"
            onClick={() => {
              if (selected) navigate(selected.route);
              setSelected(null);
            }}
          >
            Open related workspace
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
