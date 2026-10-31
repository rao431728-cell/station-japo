import type { Contact, Database, Platform, Provenance, Stage } from "@/types";
import { analyzeReply, stages } from "./intelligence";
import { normalizeIdentity } from "./identity";
export { normalizeIdentity } from "./identity";

export type ImportMethod = "Conversation" | "Email" | "CSV";
export interface ParsedMessage { id: string; body: string; direction: "in" | "out" | "unknown"; date: string; speaker: string }
export interface ParsedReferral { name: string; email: string; club: string; evidence: string; include: boolean }
export interface ImportDraft {
  id: string; method: ImportMethod; contactName: string; email: string; instagram: string; linkedin: string;
  club: string; country: string; league: string; role: string; platform: Platform; subject: string;
  messages: ParsedMessage[]; sentiment: string; responseType: string; requestedItems: string[];
  peopleMentioned: string[]; emailsMentioned: string[]; referrals: ParsedReferral[];
  nextAction: string; suggestedStatus: Stage; followUpNeeded: boolean; followUpDate: string;
  createOpportunity: boolean; opportunityStage: string; notes: string; lastContacted: string;
  warnings: string[];
}
export interface ConversationParser {
  parseConversation(text: string, options?: { method?: ImportMethod; ownEmail?: string; ownName?: string }): Promise<ImportDraft>;
  parseConversationImage(file: File): Promise<{ status: "pending"; message: string }>;
}
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const norm = (s: string) => s.trim().toLowerCase();
export function matchImportContact(d: Pick<ImportDraft, "contactName" | "club" | "email" | "instagram" | "linkedin">, db: Database) {
  const matches = db.contacts.filter(c =>
    (["email", "instagram", "linkedin"] as const).some(k => d[k] && c[k] && normalizeIdentity(d[k], k) === normalizeIdentity(c[k], k)) ||
    (!!d.contactName && !!d.club && norm(c.name) === norm(d.contactName) && norm(db.clubs.find(b => b.id === c.clubId)?.name || "") === norm(d.club)));
  if (matches.length > 1) throw new Error(`Multiple saved contacts match ${d.contactName || d.email}. Resolve the duplicate identities before importing.`);
  return matches[0];
}
export function emptyImport(method: ImportMethod = "Conversation"): ImportDraft {
  return { id: crypto.randomUUID(), method, contactName: "", email: "", instagram: "", linkedin: "", club: "", country: "", league: "", role: "", platform: method === "Email" ? "Email" : "Instagram DM", subject: "", messages: [], sentiment: "Neutral", responseType: "Waiting", requestedItems: [], peopleMentioned: [], emailsMentioned: [], referrals: [], nextAction: "", suggestedStatus: "Found", followUpNeeded: false, followUpDate: "", createOpportunity: false, opportunityStage: "Profile Review", notes: "", lastContacted: "", warnings: [] };
}
function extractedDate(s: string) {
  const iso = s.match(/\b(20\d{2}-\d{2}-\d{2})(?:[T ][\d:.]+Z?)?/);
  if (iso && !Number.isNaN(Date.parse(iso[0]))) return new Date(iso[0]).toISOString();
  // Parse only explicitly dated email headers, never invent dates for relative text.
  if (/\b(?:19|20)\d{2}\b/.test(s) && !Number.isNaN(Date.parse(s))) return new Date(s).toISOString();
  return "";
}
export function parseConversation(text: string, options: { method?: ImportMethod; ownEmail?: string; ownName?: string } = {}): ImportDraft {
  if (!text.trim()) throw new Error("Paste a conversation first.");
  if (text.length > 200000) throw new Error("Import one thread at a time (maximum 200,000 characters).");
  const draft = emptyImport(options.method);
  const own = (s: string) => /^(me|you|myself)$/i.test(s.trim()) || (!!options.ownEmail && norm(s).includes(norm(options.ownEmail))) || (!!options.ownName && norm(s) === norm(options.ownName));
  let current: ParsedMessage | null = null;
  const flush = () => { if (current?.body.trim()) draft.messages.push({ ...current, body: current.body.trim() }); current = null; };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.replace(/^>\s?/, "");
    const metadata = !current && line.match(/^(Club|Country|League|Role|Platform):\s*(.+)$/i);
    if (metadata) {
      const key = metadata[1].toLowerCase();
      if (key === "platform") { const p = ["Email", "Instagram DM", "LinkedIn", "Follow-up"].find(p => norm(p) === norm(metadata[2])); if (p) draft.platform = p as Platform; }
      else draft[key as "club" | "country" | "league" | "role"] = metadata[2].trim();
      continue;
    }
    if (/^[-_]{3,}.*(?:original|forwarded).*message/i.test(line)) { flush(); continue; }
    const from = line.match(/^From:\s*(.+)$/i) || line.match(/^On (.+),\s*(.+?) wrote:$/i);
    if (from) {
      flush();
      const speaker = from[2] || from[1];
      current = { id: crypto.randomUUID(), speaker, direction: own(speaker) ? "out" : "in", date: from[2] ? extractedDate(from[1]) : "", body: "" };
      const email = speaker.match(emailPattern)?.[0] || "";
      if (current.direction === "in" && !draft.email) draft.email = email;
      const name = speaker.replace(/<[^>]+>/g, "").replace(emailPattern, "").replace(/["<>]/g, "").trim();
      if (current.direction === "in" && name && !draft.contactName) draft.contactName = name;
      continue;
    }
    if (/^(To|Cc|Bcc):/i.test(line)) continue;
    const subject = line.match(/^Subject:\s*(.*)/i);
    if (subject) { if (!draft.subject) draft.subject = subject[1]; continue; }
    const date = line.match(/^(Date|Sent):\s*(.*)/i);
    if (date && current) { current.date = extractedDate(date[2]); continue; }
    const label = line.match(/^(?:\[([^\]]+)\]\s*)?([\p{L}][\p{L}\p{N} ._'@-]{0,65}):\s*(.*)$/u);
    if (label && !/^(https?|club|role|platform|country|subject|date|sent|email|notes)$/i.test(label[2])) {
      flush();
      const speaker = label[2];
      current = { id: crypto.randomUUID(), speaker, direction: own(speaker) ? "out" : "in", date: label[1] ? extractedDate(label[1]) : "", body: label[3] };
      if (current.direction === "in" && !draft.contactName && !/^(coach|contact|them|recruiter)$/i.test(speaker)) draft.contactName = speaker;
      if (/^(coach|recruiter)$/i.test(speaker)) draft.role = speaker;
      continue;
    }
    if (!current) current = { id: crypto.randomUUID(), speaker: "Unidentified", direction: "unknown", date: "", body: "" };
    current.body += (current.body ? "\n" : "") + line;
  }
  flush();
  if (!draft.messages.length) throw new Error("No message text found.");
  // Keep undated messages in pasted order. Dates, when present for every message, establish chronology.
  if (draft.messages.every(m => m.date)) draft.messages.sort((a, b) => a.date.localeCompare(b.date));
  const inbound = draft.messages.filter(m => m.direction === "in");
  const latest = inbound.at(-1);
  const analysis = analyzeReply(latest?.body || "");
  Object.assign(draft, { sentiment: analysis.sentiment, responseType: analysis.responseType, requestedItems: analysis.requestedItems,
    nextAction: latest ? analysis.nextAction : "Review history and choose the next action", suggestedStatus: latest ? analysis.sentiment === "Negative" ? "Closed" : analysis.trialMentioned ? "Trial" : analysis.sentiment === "Positive" ? "Interested" : "Replied" : draft.messages.some(m => m.direction === "out") ? "Contacted" : "Found",
    followUpNeeded: !!analysis.followUpDate, createOpportunity: !!latest && analysis.sentiment === "Positive", opportunityStage: analysis.trialMentioned ? "Trial Discussion" : "Profile Review" });
  draft.emailsMentioned = [...new Set(text.match(emailPattern) || [])];
  for (const m of inbound) {
    const rx = /(?:email|contact|reach out to|speak to)\s+([\p{L}][\p{L} .'-]{0,50}?)\s+(?:at|on)\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/giu;
    for (const match of m.body.matchAll(rx)) {
      if (!draft.referrals.some(r => norm(r.email) === norm(match[2]))) draft.referrals.push({ name: match[1].trim(), email: match[2], club: "", evidence: match[0], include: false });
    }
  }
  draft.peopleMentioned = draft.referrals.map(r => r.name);
  for (const m of inbound) for (const match of m.body.matchAll(/(?:[Cc]ontact|[Ee]mail|[Ss]peak to|[Rr]each out to)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})\b/gu)) {
    const name = match[1].trim();
    if (!draft.referrals.some(r => norm(r.name) === norm(name))) draft.referrals.push({ name, email: "", club: "", evidence: match[0], include: false });
  }
  draft.peopleMentioned = draft.referrals.map(r => r.name);
  if (draft.referrals.length) { draft.nextAction = `Contact ${draft.referrals.map(r => r.name).join(", ")} using the referral`; draft.responseType = "Referral"; }
  if (draft.messages.some(m => !m.date)) draft.warnings.push("Missing dates stay unknown. No historical date will be fabricated.");
  if (draft.messages.some(m => m.direction === "unknown")) draft.warnings.push("Choose who sent every unidentified message before importing.");
  if (options.method === "Email" && !options.ownEmail) draft.warnings.push("Your profile email is not set. Check every sender direction.");
  if (new Set(inbound.map(m => m.speaker)).size > 1) draft.warnings.push("Multiple sender labels found. This import is one contact per thread; remove messages belonging to other people.");
  draft.warnings.push("Local rules, not an AI service. Confirm names, platform, message order, status, referrals and next actions.");
  return draft;
}
export async function parseConversationImage(_file: File): Promise<{ status: "pending"; message: string }> {
  return { status: "pending", message: "Screenshot extraction is pending. No image was uploaded or parsed. Paste the visible text to continue." };
}
export const localConversationParser: ConversationParser = {
  async parseConversation(text, options) { return parseConversation(text, options); }, parseConversationImage,
};
export const csvTemplate = "club,country,league,contact,role,email,instagram,linkedin,platform,status,lastContacted,notes\r\n";
export function parseCSV(text: string): ImportDraft[] {
  if (text.length > 2000000) throw new Error("CSV limit is 2 MB.");
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (quoted) throw new Error("Unclosed quoted field in CSV.");
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  const headers = rows.shift()?.map(x => norm(x.replace(/^\uFEFF/, ""))) || [];
  if (!headers.includes("contact") || !headers.includes("club")) throw new Error("CSV must contain contact and club headers. Download the template.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column headers.");
  if (!rows.length || rows.length > 500) throw new Error("Import between 1 and 500 rows at a time.");
  return rows.map((cells, i) => {
    if (cells.length !== headers.length) throw new Error(`Row ${i + 2} has ${cells.length} fields; expected ${headers.length}.`);
    const values = Object.fromEntries(headers.map((h, j) => [h, cells[j].trim()]));
    const d = emptyImport("CSV");
    Object.assign(d, { club: values.club || "", contactName: values.contact || "", country: values.country || "", league: values.league || "", role: values.role || "", email: values.email || "", instagram: values.instagram || "", linkedin: values.linkedin || "", notes: values.notes || "" });
    const platform = ["Email", "Instagram DM", "LinkedIn", "Follow-up"].find(p => norm(p) === norm(values.platform || ""));
    d.platform = platform as Platform || (norm(values.platform || "") === "instagram" ? "Instagram DM" : "Email");
    if (values.platform && !platform && norm(values.platform) !== "instagram") d.warnings.push(`Unrecognized platform: ${values.platform}. Review selection.`);
    const stage = stages.find(s => norm(s) === norm(values.status || ""));
    d.suggestedStatus = stage || "Found";
    if (values.status && !stage) d.warnings.push(`Unrecognized status: ${values.status}. Review selection.`);
    d.lastContacted = values.lastcontacted ? extractedDate(values.lastcontacted) : "";
    if (values.lastcontacted && !d.lastContacted) d.warnings.push(`Unrecognized lastContacted date: ${values.lastcontacted}. Enter an explicit date.`);
    d.warnings.push("CSV saves contact information only. Sent messages and replies are not invented from status or last-contacted dates.");
    return d;
  });
}
export function validateImport(d: ImportDraft, db: Database) {
  if (!d.contactName.trim() || !d.club.trim()) throw new Error("Enter a contact name and club for every import.");
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new Error(`Check the email for ${d.contactName}.`);
  if (!stages.includes(d.suggestedStatus)) throw new Error("Choose a valid contact status.");
  if (d.messages.some(m => m.direction === "unknown" || !m.body.trim() || (m.date && Number.isNaN(Date.parse(m.date))))) throw new Error("Review message directions, text and dates.");
  if (d.method !== "CSV" && !d.messages.length) throw new Error("Keep at least one message to import.");
  if (d.followUpNeeded && !/^\d{4}-\d{2}-\d{2}$/.test(d.followUpDate)) throw new Error("Choose a follow-up date or turn off scheduling.");
  if (d.lastContacted && Number.isNaN(Date.parse(d.lastContacted))) throw new Error("Check the last-contacted date.");
  for (const r of d.referrals.filter(r => r.include)) if (!r.name.trim() || !r.club.trim() || (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))) throw new Error("Confirm each referred person's name and club, and check any provided email, or deselect the referral.");
  matchImportContact(d, db);
}
export function confirmOutreachImport(db: Database, drafts: ImportDraft[]) {
  drafts.forEach(d => validateImport(d, db));
  const batchId = crypto.randomUUID(), now = new Date().toISOString();
  let contacts = 0, messages = 0, referrals = 0;
  const ids: string[] = [];
  for (const d of drafts) {
    const provenance: Provenance = { source: d.method === "CSV" ? "Imported CSV" : d.method === "Email" ? "Imported Email" : "Imported Conversation", recordedAt: now, batchId, detail: `${d.platform} · reviewed by user` };
    const ensureContact = (identity: Pick<ImportDraft, "contactName" | "club" | "email" | "instagram" | "linkedin">, isMain: boolean) => {
      let existing = matchImportContact(identity, db);
      if (!existing) {
        let club = db.clubs.find(c => norm(c.name) === norm(identity.club) && (!isMain || !d.country || !c.country || norm(c.country) === norm(d.country)));
        if (!club) { club = { id: crypto.randomUUID(), name: identity.club.trim(), country: isMain ? d.country : "", league: isMain ? d.league : "", level: "", teams: [], site: "", notes: "", provenance: [provenance] }; db.clubs.push(club); }
        existing = { id: crypto.randomUUID(), name: identity.contactName.trim(), clubId: club.id, role: isMain ? d.role : "", country: club.country, league: club.league, email: identity.email, instagram: identity.instagram, linkedin: identity.linkedin, sources: [], sourceLabel: provenance.source, confidence: "Unverified", emailStatus: "Unverified", status: "Found", discoveredAt: now, verifiedAt: null, lastContacted: null, nextFollowUp: null, notes: "", archived: false, demo: db.workspaceMode === "demo", provenance: [] } satisfies Contact;
        db.contacts.push(existing); contacts++;
      }
      existing.provenance = [...(existing.provenance || []), provenance];
      for (const k of ["email", "instagram", "linkedin"] as const) if (!existing[k] && identity[k]) existing[k] = identity[k];
      return existing;
    };
    const c = ensureContact(d, true); ids.push(c.id);
    if (d.platform === "LinkedIn" && d.messages.length) {
      c.linkedInProfile = { headline: "", relevantRole: "", source: "", lastChecked: "", status: "Not Contacted", connectionConfirmed: false, ...c.linkedInProfile };
      c.linkedInProfile.status = d.suggestedStatus === "Closed" ? "Closed" : d.createOpportunity ? "Opportunity" : d.messages.at(-1)?.direction === "in" ? "Replied" : "Messaged";
    }
    c.status = d.suggestedStatus;
    if (!c.role) c.role = d.role;
    if (d.notes && !c.notes.includes(d.notes)) c.notes += (c.notes ? "\n" : "") + d.notes;
    const occurrences = new Map<string, number>();
    for (const m of d.messages) {
      const key = JSON.stringify([m.direction, m.body.trim(), m.date, d.platform]);
      const occurrence = (occurrences.get(key) || 0) + 1; occurrences.set(key, occurrence);
      const existingCount = db.messages.filter(x => x.contactId === c.id && x.direction === m.direction && x.body.trim() === m.body.trim() && x.platform === d.platform && (x.date === m.date || (!m.date && x.dateUnknown))).length;
      if (existingCount >= occurrence) continue;
      db.messages.push({ id: crypto.randomUUID(), contactId: c.id, platform: d.platform, direction: m.direction as "in" | "out", body: m.body.trim(), date: m.date, dateUnknown: !m.date, status: m.direction === "in" ? "Received" : "Sent", followUp: false, subject: d.subject, provenance: [provenance] }); messages++;
    }
    const dates = [c.lastContacted, d.lastContacted, ...d.messages.filter(m => m.direction === "out").map(m => m.date)].filter(Boolean) as string[];
    c.lastContacted = dates.map(x => new Date(x).toISOString()).sort().at(-1) || null;
    if (d.messages.length) {
      const analysis = { ...analyzeReply(d.messages.filter(m => m.direction === "in").at(-1)?.body || ""), sentiment: d.sentiment, responseType: d.responseType, requestedItems: d.requestedItems, nextAction: d.nextAction, followUpDate: d.followUpNeeded ? d.followUpDate : null };
      let conv = db.conversations.find(v => v.contactId === c.id);
      if (!conv) { conv = { id: crypto.randomUUID(), contactId: c.id, analysis, read: false, provenance: [] }; db.conversations.push(conv); }
      conv.analysis = analysis; conv.provenance = [...(conv.provenance || []), provenance];
    }
    if (d.createOpportunity && !db.opportunities.some(o => o.contactId === c.id && o.stage !== "Closed")) db.opportunities.push({ id: crypto.randomUUID(), contactId: c.id, type: d.opportunityStage.startsWith("Trial") ? "Trial" : "Recruitment Review", stage: d.opportunityStage, nextStep: d.nextAction, createdAt: now, provenance: [provenance] });
    if (d.followUpNeeded) {
      c.nextFollowUp = d.followUpDate;
      if (!db.followUps.some(f => f.contactId === c.id && f.status === "Scheduled" && f.date === d.followUpDate)) db.followUps.push({ id: crypto.randomUUID(), contactId: c.id, date: d.followUpDate, status: "Scheduled", sequence: 1, provenance: [provenance] });
    }
    for (const r of d.referrals.filter(r => r.include)) {
      const target = ensureContact({ contactName: r.name, email: r.email, club: r.club, instagram: "", linkedin: "" }, false);
      db.referrals ||= [];
      if (target.id !== c.id && !db.referrals.some(x => x.fromContactId === c.id && x.toContactId === target.id)) { db.referrals.push({ id: crypto.randomUUID(), fromContactId: c.id, toContactId: target.id, evidence: r.evidence, provenance: [provenance] }); referrals++; }
    }
  }
  return { contacts, messages, referrals, ids };
}
