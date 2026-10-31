"use client";
import { SourceInfo } from "./source-info";
import { orderMessages } from "@/lib/message-history";
import { useState } from "react";
import { ArrowUpRight, Sparkles, Plus, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { Choice, Status, EmptyState, initials, dateLabel } from "./shared";
export function InboxView({
  initialId,
  onCompose,
}: {
  initialId?: string;
  onCompose: (id: string) => void;
}) {
  const { db, mutate, receiveReply } = useStore();
  const [category, setCategory] = useState("All");
  const [id, setId] = useState(initialId || db.conversations[0]?.contactId);
  const [add, setAdd] = useState(false);
  const [reply, setReply] = useState("");
  const [replyId, setReplyId] = useState(id || db.contacts[0]?.id || "");
  if (!db.contacts.length)
    return (
      <EmptyState
        title="No conversations yet"
        description="Use Import Outreach above to paste a conversation or email thread. You can also add a contact and log a reply manually. Gmail is not connected."
      />
    );
  const convs = db.conversations.filter(
    (v) =>
      category === "All" ||
      (category === "Positive" && v.analysis.sentiment === "Positive") ||
      (category === "Follow-up Needed" &&
        !!db.contacts.find((c) => c.id === v.contactId)?.nextFollowUp) ||
      (category === "Closed" && v.analysis.responseType === "No opening") ||
      v.analysis.responseType === category,
  );
  const conv = db.conversations.find((v) => v.contactId === id);
  const c = db.contacts.find((c) => c.id === id);
  const messages = orderMessages(db.messages.filter((m) => m.contactId === id && m.status !== "Draft"));
  return (
    <>
      <div className="view-toolbar">
        <div className="filter-pills">
          {[
            "All",
            "Positive",
            "Interested",
            "Waiting",
            "Follow-up Needed",
            "Trial Discussion",
            "Closed",
          ].map((t) => (
            <button
              className={category === t ? "active" : ""}
              key={t}
              onClick={() => setCategory(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => setAdd(true)}>
          <Plus size={15} />
          Log reply
        </button>
      </div>
      <div className="inbox-layout">
        <section className="conversation-list">
          {convs.map((v) => {
            const person = db.contacts.find((c) => c.id === v.contactId)!;
            const last = db.messages
              .filter(
                (m) => m.contactId === v.contactId && m.direction === "in",
              )
              .at(-1);
            return (
              <button
                key={v.id}
                className={
                  "conversation-item " + (id === v.contactId ? "active" : "")
                }
                onClick={() => {
                  setId(v.contactId);
                  mutate("Conversation read", (d) => {
                    d.conversations.find((x) => x.id === v.id)!.read = true;
                  });
                }}
              >
                <div className="row-between">
                  <span className="avatar">{initials(person.name)}</span>
                  <small>{dateLabel(last?.date || null)}</small>
                  {!v.read && <span className="live-dot" />}
                </div>
                <b>{person.name}</b>
                <small>
                  {db.clubs.find((x) => x.id === person.clubId)?.name}
                </small>
                <p>{last?.body}</p>
                <Status value={v.analysis.responseType} />
              </button>
            );
          })}
          {!convs.length && (
            <EmptyState
              title="No conversations here"
              description="Choose another category."
            />
          )}
        </section>
        {c && conv ? (
          <section className="conversation-detail">
            <div className="conversation-header">
              <div>
                <h3>{c.name}</h3>
                <small>
                  {c.role} · {db.clubs.find((x) => x.id === c.clubId)?.name}
                </small>
              </div>
              <Status value={conv.analysis.responseType} />
            </div>
            <div className="messages">
              <SourceInfo record={conv}/>
              {messages.map((m) => (
                <div className={"message " + m.direction} key={m.id}>
                  <small>
                    {m.direction === "out" ? "You" : c.name} · {m.platform} ·{" "}
                    {m.dateUnknown ? "Date unknown" : dateLabel(m.date)}
                  </small>
                  <p>{m.body}</p>
                  {m.subject && <small>Subject: {m.subject}</small>}
                  <SourceInfo record={m}/>
                </div>
              ))}
            </div>
            <div className="analysis-card">
              <h3>
                <Sparkles size={17} />
                Reply intelligence{" "}
                <span className="badge">Rule-based analysis</span>
              </h3>
              <div className="detail-grid">
                <div>
                  <small>Sentiment</small>
                  <Status value={conv.analysis.sentiment} />
                </div>
                <div>
                  <small>Intent</small>
                  {conv.analysis.responseType}
                </div>
                <div>
                  <small>Requested items</small>
                  {conv.analysis.requestedItems.join(", ") || "None"}
                </div>
                <div>
                  <small>Availability requested</small>
                  {conv.analysis.availabilityRequested ? "Yes" : "No"}
                </div>
                {conv.analysis.location && (
                  <div>
                    <small>Location</small>
                    {conv.analysis.location}
                  </div>
                )}
                {conv.analysis.deadlineMentioned && (
                  <div>
                    <small>Deadline mentioned</small>
                    {conv.analysis.deadlineMentioned}
                  </div>
                )}
                {conv.analysis.personReferredTo && (
                  <div>
                    <small>Referred to</small>
                    {conv.analysis.personReferredTo}
                  </div>
                )}
                {conv.analysis.followUpDate && (
                  <div>
                    <small>Reconnect on</small>
                    {conv.analysis.followUpDate}
                  </div>
                )}
              </div>
              <p className="next-step">{conv.analysis.nextAction}</p>
              <button className="btn primary" onClick={() => onCompose(c.id)}>
                Draft reply <ArrowUpRight size={15} />
              </button>
            </div>
          </section>
        ) : (
          <EmptyState
            title="Select a conversation"
            description="Read the reply and decide your next move."
          />
        )}
      </div>
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log an incoming reply</DialogTitle>
            <DialogDescription>
              Paste a reply you received. Analysis updates the relationship,
              opportunity and follow-up plan automatically.
            </DialogDescription>
          </DialogHeader>
          <Choice
            label="Reply contact"
            value={db.contacts.find((c) => c.id === replyId)!.name}
            options={db.contacts.map((c) => c.name)}
            onChange={(name) =>
              setReplyId(db.contacts.find((c) => c.name === name)!.id)
            }
          />
          <textarea
            aria-label="Incoming reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Paste the actual reply…"
          />
          <button
            className="btn primary"
            disabled={!reply.trim()}
            onClick={async () => {
              if (!await receiveReply(replyId, reply)) return;
              setId(replyId);
              setReply("");
              setAdd(false);
            }}
          >
            Save & analyze reply
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
