import type { Contact, Database, LinkedInMessageType, LinkedInProfile, LinkedInStatus, Provenance } from "@/types";
import { analyzeReply, day, generateOutreach } from "./intelligence";
import { profileContext } from "./player-profile";
import { orderMessages } from "./message-history";
import { matchImportContact, parseConversation, type ImportDraft } from "./outreach-import";

export const linkedInStatuses: LinkedInStatus[] = ["Not Contacted", "Connection Request Sent", "Connected", "Messaged", "Replied", "Follow-up Needed", "Opportunity", "Closed"];
export const linkedInMessageTypes: LinkedInMessageType[] = ["Connection request", "First message", "Follow-up", "Reply", "Referral introduction"];
// An app writing target, not a claim about current LinkedIn product limits.
export const CONNECTION_NOTE_TARGET = 200;
const provenance = (detail: string): Provenance => ({ source: "LinkedIn", recordedAt: new Date().toISOString(), detail });
export function canonicalLinkedInURL(value: string) {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : "https://" + value.trim()); } catch { throw new Error("Enter a LinkedIn personal profile URL."); }
  if (!/^(?:[a-z]{2,3}\.)?linkedin\.com$/i.test(url.hostname) || url.username || url.password || url.port || !/^\/in\/[^/]+\/?$/.test(url.pathname)) throw new Error("Use a linkedin.com/in/… personal profile URL, not a company or search URL.");
  return "https://www.linkedin.com" + url.pathname.replace(/\/$/, "").toLowerCase();
}
export function linkedInState(c: Contact, db: Database): LinkedInProfile {
  if (c.linkedInProfile) return c.linkedInProfile;
  const history = orderMessages(db.messages.filter(m => m.contactId === c.id && m.platform === "LinkedIn" && m.status !== "Draft"));
  return { headline: "", relevantRole: "", source: "", lastChecked: "", status: history.at(-1)?.direction === "in" ? "Replied" : history.length ? "Messaged" : "Not Contacted", connectionConfirmed: false };
}
export interface LinkedInProfileInput { profileURL: string; name: string; club: string; role: string; country: string; headline: string; relevantRole: string; source: string; lastChecked: string; notes: string }
export function linkLinkedInProfileToContact(db: Database, contactId: string, url: string) {
  const normalized = canonicalLinkedInURL(url);
  const contact = db.contacts.find(c => c.id === contactId);
  if (!contact) throw new Error("Choose a saved contact.");
  const duplicate = db.contacts.find(c => c.id !== contactId && c.linkedin && safeURL(c.linkedin) === normalized);
  if (duplicate) throw new Error(`That profile belongs to ${duplicate.name}. Open that contact instead; records were not merged or overwritten.`);
  if (contact.linkedin && safeURL(contact.linkedin) !== normalized) throw new Error("This contact already has a different LinkedIn profile. Resolve the identity before linking another URL.");
  contact.linkedin = normalized;
  return contact;
}
function safeURL(url: string) { try { return canonicalLinkedInURL(url); } catch { return url.trim().toLowerCase(); } }
export function saveLinkedInProfile(db: Database, input: LinkedInProfileInput, contactId?: string) {
  if (!input.name.trim() || !input.club.trim()) throw new Error("Confirm the person's name and current club before saving.");
  const url = canonicalLinkedInURL(input.profileURL);
  if (input.lastChecked && (!/^\d{4}-\d{2}-\d{2}$/.test(input.lastChecked) || input.lastChecked > day())) throw new Error("Last checked must be a real date, not in the future. Leave it blank if unknown.");
  const match = matchImportContact({ contactName: input.name, club: input.club, email: "", instagram: "", linkedin: url }, db);
  if (contactId && match && match.id !== contactId) throw new Error(`Another contact (${match.name}) matches this profile. Select that person instead.`);
  let c = contactId ? db.contacts.find(c => c.id === contactId) : match;
  if (contactId && !c) throw new Error("The selected contact no longer exists.");
  const source = provenance("Profile details entered and reviewed manually; no external verification");
  let club = db.clubs.find(b => b.name.trim().toLowerCase() === input.club.trim().toLowerCase() && (!input.country || !b.country || b.country.toLowerCase() === input.country.toLowerCase()));
  if (!club) { club = { id: crypto.randomUUID(), name: input.club.trim(), country: input.country.trim(), league: "", level: "", teams: [], site: "", notes: "", provenance: [source] }; db.clubs.push(club); }
  if (!c) {
    c = { id: crypto.randomUUID(), name: input.name.trim(), clubId: club.id, role: input.role.trim(), country: input.country.trim(), league: club.league, email: "", instagram: "", linkedin: "", sources: [], sourceLabel: "LinkedIn · manually entered", confidence: "Unverified", emailStatus: "Unverified", status: "Found", discoveredAt: new Date().toISOString(), verifiedAt: null, lastContacted: null, nextFollowUp: null, notes: "", archived: false, demo: db.workspaceMode === "demo" };
    db.contacts.push(c);
  }
  c = linkLinkedInProfileToContact(db, c.id, url);
  const state = linkedInState(c, db);
  Object.assign(c, { name: input.name.trim(), clubId: club.id, role: input.role.trim(), country: input.country.trim(), notes: input.notes });
  c.linkedInProfile = { ...state, headline: input.headline.trim(), relevantRole: input.relevantRole.trim(), source: input.source.trim(), lastChecked: input.lastChecked };
  c.sources = [...new Set([...c.sources, url, ...(input.source ? [input.source] : [])])];
  c.provenance = [...(c.provenance || []), source];
  return c.id;
}
export function updateLinkedInStatus(db: Database, contactId: string, status: LinkedInStatus, date: string, note: string) {
  const c = db.contacts.find(c => c.id === contactId); if (!c) throw new Error("Contact not found.");
  if (!linkedInStatuses.includes(status)) throw new Error("Choose a valid status.");
  if (date && (Number.isNaN(Date.parse(date)) || new Date(date).getTime() > Date.now())) throw new Error("Use the actual event date, or leave it blank if unknown.");
  c.linkedInProfile = { ...linkedInState(c, db), status };
  if (status === "Connected") { c.linkedInProfile.connectionConfirmed = true; c.linkedInProfile.connectedAt = date; }
  c.linkedInEvents ||= [];
  c.linkedInEvents.push({ id: crypto.randomUUID(), status, date, recordedAt: new Date().toISOString(), note, provenance: [provenance("Status explicitly recorded by user")] });
}
export function analyzeLinkedInReply(text: string) {
  const parsed = parseConversation("Contact:\n" + text);
  return { ...analyzeReply(text), personReferredTo: parsed.peopleMentioned.join(", ") || null, nextAction: parsed.nextAction, peopleMentioned: parsed.peopleMentioned, emailsMentioned: parsed.emailsMentioned, referrals: parsed.referrals, method: "Local rules — review required" };
}
/** Produces an editable proposal only; never writes workspace data. */
export function importLinkedInConversation(text: string, db: Database, contactId?: string): ImportDraft {
  const d = parseConversation(text, { ownName: db.player.name, ownEmail: db.player.email }); d.platform = "LinkedIn";
  const c = db.contacts.find(c => c.id === contactId);
  if (c) Object.assign(d, { contactName: c.name, club: db.clubs.find(b => b.id === c.clubId)?.name || "", role: c.role, country: c.country, linkedin: c.linkedin, email: c.email });
  d.warnings.push("LinkedIn import does not mark this person as connected. Confirm connection acceptance separately.");
  return d;
}
export function generateLinkedInMessage(db: Database, id: string, type: LinkedInMessageType, control = "", current = "") {
  const c = db.contacts.find(c => c.id === id); if (!c) throw new Error("Choose a contact.");
  const p = profileContext(db.player), club = db.clubs.find(b => b.id === c.clubId)?.name || "your club", first = c.name.split(" ")[0];
  const role = c.linkedInProfile?.relevantRole || c.role || "football";
  const identity = `${p.name || "[your name]"}, a ${p.position?.toLowerCase() || "[position]"}${p.nationality ? " from " + p.nationality : ""}`;
  const referral = db.referrals?.find(r => r.toContactId === id);
  const referrer = db.contacts.find(c => c.id === referral?.fromContactId)?.name;
  const inbound = orderMessages(db.messages.filter(m => m.contactId === id && m.platform === "LinkedIn" && m.direction === "in" && m.status === "Received")).at(-1);
  if (type === "Reply" && !inbound) throw new Error("Import the actual LinkedIn reply first.");
  if (type === "Follow-up" && !db.messages.some(m => m.contactId === id && m.platform === "LinkedIn" && m.status === "Sent")) throw new Error("Record your actual earlier outreach before preparing a follow-up.");
  let message = type === "Connection request" ? `Hi ${first}, I'm ${identity}. I'd like to connect and learn about your ${role.toLowerCase()} work at ${club}.` :
    type === "First message" ? `Hi ${first}, I'm ${identity}. I saw your ${role.toLowerCase()} role at ${club}. Would you be open to reviewing my player profile, or pointing me to the right person? Thanks for your time.` :
    type === "Follow-up" ? `Hi ${first}, following up on my earlier message about ${club}. Is there a suitable person to review my profile${p.position ? " as a " + p.position.toLowerCase() : ""}? No problem if the timing isn't right. Thanks.` :
    type === "Referral introduction" ? `Hi ${first}, ${referrer ? referrer + " referred me to you" : "[add the name of the person who referred you]"}. I'm ${identity}. I'd appreciate your advice on the right route for a player evaluation at ${club}.` : generateOutreach(c, { ...db, messages: db.messages.filter(m => m.platform === "LinkedIn") }, "LinkedIn");
  if (type === "Reply" && inbound) { const analysis = analyzeLinkedInReply(inbound.body); if (analysis.peopleMentioned.length) message = `Thanks, ${first}. I appreciate the referral to ${analysis.peopleMentioned.join(" and ")}. I'll reach out and mention that you pointed me their way.`; }
  if (control && control !== "Regenerate" && current.trim()) message = current;
  if (control === "Shorter") message = type === "Connection request" ? `Hi ${first}, I'm ${p.name || "[name]"}, a ${p.position?.toLowerCase() || "footballer"}. I'd like to connect about your work at ${club}.` : `Hi ${first}, could you advise on the next step for my player profile at ${club}? Thanks.`;
  if (control === "More confident") message = message.replace("I'd like to", "I would like to").replace("Would you be open to", "Could you").replace("I'd appreciate", "I would value");
  if (control === "More casual") message = message.replace(/^Hi /, "Hey ").replace("Thanks for your time.", "Appreciate your time.");
  if (control === "More professional") message = message.replace(/^Hey /, "Hi ").replace("Appreciate your time.", "Thank you for your time.");
  if (["Mention CV", "Mention highlights"].includes(control)) {
    const asset = db.assets.find(a => a.kind === (control === "Mention CV" ? "Football CV" : "Highlights") && /^https?:\/\//i.test(a.url));
    if (!asset) throw new Error("Add a recipient-accessible share link in Documents first. Private uploads are not public links.");
    message += `\n${control === "Mention CV" ? "My CV" : "My highlights"}: ${asset.url}`;
  }
  if (control === "Mention availability") { if (!p.availability) throw new Error("Add confirmed availability to Player Profile first."); message += `\nAvailability: ${p.availability}.`; }
  return message;
}
export function linkedInSendWarning(db: Database, id: string, type: LinkedInMessageType, body: string) {
  const c = db.contacts.find(c => c.id === id); if (!c) return "Choose a contact.";
  if (c.archived || ["Closed", "Dormant"].includes(c.status) || linkedInState(c, db).status === "Closed") return "Reopen this relationship before recording new outreach.";
  const history = orderMessages(db.messages.filter(m => m.contactId === id && m.platform === "LinkedIn" && m.status !== "Draft"));
  const sent = history.filter(m => m.status === "Sent");
  if (type === "Connection request" && (sent.length || c.linkedInEvents?.some(e => ["Connection Request Sent", "Connected"].includes(e.status)) || linkedInState(c, db).connectionConfirmed)) return "A request, connection or message is already recorded. Review the history instead of repeating an introduction.";
  if (type === "First message" && (sent.some(m => m.linkedInType !== "Connection request") || c.linkedInEvents?.some(e => ["Messaged", "Replied", "Opportunity"].includes(e.status)))) return "A first message or conversation is already recorded. Choose Follow-up or Reply.";
  if (type === "Reply" && !history.some(m => m.direction === "in")) return "Import the actual LinkedIn reply before drafting a reply to it.";
  if (type === "Follow-up" && !sent.length) return "No LinkedIn outreach is recorded to follow up on.";
  if (sent.some(m => m.body.trim() === body.trim()) && body.trim()) return "This exact LinkedIn message is already marked sent.";
  const latestIn = history.findLastIndex(m => m.direction === "in");
  const unanswered = history.slice(latestIn + 1).filter(m => m.direction === "out");
  if (type === "Follow-up" && unanswered.filter(m => m.followUp).length >= 2) return "Two unanswered follow-ups are already recorded. Pause or wait for a real reply.";
  if (unanswered.some(m => m.date && Date.now() - Date.parse(m.date) < 86400000)) return "An unanswered LinkedIn message was recorded in the last 24 hours. Give them time to respond.";
  if (!body.trim()) return "Write a message first.";
  if (/\[[^\]]+\]/.test(body)) return "Replace the bracketed placeholders before marking sent.";
  if (type === "Connection request" && body.length > CONNECTION_NOTE_TARGET) return `Shorten the connection note to the app's ${CONNECTION_NOTE_TARGET}-character target. Check LinkedIn's live limit before sending.`;
  return "";
}
export function saveLinkedInDraft(db: Database, id: string, body: string, type: LinkedInMessageType) {
  if (!body.trim() || !db.contacts.some(c => c.id === id)) throw new Error("Choose a contact and write a draft.");
  const draft = db.messages.find(m => m.contactId === id && m.platform === "LinkedIn" && m.status === "Draft" && m.linkedInType === type);
  if (draft) { draft.body = body; draft.date = new Date().toISOString(); return; }
  db.messages.push({ id: crypto.randomUUID(), contactId: id, platform: "LinkedIn", direction: "out", status: "Draft", linkedInType: type, body, date: new Date().toISOString(), followUp: type === "Follow-up", provenance: [provenance("User-saved draft; not sent")] });
}
export function logLinkedInMessageSent(db: Database, id: string, body: string, type: LinkedInMessageType, date: string, confirmed: boolean) {
  if (!confirmed) throw new Error("Confirm you sent this exact message manually on LinkedIn.");
  const warning = linkedInSendWarning(db, id, type, body); if (warning) throw new Error(warning);
  if (!date || Number.isNaN(Date.parse(date)) || Date.parse(date) > Date.now()) throw new Error("Enter the actual sent date and time, not a future time.");
  const c = db.contacts.find(c => c.id === id)!;
  db.messages = db.messages.filter(m => !(m.contactId === id && m.platform === "LinkedIn" && m.status === "Draft" && m.linkedInType === type));
  db.messages.push({ id: crypto.randomUUID(), contactId: id, platform: "LinkedIn", direction: "out", status: "Sent", linkedInType: type, body: body.trim(), date: new Date(date).toISOString(), followUp: type === "Follow-up", provenance: [provenance("Explicitly confirmed manually sent; no LinkedIn API called")] });
  c.lastContacted = [c.lastContacted, new Date(date).toISOString()].filter(Boolean).sort().at(-1)!;
  if (["Found", "Ready"].includes(c.status)) c.status = "Contacted";
  updateLinkedInStatus(db, id, type === "Connection request" ? "Connection Request Sent" : "Messaged", new Date(date).toISOString(), `${type} manually marked sent`);
}
export function linkedInActions(db: Database) {
  return db.contacts.filter(c => !c.archived && (c.linkedin || db.messages.some(m => m.contactId === c.id && m.platform === "LinkedIn"))).flatMap(c => {
    const state = linkedInState(c, db); if (state.status === "Closed" || ["Closed", "Dormant"].includes(c.status)) return [];
    const history = orderMessages(db.messages.filter(m => m.contactId === c.id && m.platform === "LinkedIn" && m.status !== "Draft"));
    const last = history.at(-1), club = db.clubs.find(b => b.id === c.clubId)?.name || "their club";
    let title = "", reason = "", priority = 30;
    if (last?.direction === "in") { const a = analyzeLinkedInReply(last.body); title = a.requestedItems.includes("Highlights") ? `Send highlights to ${c.name}` : `Reply to ${c.name}`; reason = `Saved LinkedIn reply: ${a.nextAction}`; priority = a.trialMentioned ? 100 : 90; }
    else if (c.nextFollowUp && c.nextFollowUp <= day()) { title = `Follow up with ${c.name}`; reason = `Saved follow-up due ${c.nextFollowUp}`; priority = 80; }
    else if (state.status === "Follow-up Needed") { title = `Plan a follow-up with ${c.name}`; reason = "Manually recorded Follow-up Needed status"; priority = 65; }
    else if (last?.direction === "out" && last.linkedInType !== "Connection request" && last.date && !c.nextFollowUp && Date.now() - Date.parse(last.date) >= 6 * 86400000 && history.slice(history.findLastIndex(m => m.direction === "in") + 1).filter(m => m.followUp).length < 2) { title = `Consider a follow-up with ${c.name}`; reason = `${Math.floor((Date.now() - Date.parse(last.date)) / 86400000)} days since their last saved LinkedIn message from you; no later reply recorded`; priority = 55; }
    else if (!history.length && state.status === "Not Contacted") { title = `Send a connection request to ${c.role || c.name} at ${club}`; reason = "Saved profile; no LinkedIn outreach recorded"; }
    else if (state.connectionConfirmed && !history.some(m => m.direction === "out" && m.linkedInType !== "Connection request")) { title = `Prepare a first message to ${c.name}`; reason = "Connection explicitly confirmed; no first message recorded"; priority = 40; }
    return title ? [{ contactId: c.id, title, reason, priority, route: "LinkedIn" }] : [];
  }).concat((db.referrals || []).filter(r => {
    const target = db.contacts.find(c => c.id === r.toContactId);
    return target && !target.archived && !target.linkedin && !["Closed", "Dormant"].includes(target.status) && db.messages.some(m => m.contactId === r.fromContactId && m.platform === "LinkedIn" && m.direction === "in");
  }).map(r => ({ contactId: r.toContactId, title: `Research ${db.contacts.find(c => c.id === r.toContactId)?.name}, referred by ${db.contacts.find(c => c.id === r.fromContactId)?.name}`, reason: `Saved referral: ${r.evidence}`, priority: 70, route: "LinkedIn" }))).sort((a,b) => b.priority - a.priority);
}
/** Replace adapters only with authorized integrations. There is deliberately no send or scrape method. */
export interface LinkedInService {
  saveLinkedInProfile: typeof saveLinkedInProfile;
  linkLinkedInProfileToContact: typeof linkLinkedInProfileToContact;
  generateLinkedInMessage: typeof generateLinkedInMessage;
  logLinkedInMessageSent: typeof logLinkedInMessageSent;
  importLinkedInConversation: typeof importLinkedInConversation;
  analyzeLinkedInReply: typeof analyzeLinkedInReply;
}
export const manualLinkedInService: LinkedInService = { saveLinkedInProfile, linkLinkedInProfileToContact, generateLinkedInMessage, logLinkedInMessageSent, importLinkedInConversation, analyzeLinkedInReply };
