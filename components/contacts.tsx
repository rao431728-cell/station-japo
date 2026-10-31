"use client";
import { SourceInfo } from "./source-info";
import { useState } from "react";
import {
  Search,
  MoreHorizontal,
  Plus,
  ArrowUpDown,
  Mail,
  ShieldCheck,
  ExternalLink,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import {
  countries,
  stages,
  roles,
  scoreContact,
  day,
} from "@/lib/intelligence";
import {
  Choice,
  EmptyState,
  Status,
  initials,
  dateLabel,
  type Navigate,
} from "./shared";
import type { Contact, Stage } from "@/types";
import { toast } from "sonner";
import { AddClubButton } from "./getting-started";
export function ContactTable({
  filter = "",
  onOpen,
  onCompose,
  compact = false,
}: {
  filter?: string;
  onOpen: (id: string) => void;
  onCompose: (id: string, platform?: string) => void;
  compact?: boolean;
}) {
  const { db, mutate } = useStore();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState(
    countries.includes(filter) || filter === "Europe"
      ? filter
      : "All countries",
  );
  const [status, setStatus] = useState(
    (stages as readonly string[]).includes(filter) ? filter : "All statuses",
  );
  const [role, setRole] = useState("All roles");
  const [league, setLeague] = useState("All leagues");
  const [sort, setSort] = useState("Priority");
  const [selected, setSelected] = useState<string[]>([]);
  const [archived, setArchived] = useState(false);
  const [add, setAdd] = useState(filter === "add");
  const contacts = db.contacts
    .filter(
      (c) =>
        c.archived === archived &&
        (country === "All countries" ||
          c.country === country ||
          (country === "Europe" &&
            [
              "England",
              "Netherlands",
              "Germany",
              "Belgium",
              "Croatia",
              "Portugal",
              "Spain",
            ].includes(c.country))) &&
        (status === "All statuses" || c.status === status) &&
        (role === "All roles" || c.role === role) &&
        (league === "All leagues" || c.league === league) &&
        `${c.name} ${db.clubs.find((x) => x.id === c.clubId)?.name} ${c.country} ${c.role}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Name"
        ? a.name.localeCompare(b.name)
        : scoreContact(b, db).score - scoreContact(a, db).score,
    );
  const shown = compact ? contacts.slice(0, 5) : contacts;
  const bulk = async (stage: Stage) => {
    if (!await mutate("Bulk status changed to " + stage, (d) => {
      d.contacts
        .filter((c) => selected.includes(c.id))
        .forEach((c) => {
          c.status = stage;
        });
    })) return;
    setSelected([]);
    toast.success("Contact statuses updated");
  };
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <h3>
          {compact ? "Priority contacts" : "Your contact network"}{" "}
          <span className="count-label">{contacts.length}</span>
        </h3>
        {!compact && (
          <button className="btn primary" onClick={() => setAdd(true)}>
            <Plus size={15} />
            Add contact
          </button>
        )}
      </div>
      <div className="filters">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search contacts"
            placeholder="Search contacts or clubs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Choice
          label="Country"
          value={country}
          onChange={setCountry}
          options={["All countries", "Europe", ...countries]}
        />
        <Choice
          label="Status"
          value={status}
          onChange={setStatus}
          options={["All statuses", ...stages]}
        />
        {!compact && (
          <>
            <Choice
              label="Role"
              value={role}
              onChange={setRole}
              options={["All roles", ...roles]}
            />
            <Choice
              label="League"
              value={league}
              onChange={setLeague}
              options={[
                "All leagues",
                ...new Set(db.clubs.map((c) => c.league)),
              ]}
            />
          </>
        )}
        <Choice
          label="Sort contacts"
          value={sort}
          onChange={setSort}
          options={["Priority", "Name"]}
        />
      </div>
      {selected.length > 0 && (
        <div className="selection-bar">
          {selected.length} selected{" "}
          <button onClick={() => bulk("Ready")}>Mark ready</button>
          <button onClick={() => bulk("Closed")}>Close contacts</button>
          <button onClick={() => setSelected([])}>Clear</button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                aria-label="Select all visible contacts"
                checked={
                  !!shown.length && shown.every((c) => selected.includes(c.id))
                }
                onCheckedChange={(v) =>
                  setSelected(v ? shown.map((c) => c.id) : [])
                }
              />
            </TableHead>
            <TableHead>Contact / Club</TableHead>
            <TableHead>Country / League</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>
              <button
                onClick={() => setSort(sort === "Name" ? "Priority" : "Name")}
                className="inline-action"
              >
                Score <ArrowUpDown size={12} />
              </button>
            </TableHead>
            {!compact && <TableHead>Contact routes</TableHead>}
            <TableHead>Confidence</TableHead>
            <TableHead>Last contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Checkbox
                  aria-label={"Select " + c.name}
                  checked={selected.includes(c.id)}
                  onCheckedChange={(v) =>
                    setSelected(
                      v
                        ? [...selected, c.id]
                        : selected.filter((x) => x !== c.id),
                    )
                  }
                />
              </TableCell>
              <TableCell>
                <button className="contact-name" onClick={() => onOpen(c.id)}>
                  <span className="avatar">{initials(c.name)}</span>
                  <span>
                    <b>{c.name}</b>
                    <small>
                      {db.clubs.find((x) => x.id === c.clubId)?.name}
                    </small>
                  </span>
                </button>
              </TableCell>
              <TableCell>
                {c.country}
                <small>{c.league}</small>
              </TableCell>
              <TableCell>{c.role}</TableCell>
              <TableCell>
                <span className="score">
                  {scoreContact(c, db).score}
                  <small>/100</small>
                </span>
              </TableCell>
              {!compact && (
                <TableCell>
                  <small>Email: {c.email || "Not provided"}</small>
                  <small>Instagram: {c.instagram || "Not provided"}</small>
                  <small>LinkedIn: {c.linkedin || "Not provided"}</small>
                </TableCell>
              )}
              <TableCell>
                <Status value={c.confidence} />
              </TableCell>
              <TableCell>{dateLabel(c.lastContacted)}</TableCell>
              <TableCell>
                <Status value={c.status} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="icon-button"
                      aria-label={"Actions for " + c.name}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {[
                      "View contact",
                      "Generate email",
                      "Generate Instagram DM",
                      "Generate LinkedIn message",
                      "Mark contacted",
                      "Schedule follow-up",
                      "Add note",
                      c.archived ? "Restore" : "Archive",
                    ].map((a) => (
                      <DropdownMenuItem
                        key={a}
                        onSelect={async () => {
                          if (
                            a.startsWith("Generate") ||
                            a === "Mark contacted"
                          )
                            onCompose(
                              c.id,
                              a.includes("Instagram")
                                ? "Instagram DM"
                                : a.includes("LinkedIn")
                                  ? "LinkedIn"
                                  : "Email",
                            );
                          else if (a === "Archive" || a === "Restore") {
                            if (!await mutate(
                              a + " contact",
                              (d) => {
                                d.contacts.find(
                                  (x) => x.id === c.id,
                                )!.archived = !c.archived;
                              },
                              c.id,
                            )) return;
                            toast.success(
                              a === "Archive"
                                ? "Contact archived; restore it from Archived contacts."
                                : "Contact restored",
                            );
                          } else onOpen(c.id);
                        }}
                      >
                        {a}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!shown.length && (
        <EmptyState
          title="No matching contacts"
          description="Try another country or clear your filters."
        />
      )}
      {!compact && (
        <div className="table-footer">
          <span>
            {shown.length} matching saved contacts · Sources shown in each
            profile
          </span>
          <button
            onClick={() => {
              setArchived(!archived);
              setSelected([]);
            }}
          >
            {archived ? "Active contacts" : "Archived contacts"}
          </button>
        </div>
      )}
      {db.clubs.length ? (
        <AddContact
          key={db.clubs.length}
          open={add}
          close={() => setAdd(false)}
        />
      ) : (
        <Dialog open={add} onOpenChange={setAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a club first</DialogTitle>
              <DialogDescription>
                A contact needs a saved club. Add your first club, then add the
                person you want to reach.
              </DialogDescription>
            </DialogHeader>
            <AddClubButton first />
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
function AddContact({ open, close }: { open: boolean; close: () => void }) {
  const { db, addContact } = useStore();
  const [name, setName] = useState("");
  const [clubId, setClub] = useState(db.clubs[0].id);
  const [role, setRole] = useState(roles[0]);
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a football contact</DialogTitle>
          <DialogDescription>
            Duplicate identities are merged. New details stay unverified until
            reviewed.
          </DialogDescription>
        </DialogHeader>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const club = db.clubs.find((c) => c.id === clubId)!;
            const savedId = await addContact({
              id: crypto.randomUUID(),
              name: name.trim(),
              clubId,
              role,
              country: club.country,
              league: club.league,
              email,
              instagram: "",
              linkedin: "",
              sources: source ? [source] : [],
              sourceLabel: "Manually Added",
              confidence: "Unverified",
              emailStatus: "Unverified",
              status: "Found",
              discoveredAt: day(),
              verifiedAt: null,
              lastContacted: null,
              nextFollowUp: null,
              notes: "",
              archived: false,
              demo: false,
            });
            if (!savedId) return;
            toast.success("Contact saved; duplicate sources merged if found.");
            close();
            setName("");
          }}
        >
          <label>
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Club
            <Choice
              label="Club"
              value={db.clubs.find((c) => c.id === clubId)!.name}
              options={db.clubs.map((c) => c.name)}
              onChange={(n) => setClub(db.clubs.find((c) => c.name === n)!.id)}
            />
          </label>
          <label>
            Role
            <Choice
              label="Contact role"
              value={role}
              options={roles}
              onChange={setRole}
            />
          </label>
          <label>
            Public email, if available
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Source URL
            <input
              type="url"
              placeholder="https://…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={!name.trim()}>
            Save contact
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ContactDrawer({
  id,
  close,
  onCompose,
}: {
  id: string | null;
  close: () => void;
  onCompose: (id: string, platform?: string) => void;
}) {
  const { db, mutate } = useStore();
  const c = db.contacts.find((c) => c.id === id);
  const [note, setNote] = useState("");
  const [due, setDue] = useState(day(5));
  if (!c) return null;
  const club = db.clubs.find((x) => x.id === c.clubId)!;
  const score = scoreContact(c, db);
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && close()}>
      <SheetContent className="contact-drawer">
        <SheetHeader>
          <span className="avatar big">{initials(c.name)}</span>
          <SheetTitle>{c.name}</SheetTitle>
          <SheetDescription>
            {c.role} · {club.name}
          </SheetDescription>
        </SheetHeader>
        <div className="drawer-body">
          <div className="row-between">
            <Status value={c.status} />
            <span className="badge">
              {c.demo ? "Demo data" : "Personal contact"}
            </span>
          </div>
          <div className="detail-grid">
            <div>
              <small>Country</small>
              {c.country}
            </div>
            <div>
              <small>League</small>
              {c.league}
            </div>
            <div>
              <small>Last contacted</small>
              {dateLabel(c.lastContacted)}
            </div>
            <div>
              <small>Next follow-up</small>
              {dateLabel(c.nextFollowUp)}
            </div>
          </div>
          <div className="button-row">
            {["Email", "Instagram DM", "LinkedIn"].map((p) => (
              <button
                className="btn"
                key={p}
                onClick={() => {
                  onCompose(c.id, p);
                  close();
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <h3>Contact routes & sources</h3>
          <SourceInfo record={c}/>
          {!!db.referrals?.some(r => r.fromContactId === c.id || r.toContactId === c.id) && <section className="import-record"><h3>Referral network</h3><p className="muted">You → {c.name}</p>{db.referrals.filter(r => r.fromContactId === c.id || r.toContactId === c.id).map(r => <div key={r.id}><p>{r.toContactId === c.id ? `Referred by ${db.contacts.find(x => x.id === r.fromContactId)?.name}` : `Referred you to ${db.contacts.find(x => x.id === r.toContactId)?.name}`}</p><blockquote>{r.evidence}</blockquote><SourceInfo record={r}/></div>)}</section>}
          {[
            ["Email", c.email],
            ["Instagram", c.instagram],
            ["LinkedIn", c.linkedin],
          ].map(([label, val]) => (
            <div className="detail-line" key={label}>
              <span>{label}</span>
              <b>{val || "Not provided"}</b>
            </div>
          ))}
          <p className="muted">
            {c.sourceLabel} · {c.confidence}
            <br />
            Email: {c.emailStatus} · Verified: {dateLabel(c.verifiedAt)}
          </p>
          {c.sources.map((s) => (
            <a
              className="source-link"
              key={s}
              href={
                s.startsWith("https://") || s.startsWith("http://")
                  ? s
                  : undefined
              }
              target="_blank"
              rel="noreferrer"
            >
              {s}
              <ExternalLink size={13} />
            </a>
          ))}
          {c.demo && (
            <p className="notice">
              Fictional demo contact. No email, social handle or source has been
              fabricated or verified.
            </p>
          )}
          <h3>
            Opportunity score <span className="score">{score.score}/100</span>
          </h3>
          <div className="score-breakdown">
            {Object.entries(score.breakdown).map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <b>
                  {v > 0 ? "+" : ""}
                  {v}
                </b>
              </div>
            ))}
          </div>
          <h3>Manage relationship</h3>
          <Choice
            label="Contact stage"
            value={c.status}
            options={stages}
            onChange={(v) =>
              mutate(
                "Status changed to " + v,
                (d) => {
                  d.contacts.find((x) => x.id === c.id)!.status = v as Stage;
                },
                c.id,
              )
            }
          />
          <form
            className="button-row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!await mutate(
                "Follow-up scheduled",
                (d) => {
                  d.followUps
                    .filter(
                      (f) => f.contactId === c.id && f.status === "Scheduled",
                    )
                    .forEach((f) => (f.status = "Skipped"));
                  d.followUps.push({
                    id: crypto.randomUUID(),
                    contactId: c.id,
                    date: due,
                    status: "Scheduled",
                    sequence: 1,
                  });
                  d.contacts.find((x) => x.id === c.id)!.nextFollowUp = due;
                },
                c.id,
              )) return;
              toast.success("Follow-up scheduled");
            }}
          >
            <input
              aria-label="Follow-up date"
              type="date"
              required
              min={day()}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <button className="btn">
              <CalendarDays size={14} />
              Schedule
            </button>
          </form>
          <h3>Notes</h3>
          <p className="notes-text">{c.notes || "No notes yet."}</p>
          <textarea
            aria-label="Add a contact note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should you remember about this person?"
          />
          <button
            className="btn"
            disabled={!note.trim()}
            onClick={async () => {
              if (!await mutate(
                "Note added",
                (d) => {
                  d.contacts.find((x) => x.id === c.id)!.notes +=
                    (c.notes ? "\n" : "") + note;
                },
                c.id,
              )) return;
              setNote("");
              toast.success("Note saved");
            }}
          >
            Save note
          </button>
          <h3>Relationship timeline</h3>
          <div className="timeline">
            {db.messages
              .filter((m) => m.contactId === c.id)
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((m) => (
                <div key={m.id}>
                  <small>
                    {m.dateUnknown ? "Date unknown" : dateLabel(m.date)} · {m.platform} · {m.status}
                  </small>
                  <p>{m.body}</p>
                </div>
              ))}
            {db.audit
              .filter((a) => a.contactId === c.id)
              .slice(0, 10)
              .map((a) => (
                <div key={a.id}>
                  <small>{dateLabel(a.date)}</small>
                  <p>{a.action}</p>
                </div>
              ))}
          </div>
          <h3>Club intelligence</h3>
          <p className="muted">
            {club.level} · {club.teams.join(" / ")}
          </p>
          <p className="muted">{club.notes}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
