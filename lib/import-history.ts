import { z } from "zod";
import type { Database, Provenance } from "@/types";
import { analyzeReply, duplicateOf, stages } from "./intelligence";
import { resultSchema, researchJobSchema, marketStatuses } from "./research-model";
const date = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const club = z.object({
  researchEvidence:z.array(resultSchema).optional(),lastVerified:z.string().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string(),
  league: z.string(),
  level: z.string(),
  teams: z.array(z.string()),
  site: z.string(),
  notes: z.string(),
});
const contact = z.object({
  researchEvidence:z.array(resultSchema).optional(),
  linkedInProfile: z.object({ headline: z.string(), relevantRole: z.string(), source: z.string(), lastChecked: z.string(), status: z.enum(["Not Contacted", "Connection Request Sent", "Connected", "Messaged", "Replied", "Follow-up Needed", "Opportunity", "Closed"]), connectionConfirmed: z.boolean(), connectedAt: z.string().optional() }).optional(),
  linkedInEvents: z.array(z.object({ id: z.string(), status: z.enum(["Not Contacted", "Connection Request Sent", "Connected", "Messaged", "Replied", "Follow-up Needed", "Opportunity", "Closed"]), date: date.or(z.literal("")), recordedAt: date, note: z.string() })).optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  clubId: z.string(),
  role: z.string(),
  country: z.string(),
  league: z.string(),
  email: z.string(),
  instagram: z.string(),
  linkedin: z.string(),
  sources: z.array(z.string()),
  sourceLabel: z.string(),
  confidence: z.enum([
    "Unverified",
    "Medium Confidence",
    "High Confidence",
    "Verified",
  ]),
  emailStatus: z.enum(["Unverified", "Likely", "Verified Public"]),
  status: z.enum(stages),
  discoveredAt: date,
  verifiedAt: date.nullable(),
  lastContacted: date.nullable(),
  nextFollowUp: date.nullable(),
  notes: z.string(),
  archived: z.boolean(),
  demo: z.boolean(),
});
const message = z
  .object({
    id: z.string().min(1),
    contactId: z.string(),
    platform: z.enum(["Email", "Instagram DM", "LinkedIn", "Follow-up"]),
    direction: z.enum(["in", "out"]),
    body: z.string(),
    date: date.or(z.literal("")),
    dateUnknown: z.boolean().optional(),
    subject: z.string().optional(),
    linkedInType: z.enum(["Connection request", "First message", "Follow-up", "Reply", "Referral introduction"]).optional(),
    status: z.enum(["Draft", "Sent", "Received"]),
    followUp: z.boolean(),
  })
  .refine(
    (m) =>
      m.direction === "in" ? m.status === "Received" : m.status !== "Received",
    "Message direction does not match status",
  );
export const historySchema = z.object({
  version: z.literal(1),
  workspaceMode: z.enum(["personal", "demo"]).optional(),
  clubs: z.array(club),
  contacts: z.array(contact),
  messages: z.array(message),
  researchJobs:z.array(researchJobSchema).optional(),marketPriorities:z.record(z.enum(marketStatuses)).optional(),outreachQueue:z.array(z.object({id:z.string(),contactId:z.string(),date:z.string(),researchJobId:z.string()})).optional(),
});
export function importHistory(db: Database, input: unknown) {
  const data = historySchema.parse(input);
  if (data.workspaceMode === "demo")
    throw new Error(
      "DEMO DATA backups cannot be imported into personal history.",
    );
  const clubs = new Map<string, string>();
  const provenance: Provenance = { source: "Imported Conversation", recordedAt: new Date().toISOString(), batchId: crypto.randomUUID(), detail: "User-confirmed Station Japo JSON backup import" };
  const contacts = new Map<string, string>();
  let added = 0;
  for (const c of data.contacts.filter((c) => !c.demo)) {
    if (!data.clubs.some((b) => b.id === c.clubId))
      throw new Error(
        "Every imported contact must reference a club in the backup.",
      );
  }
  for (const c of data.clubs.filter((c) =>
    data.contacts.some((p) => !p.demo && p.clubId === c.id),
  )) {
    const match = db.clubs.find(
      (b) =>
        b.name.trim().toLowerCase() === c.name.trim().toLowerCase() &&
        b.country === c.country,
    );
    const id = match?.id || crypto.randomUUID();
    clubs.set(c.id, id);
    if (!match) db.clubs.push({ ...c, id, provenance: [provenance] });
  }
  for (const c of data.contacts.filter((c) => !c.demo)) {
    const candidate = {
      ...c,
      id: crypto.randomUUID(),
      clubId: clubs.get(c.clubId)!,
      provenance: [provenance],
    };
    const match = duplicateOf(candidate, db.contacts);
    contacts.set(c.id, match?.id || candidate.id);
    if (!match) db.contacts.push(candidate);
    else match.sources = [...new Set([...match.sources, ...candidate.sources])];
  }
  for (const m of data.messages) {
    const contactId = contacts.get(m.contactId);
    if (!contactId) continue;
    if (
      db.messages.some(
        (x) =>
          x.contactId === contactId &&
          x.date === m.date &&
          x.direction === m.direction &&
          x.body === m.body &&
          x.platform === m.platform,
      )
    )
      continue;
    db.messages.push({ ...m, id: crypto.randomUUID(), contactId, provenance: [provenance] });
    added++;
  }
  for (const id of contacts.values()) {
    const incoming = db.messages
      .filter(
        (m) =>
          m.contactId === id && m.direction === "in" && m.status === "Received",
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    if (incoming && !db.conversations.some((c) => c.contactId === id))
      db.conversations.push({
        id: crypto.randomUUID(),
        contactId: id,
        analysis: analyzeReply(incoming.body),
        read: false,
        provenance: [provenance],
      });
  }
  // Research history and field evidence survive a user-confirmed backup merge.
  db.researchJobs ||= [];
  for(const j of data.researchJobs || []) if(!db.researchJobs.some(x=>x.id===j.id)) db.researchJobs.push({...j,status:j.status==="Running"?"Interrupted":j.status,results:j.results.map(r=>({...r,savedContactId:r.savedContactId?contacts.get(r.savedContactId):undefined}))});
  db.marketPriorities={...data.marketPriorities,...db.marketPriorities};
  db.outreachQueue ||= [];
  for(const q of data.outreachQueue || []) {const id=contacts.get(q.contactId);if(id&&!db.outreachQueue.some(x=>x.contactId===id))db.outreachQueue.push({...q,id:crypto.randomUUID(),contactId:id});}
  return added;
}
