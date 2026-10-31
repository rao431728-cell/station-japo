import assert from "node:assert/strict";
import { createSeed } from "../data/seed";
import {
  analyzeReply,
  duplicateOf,
  generateOutreach,
  scoreContact,
  outreachWarning,
} from "./intelligence";
const db = createSeed();
assert.equal(db.contacts.length, 48);
assert.equal(db.clubs.length, 16);
assert.equal(db.conversations.length, 8);
const a = analyzeReply(
  "Thanks for reaching out. Please send your CV and two full matches and let me know when you will be in Sydney.",
);
assert.deepEqual(a.requestedItems, ["Football CV", "2 full matches"]);
assert.equal(a.availabilityRequested, true);
assert.equal(a.sentiment, "Positive");
assert.equal(a.location, "Sydney");
assert.equal(
  analyzeReply("We don't currently have any trial opportunities available.")
    .sentiment,
  "Negative",
);
assert.equal(
  analyzeReply("Contact me again in January", new Date("2026-09-22"))
    .followUpDate,
  "2027-01-01",
);
const draft = generateOutreach(db.contacts[0], db, "Email");
assert.match(draft, /two|2 full matches/);
assert.doesNotMatch(draft, /I'm.*17-year-old/);
const copy = { ...db.contacts[0], id: "new", name: "  OLIVER BENNETT  " };
assert.equal(duplicateOf(copy, db.contacts)?.id, "c0");
assert.equal(
  scoreContact(db.contacts[0], db).score,
  scoreContact(db.contacts[0], db).score,
);
const fresh = db.contacts[20];
const before = scoreContact(fresh, db).score;
db.messages.push(
  ...[1, 2, 3].map((i) => ({
    id: "penalty" + i,
    contactId: fresh.id,
    platform: "Email" as const,
    direction: "out" as const,
    body: "Test",
    date: new Date().toISOString(),
    status: "Sent" as const,
    followUp: i > 1,
  })),
);
assert.ok(scoreContact(fresh, db).score < before);
assert.match(outreachWarning(fresh, db), /24 hours/);
assert.ok(db.contacts.every((c) => !c.email && c.confidence === "Unverified"));
console.log(
  "Passed: seed integrity, reply extraction, negative replies, January scheduling, relationship-aware drafts, duplicate prevention, deterministic priority, unanswered penalty and repeat-contact guard.",
);
