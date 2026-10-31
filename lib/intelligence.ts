import type {
  Contact,
  Club,
  Database,
  Message,
  Platform,
  ReplyAnalysis,
} from "@/types";
import { profileContext } from "./player-profile";
import { normalizeIdentity } from "./identity";
import { orderMessages } from "./message-history";
export const stages = [
  "Found",
  "Ready",
  "Contacted",
  "Replied",
  "Follow-up",
  "Interested",
  "Opportunity",
  "Trial",
  "Closed",
  "Dormant",
] as const;
export const countries = [
  "Australia",
  "UAE",
  "England",
  "Netherlands",
  "Germany",
  "Belgium",
  "Croatia",
  "Portugal",
  "Spain",
  "USA",
  "Pakistan",
];
export const roles = [
  "Sporting Director",
  "Technical Director",
  "Head of Recruitment",
  "Academy Director",
  "Head Coach",
  "U21 Coach",
  "Youth Scout",
  "First-Team Scout",
  "General Football Department",
  "General Club Contact",
];
export function day(offset = 0, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function scoreContact(c: Contact, db: Database) {
  const club = db.clubs.find((x) => x.id === c.clubId);
  const r = roles.indexOf(c.role);
  const msgs = db.messages.filter(
    (m) => m.contactId === c.id && m.status !== "Draft",
  );
  const replied = msgs.some((m) => m.direction === "in");
  const breakdown = {
    "Role relevance": Math.max(4, 30 - (r < 0 ? 9 : r) * 3),
    "Pathway fit": db.player.markets.includes(c.country) ? 15 : 5,
    "Preferred league": db.player.preferredLeagues?.some(l => l.toLowerCase() === c.league.toLowerCase()) ? 5 : 0,
    "Club level": club?.level === "Semi-professional" ? 10 : 5,
    "Youth structure": club?.teams.some((t) => /U2|Academy/.test(t)) ? 10 : 0,
    "Direct contact":
      c.emailStatus === "Verified Public" && c.email
        ? 10
        : c.email || c.linkedin || c.instagram
          ? 4
          : 0,
    "Recruitment authority": /Director|Recruitment/.test(c.role) ? 10 : 0,
    Relationship: replied ? 5 : 0,
    "Active opportunity": db.opportunities.some(
      (o) => o.contactId === c.id && o.stage !== "Closed",
    )
      ? 10
      : 0,
    "Unanswered penalty": replied
      ? 0
      : -Math.max(0, msgs.filter((m) => m.direction === "out").length - 1) * 10,
  };
  return {
    score: Math.max(
      0,
      Math.min(
        100,
        Object.values(breakdown).reduce((a, b) => a + b, 0),
      ),
    ),
    breakdown,
  };
}
export function duplicateOf(c: Contact, list: Contact[]) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\/$/, "");
  return list.find(
    (x) =>
      x.id !== c.id &&
      ((norm(x.name) === norm(c.name) && x.clubId === c.clubId) ||
        (["email", "linkedin", "instagram"] as const).some(
          (k) => c[k] && x[k] && normalizeIdentity(c[k], k) === normalizeIdentity(x[k], k),
        )),
  );
}
export function analyzeReply(text: string, now = new Date()): ReplyAnalysis {
  const t = text.toLowerCase();
  const negative =
    /no (current |trial )?(opportunit|opening)|not (recruit|accept)|unfortunately|not interested|(?:don't|do not|not currently|don't currently).{0,45}(opportunit|opening|trial)/.test(
      t,
    );
  const requestedItems = [
    /\bcv\b|resume/.test(t) ? "Football CV" : "",
    /full.match|full matches/.test(t)
      ? /two|2/.test(t)
        ? "2 full matches"
        : "Full-match footage"
      : "",
    /highlight/.test(t) ? "Highlights" : "",
  ].filter(Boolean);
  const trialMentioned = !negative && /trial|train with/.test(t);
  const availabilityRequested =
    /when.*(australia|sydney|available|travel)|availability|when can|when will/.test(
      t,
    );
  const referral = /pass.*(recruit|coach)|refer/.test(t);
  const positive =
    !negative &&
    (requestedItems.length > 0 ||
      trialMentioned ||
      availabilityRequested ||
      referral ||
      /discuss.*profile|interested/.test(t));
  let followUpDate: string | null = null;
  const month = t.match(
    /(?:again|back|contact|in)\s+(?:in\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)/,
  );
  if (month) {
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const i = months.indexOf(month[1]);
    followUpDate = `${now.getFullYear() + (i <= now.getMonth() ? 1 : 0)}-${String(i + 1).padStart(2, "0")}-01`;
  }
  const explicit = text.match(/\b20\d{2}-\d{2}-\d{2}\b/);
  return {
    responseType: negative
      ? "No opening"
      : trialMentioned
        ? "Trial Discussion"
        : positive
          ? "Interested"
          : followUpDate
            ? "Future consideration"
            : "Waiting",
    sentiment: negative ? "Negative" : positive ? "Positive" : "Neutral",
    requestedItems,
    trialMentioned,
    availabilityRequested,
    deadlineMentioned: explicit?.[0] ?? null,
    personReferredTo: referral ? "Recruitment department" : null,
    nextAction: negative
      ? "Thank them and ask to stay on file"
      : requestedItems.length
        ? "Send " +
          requestedItems.join(" and ") +
          (availabilityRequested ? " and travel availability" : "")
        : trialMentioned
          ? "Discuss trial dates and requirements"
          : availabilityRequested
            ? "Share travel availability"
            : referral
              ? "Ask for the recruitment contact"
              : followUpDate
                ? "Reconnect on " + followUpDate
                : "Reply and clarify the next step",
    followUpDate,
    location: /sydney/.test(t)
      ? "Sydney"
      : /australia/.test(t)
        ? "Australia"
        : null,
  };
}
export function generateOutreach(
  c: Contact,
  db: Database,
  platform: Platform,
  style = "",
): string {
  const p = profileContext(db.player);
  const club = db.clubs.find((x) => x.id === c.clubId)!;
  const history = orderMessages(db.messages.filter((m) => m.contactId === c.id && m.status !== "Draft"));
  const reply = [...history].reverse().find((m) => m.direction === "in");
  const first = c.name.split(" ")[0];
  let body = "";
  if (reply) {
    const a = analyzeReply(reply.body);
    body =
      a.sentiment === "Negative"
        ? `Thanks for letting me know, ${first}. I appreciate your time. Would you be happy to keep my profile on file for a future opening?`
        : a.requestedItems.length
          ? `Thanks for getting back to me, ${first}. I'll put together the ${a.requestedItems.join(" and ")} you asked for. ${a.availabilityRequested ? `My availability: ${p.availability || "[add confirmed travel dates]"}. ` : ""}Is there anything specific your staff at ${club.name} would like to see?`
          : a.trialMentioned
            ? `Thanks, ${first} — I'd be keen to discuss the trial with ${club.name}. ${p.availability || "[add your availability]"}. Could you share the dates, requirements and who I should coordinate with?`
            : a.followUpDate
              ? `Thanks, ${first}. I'll get back in touch in ${new Date(a.followUpDate).toLocaleString("en", { month: "long" })}. Appreciate you keeping the door open.`
              : `Thanks for the update, ${first}. ${a.personReferredTo ? "Would you be able to introduce me to the recruitment contact?" : `What would be the best next step for my profile at ${club.name}?`}`;
  } else if (history.length) {
    body = `Hi ${first}, just following up on my earlier message about opportunities with ${club.name}${p.position ? " as a " + p.position.toLowerCase() : ""}. I'm still interested in ${/Academy|U21|Youth/.test(c.role) ? "developing with your youth setup" : "a chance to train or be evaluated"}.${p.shortTermObjective ? " My current objective: " + p.shortTermObjective + "." : ""} Would it help if I sent ${/Scout/.test(c.role) ? "a full match for your review" : "my player profile and footage"}? Thanks for your time.`;
  } else {
    const ask = /General/.test(c.role)
      ? "Could you point me towards the person responsible for player recruitment?"
      : /Scout/.test(c.role)
        ? "Would you be open to reviewing my footage and giving me an honest assessment of where I could fit?"
        : /Academy|U21|Youth/.test(c.role)
          ? `I'd like to learn whether your ${club.teams.find((t) => /U2/.test(t)) || "academy"} setup considers players for development or evaluation sessions.`
          : /Coach/.test(c.role)
            ? "Is there a route to join a training session or be considered for a trial with your team?"
            : `I'm exploring a senior pathway in ${club.country} and wanted to ask how your staff evaluates developing players for the ${club.league} level.`;
    body = `Hi ${first},\n\nI'm ${p.name || "[Player Name]"}, ${p.age ? `a ${p.age}-year-old ` : "a "}${p.foot ? p.foot.toLowerCase() + "-footed " : ""}${p.position.toLowerCase() || "[position]"}${p.nationality ? " from " + p.nationality : ""}${p.city ? ", based in " + p.city : ""}.${p.strengths ? " My game is built around " + p.strengths.toLowerCase() + "." : ""}${p.currentClub ? " I currently play for " + p.currentClub + "." : ""}${p.playingStyle ? " My playing style: " + p.playingStyle + "." : ""}\n\nI came across your ${c.role.toLowerCase() || "football"} role at ${club.name}. ${ask}\n\nI'd be happy to share my player profile if useful. Thanks for your time.`;
  }
  if (style === "Add Achievements" && p.achievements)
    body += `\n\nA little more context: ${p.achievements}`;
  if (style === "Mention Highlights") {
    const a = db.assets.find((a) => a.kind === "Highlights" && a.url);
    body += a
      ? `\n\nHighlights: ${a.url}`
      : "\n\nI can share highlights if useful.";
  }
  if (style === "Mention Trial Availability")
    body += `\n\nAvailability: ${p.availability || "[add confirmed availability]"}.`;
  if (platform === "Instagram DM" || style === "Shorter")
    body = body
      .replace(/\n+/g, " ")
      .replace(/ My game is built around [^.]+\./, "")
      .replace(/I came across your [^.]+\. /, "")
      .replace("Hi ", "Hey ");
  if (platform === "LinkedIn")
    body = body.replace(/ My game is built around [^.]+\./, "");
  if (style === "More Confident")
    body = body
      .replace("I'd be happy to", "I'm ready to")
      .replace("wanted to ask", "would like to discuss");
  if (style === "More Casual")
    body = body
      .replace("Hi ", "Hey ")
      .replace("Thanks for your time.", "Appreciate it!");
  if (style === "More Professional")
    body = body
      .replace("Hey ", "Hi ")
      .replace("Appreciate it!", "Thank you for your time.");
  if (platform === "Email") body += `\n\nBest,\n${p.name || "[Player Name]"}`;
  return body;
}
export function outreachWarning(c: Contact, db: Database) {
  const latest = orderMessages(db.messages.filter((m) => m.contactId === c.id && m.status !== "Draft"), true)[0];
  if (
    c.archived ||
    c.status === "Dormant" ||
    (c.status === "Closed" && latest?.direction !== "in")
  )
    return "Reopen this contact before preparing more outreach.";
  const sent = db.messages
    .filter((m) => m.contactId === c.id && m.status === "Sent")
    .sort((a, b) => b.date.localeCompare(a.date));
  if (sent[0] && Date.now() - new Date(sent[0].date).getTime() < 24 * 3600000)
    return "A message was recorded in the last 24 hours. Wait before contacting them again.";
  return "";
}
export function nextActions(db: Database) {
  return [
    ...db.conversations
      .filter((v) => {
        const msgs = orderMessages(db.messages.filter((m) => m.contactId === v.contactId && m.status !== "Draft"), true);
        return (
          msgs[0]?.direction === "in" &&
          db.contacts.some(
            (c) => c.id === v.contactId && !c.archived && c.status !== "Closed",
          )
        );
      })
      .map((v) => ({
        contactId: v.contactId,
        title: v.analysis.nextAction,
        reason: v.analysis.trialMentioned
          ? "Trial discussion"
          : v.analysis.sentiment === "Positive"
            ? "Positive reply"
            : "Reply waiting",
        priority: v.analysis.trialMentioned
          ? 100
          : v.analysis.sentiment === "Positive"
            ? 90
            : 60,
        route: "Inbox",
      })),
    ...db.followUps
      .filter((f) => f.status === "Scheduled" && f.date <= day())
      .map((f) => ({
        contactId: f.contactId,
        title:
          "Follow up with " +
          db.contacts.find((c) => c.id === f.contactId)?.name,
        reason: f.date < day() ? "Overdue" : "Due today",
        priority: 70,
        route: "Follow-ups",
      })),
  ].sort((a, b) => b.priority - a.priority);
}
