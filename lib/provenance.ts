import type { Database } from "@/types";
export type WorkspaceMode = "personal" | "demo";
/** A demo contact and every dependent record are excluded from personal views. */
export function personalRecords(db: Database): Database {
  if (db.workspaceMode === "demo")
    return {
      ...db,
      workspaceMode: "personal",
      clubs: [],
      contacts: [],
      messages: [],
      conversations: [],
      followUps: [],
      opportunities: [],
      research: [],
      researchJobs: [],
      outreachQueue: [],
      marketPriorities: {},
      notifications: [],
      audit: [],
      referrals: [],
    };
  const contacts = db.contacts.filter((c) => !c.demo);
  const ids = new Set(contacts.map((c) => c.id));
  const associated = new Set(contacts.map((c) => c.clubId));
  const demoClubs = new Set(
    db.contacts.filter((c) => c.demo).map((c) => c.clubId),
  );
  const hasDemo = demoClubs.size > 0;
  return {
    ...db,
    contacts,
    clubs: db.clubs.filter((c) => associated.has(c.id) || !demoClubs.has(c.id)),
    messages: db.messages.filter((m) => ids.has(m.contactId)),
    conversations: db.conversations.filter((c) => ids.has(c.contactId)),
    followUps: db.followUps.filter((f) => ids.has(f.contactId)),
    opportunities: db.opportunities.filter((o) => ids.has(o.contactId)),
    referrals: db.referrals?.filter(r => ids.has(r.fromContactId) && ids.has(r.toContactId)),
    research: db.research.filter(
      (r) =>
        !hasDemo ||
        (r.results.length > 0 && r.results.every((id) => ids.has(id))),
    ),
    notifications: db.notifications.filter(
      (n) => !hasDemo || contacts.some((c) => n.text.includes(c.name)),
    ),
    audit: db.audit.filter((a) =>
      a.contactId
        ? ids.has(a.contactId)
        : !hasDemo ||
          !/demo|simulated|research|notification|conversation read/i.test(
            a.action,
          ),
    ),
  };
}
export interface MetricRecord {
  id: string;
  label: string;
  detail: string;
  contactId?: string;
}
export interface Metric {
  label: string;
  explanation: string;
  records: MetricRecord[];
  route: string;
}
export function dashboardMetrics(
  input: Database,
  mode: WorkspaceMode = "personal",
): Metric[] {
  const db = mode === "personal" ? personalRecords(input) : input;
  const contacts = db.contacts;
  const ids = new Set(contacts.map((c) => c.id));
  const name = (id: string) => db.contacts.find((c) => c.id === id)?.name || id;
  const related = (id: string) => ids.has(id);
  return [
    {
      label: "Contacts researched",
      route: "Contacts",
      explanation:
        "One record per real saved contact, including archived history. Personal mode excludes demo contacts.",
      records: contacts.map((c) => ({
        id: c.id,
        label: c.name,
        detail: c.role + " · " + c.country,
        contactId: c.id,
      })),
    },
    {
      label: "Clubs",
      route: "Clubs",
      explanation:
        "Distinct saved clubs referenced by contacts. Clubs without contacts are not counted.",
      records: db.clubs
        .filter((c) => contacts.some((p) => p.clubId === c.id))
        .map((c) => ({
          id: c.id,
          label: c.name,
          detail: c.country + " · " + c.league,
        })),
    },
    {
      label: "Messages sent",
      route: "Outreach",
      explanation:
        "Outbound message records with status Sent. Archived history is retained; drafts do not count.",
      records: db.messages
        .filter(
          (m) =>
            related(m.contactId) &&
            m.direction === "out" &&
            m.status === "Sent",
        )
        .map((m) => ({
          id: m.id,
          label: name(m.contactId),
          detail: m.platform + " · " + (m.dateUnknown ? "Date unknown" : m.date) + " · " + m.body,
          contactId: m.contactId,
        })),
    },
    {
      label: "Replies received",
      route: "Inbox",
      explanation:
        "Inbound message records with status Received. Multiple replies in one conversation each count.",
      records: db.messages
        .filter(
          (m) =>
            related(m.contactId) &&
            m.direction === "in" &&
            m.status === "Received",
        )
        .map((m) => ({
          id: m.id,
          label: name(m.contactId),
          detail: m.platform + " · " + (m.dateUnknown ? "Date unknown" : m.date) + " · " + m.body,
          contactId: m.contactId,
        })),
    },
    {
      label: "Active conversations",
      route: "Inbox",
      explanation:
        "Saved conversations whose contact is not archived, Closed or Dormant.",
      records: db.conversations
        .filter((v) =>
          contacts.some(
            (c) =>
              c.id === v.contactId && !c.archived && !["Closed", "Dormant"].includes(c.status),
          ),
        )
        .map((v) => ({
          id: v.id,
          label: name(v.contactId),
          detail: v.analysis.responseType,
          contactId: v.contactId,
        })),
    },
    {
      label: "Trial discussions",
      route: "Opportunities",
      explanation:
        "Saved opportunities in exactly Trial Discussion or Trial Confirmed, associated with saved contacts.",
      records: db.opportunities
        .filter(
          (o) =>
            related(o.contactId) &&
            ["Trial Discussion", "Trial Confirmed"].includes(o.stage),
        )
        .map((o) => ({
          id: o.id,
          label: name(o.contactId),
          detail: o.stage + " · " + o.nextStep,
          contactId: o.contactId,
        })),
    },
  ];
}
