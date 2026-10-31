"use client";
import { SourceInfo } from "./source-info";
import { profileContext } from "@/lib/player-profile";
import { useState } from "react";
import { Clock3, Trophy, ArrowUpRight, Shield, Globe2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { day } from "@/lib/intelligence";
import { Choice, Status, EmptyState, dateLabel, type Navigate } from "./shared";
import { toast } from "sonner";
import { AddClubButton } from "./getting-started";
export function FollowUps({
  onCompose,
  onOpen,
}: {
  onCompose: (id: string, p?: string) => void;
  onOpen: (id: string) => void;
}) {
  const { db, mutate } = useStore();
  const [filter, setFilter] = useState("Scheduled");
  const rows = db.followUps.filter(
    (f) =>
      f.status === filter &&
      db.contacts.some((c) => c.id === f.contactId && !c.archived),
  );
  return (
    <>
      <div className="banner">
        <Clock3 size={24} />
        <div>
          <h3>Thoughtful persistence. Better conversations.</h3>
          <p>
            First follow-up after 5 days. Final follow-up 7 days later. Two
            unanswered follow-ups move the contact to Dormant.
          </p>
        </div>
      </div>
      <div className="view-toolbar">
        <Choice
          label="Follow-up status"
          value={filter}
          onChange={setFilter}
          options={["Scheduled", "Completed", "Skipped"]}
        />
        <span className="muted">{rows.length} follow-ups</span>
      </div>
      <section className="panel">
        {rows.map((f) => {
          const c = db.contacts.find((c) => c.id === f.contactId)!;
          const msg = db.messages
            .filter((m) => m.contactId === c.id && m.status === "Sent")
            .at(-1);
          return (
            <div className="follow-row" key={f.id}>
              <div className="date-block">
                <b>{new Date(f.date).getDate()}</b>
                <small>
                  {new Date(f.date).toLocaleString("en", { month: "short" })}
                </small>
              </div>
              <div className="follow-content">
                <button onClick={() => onOpen(c.id)}>
                  <h3>{c.name}</h3>
                </button>
                <small>
                  {db.clubs.find((x) => x.id === c.clubId)?.name} · {c.role}
                </small>
                <p>{msg?.body}</p>
                <SourceInfo record={f}/>
                <small>
                  Last sent {dateLabel(c.lastContacted)} ·{" "}
                  {c.lastContacted
                    ? Math.floor(
                        (Date.now() - new Date(c.lastContacted).getTime()) /
                          86400000,
                      )
                    : 0}{" "}
                  days ago · Follow-up {f.sequence} of 2
                </small>
              </div>
              <Status
                value={
                  f.date < day()
                    ? "Overdue"
                    : f.date === day()
                      ? "Due today"
                      : dateLabel(f.date)
                }
              />
              {filter === "Scheduled" && (
                <div className="button-row">
                  <button
                    className="btn primary"
                    onClick={() => onCompose(c.id, "Follow-up")}
                  >
                    Prepare today
                  </button>
                  <button
                    className="btn"
                    onClick={async () => {
                      if (!await mutate(
                        "Follow-up snoozed 3 days",
                        (d) => {
                          d.followUps.find((x) => x.id === f.id)!.date = day(3);
                          d.contacts.find((x) => x.id === c.id)!.nextFollowUp =
                            day(3);
                        },
                        c.id,
                      )) return;
                      toast.success("Snoozed for 3 days");
                    }}
                  >
                    Snooze
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      mutate(
                        "Follow-up skipped",
                        (d) => {
                          d.followUps.find((x) => x.id === f.id)!.status =
                            "Skipped";
                          d.contacts.find((x) => x.id === c.id)!.nextFollowUp =
                            null;
                        },
                        c.id,
                      );
                    }}
                  >
                    Skip
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      mutate(
                        "Contact closed",
                        (d) => {
                          d.contacts.find((x) => x.id === c.id)!.status =
                            "Closed";
                          d.contacts.find((x) => x.id === c.id)!.nextFollowUp =
                            null;
                          d.followUps
                            .filter(
                              (x) =>
                                x.contactId === c.id &&
                                x.status === "Scheduled",
                            )
                            .forEach((x) => (x.status = "Skipped"));
                        },
                        c.id,
                      )
                    }
                  >
                    Close contact
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!rows.length && (
          <EmptyState
            title="You're all caught up"
            description="Scheduled follow-ups will appear after you record outreach."
          />
        )}
      </section>
    </>
  );
}
export function Opportunities({
  onOpen,
  onCompose,
}: {
  onOpen: (id: string) => void;
  onCompose: (id: string) => void;
}) {
  const { db, mutate } = useStore();
  const options = [
    "Early Interest",
    "Profile Review",
    "Footage Review",
    "Coach Review",
    "Trial Discussion",
    "Trial Confirmed",
    "Training Invitation",
    "Closed",
  ];
  return (
    <>
      <div className="banner opportunity-banner">
        <Trophy size={29} />
        <div>
          <h3>Conversations with a next step.</h3>
          <p>
            Meaningful interest becomes an opportunity. Keep the momentum
            moving.
          </p>
        </div>
        <span className="large-number">
          {db.opportunities.filter((o) => o.stage !== "Closed").length}
        </span>
      </div>
      {!db.opportunities.length && (
        <EmptyState
          title="No opportunities yet"
          description="Log a real reply or conversation. Meaningful interest will create an opportunity."
        />
      )}
      <div className="opportunity-grid">
        {db.opportunities.map((o) => {
          const c = db.contacts.find((c) => c.id === o.contactId)!;
          const club = db.clubs.find((x) => x.id === c.clubId)!;
          return (
            <section className="panel opportunity-card" key={o.id}>
              <div className="row-between">
                <span className="club-mark">
                  <Shield size={25} />
                </span>
                <Status value={o.type} />
              </div>
              <h2>{club.name}</h2>
              <SourceInfo record={o}/>
              <details><summary>Fit with your saved profile</summary><p>{db.player.markets.includes(club.country) ? "In your preferred markets" : "Not listed in your preferred markets"}</p><p>{profileContext(db.player).availability || "Trial / travel availability not confirmed"}</p><p>{db.player.shortTermObjective || db.player.goals || "Career goal not provided"}</p><small>No eligibility or visa assessment has been performed.</small></details>
              <p className="muted">
                {club.country} · {club.league}
              </p>
              <button className="text-button" onClick={() => onOpen(c.id)}>
                {c.name} <ArrowUpRight size={13} />
              </button>
              <Choice
                label={"Opportunity stage for " + club.name}
                value={o.stage}
                options={options}
                onChange={(v) =>
                  mutate(
                    "Opportunity moved to " + v,
                    (d) => {
                      d.opportunities.find((x) => x.id === o.id)!.stage = v;
                    },
                    c.id,
                  )
                }
              />
              <div className="next-step">
                <small>NEXT STEP</small>
                {o.nextStep}
              </div>
              <button className="btn primary" onClick={() => onCompose(c.id)}>
                Continue conversation <ArrowUpRight size={15} />
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}
export function Clubs({ onOpen, initialAdd = false }: { onOpen: (id: string) => void; initialAdd?: boolean }) {
  const { db, mutate } = useStore();
  const [country, setCountry] = useState("All countries");
  const [active, setActive] = useState<string | null>(null);
  const [note, setNote] = useState("");
  return (
    <>
      <div className="view-toolbar">
        <Choice
          label="Club country"
          value={country}
          options={[
            "All countries",
            ...new Set(db.clubs.map((c) => c.country)),
          ]}
          onChange={setCountry}
        />
        <span className="muted">
          {db.clubs.length} saved club records · Includes clubs without contacts
        </span>
      </div>
      <AddClubButton first={!db.clubs.length} initialOpen={initialAdd} />
      {!db.clubs.length && (
        <EmptyState
          title="No clubs saved yet"
          description="Add your first real club. No fictional clubs have been added."
        />
      )}
      <div className="club-grid">
        {db.clubs
          .filter((c) => country === "All countries" || c.country === country)
          .map((club) => {
            const cs = db.contacts.filter(
              (c) => c.clubId === club.id && !c.archived,
            );
            return (
              <section className="panel club-card" key={club.id}>
                <div className="row-between">
                  <span className="club-mark">
                    <Shield size={22} />
                  </span>
                  <span className="badge">{club.country}</span>
                </div>
                <h3>{club.name}</h3>
                <SourceInfo record={club}/>
                <p className="muted">
                  {club.league} · {club.level}
                </p>
                <div className="button-row">
                  {club.teams.map((t) => (
                    <span className="badge" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="club-stats">
                  <div>
                    <b>{cs.length}</b>
                    <small>Contacts</small>
                  </div>
                  <div>
                    <b>
                      {
                        db.messages.filter(
                          (m) =>
                            cs.some((c) => c.id === m.contactId) &&
                            m.status === "Sent",
                        ).length
                      }
                    </b>
                    <small>Outreach</small>
                  </div>
                  <div>
                    <b>
                      {
                        db.opportunities.filter((o) =>
                          cs.some((c) => c.id === o.contactId),
                        ).length
                      }
                    </b>
                    <small>Opportunities</small>
                  </div>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setActive(active === club.id ? null : club.id);
                    setNote(club.notes);
                  }}
                >
                  {active === club.id
                    ? "Hide intelligence"
                    : "View club intelligence"}{" "}
                  <ArrowUpRight size={13} />
                </button>
                {active === club.id && (
                  <div className="club-detail">
                    <small>
                      Official website: {club.site || "Not verified"}
                    </small>
                    {cs.map((c) => (
                      <button
                        className="draft-item"
                        key={c.id}
                        onClick={() => onOpen(c.id)}
                      >
                        {c.name}
                        <small>
                          {c.role} · {c.status}
                        </small>
                      </button>
                    ))}
                    <textarea
                      aria-label={"Notes for " + club.name}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <button
                      className="btn"
                      onClick={async () => {
                        if (!await mutate("Club notes saved", (d) => {
                          d.clubs.find((c) => c.id === club.id)!.notes = note;
                        })) return;
                        toast.success("Club notes saved");
                      }}
                    >
                      Save club notes
                    </button>
                  </div>
                )}
              </section>
            );
          })}
      </div>
    </>
  );
}
