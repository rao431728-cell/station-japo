import assert from "node:assert/strict";
import { createEmpty } from "../data/empty";
import { createSeed } from "../data/seed";
import { dashboardMetrics, personalRecords } from "./provenance";
import {
  localRepository,
  loadDemoData,
  PERSONAL_KEY,
  DEMO_KEY,
} from "./repository";
import { importHistory } from "./import-history";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
  configurable: true,
});
const counts = (db: ReturnType<typeof createEmpty>) =>
  Object.fromEntries(
    dashboardMetrics(db).map((m) => [m.label, m.records.length]),
  );
assert.deepEqual(
  Object.values(counts(localRepository.load())),
  [0, 0, 0, 0, 0, 0],
);
assert.equal(
  memory.has(DEMO_KEY),
  false,
  "Fresh installation must not initialize demo storage",
);
const legacy = createSeed();
const club = { ...legacy.clubs[0], id: "real-club", name: "User club" };
const contact = {
  ...legacy.contacts[0],
  id: "real-contact",
  clubId: club.id,
  name: "User contact",
  demo: false,
  status: "Replied" as const,
};
legacy.clubs.push(club);
legacy.contacts.push(contact);
legacy.messages.push(
  ...[1, 2].map((i) => ({
    ...legacy.messages[18],
    id: "real-reply-" + i,
    contactId: contact.id,
    body: "Actual saved reply " + i,
  })),
);
legacy.conversations.push({
  ...legacy.conversations[0],
  id: "real-conv",
  contactId: contact.id,
});
legacy.opportunities.push({
  ...legacy.opportunities[1],
  id: "real-trial",
  contactId: contact.id,
});
legacy.player.name = "Real player";
legacy.assets[0].url = "https://example.com/real-cv";
memory.clear();
const original = JSON.stringify(legacy);
memory.set("station-japo-v1", original);
const migrated = localRepository.load();
assert.equal(
  memory.get("station-japo-v1"),
  original,
  "Migration must preserve recoverable original storage",
);
assert.equal(migrated.contacts.length, 1);
assert.equal(migrated.messages.length, 2);
assert.equal(migrated.clubs.length, 1);
assert.equal(migrated.player.name, "Real player");
assert.equal(migrated.assets[0].url, "https://example.com/real-cv");
assert.equal(
  counts(migrated)["Replies received"],
  2,
  "Count inbound messages, not conversations",
);
assert.equal(counts(migrated)["Trial discussions"], 1);
const beforeDemo = memory.get(PERSONAL_KEY);
const demo = loadDemoData();
assert.ok(demo.contacts.length > 0);
assert.equal(
  memory.get(PERSONAL_KEY),
  beforeDemo,
  "Loading demo must never overwrite user data",
);
assert.equal(localRepository.load().contacts[0].name, "User contact");
assert.deepEqual(
  Object.values(counts(createSeed())),
  [0, 0, 0, 0, 0, 0],
  "Demo fixtures cannot contribute to personal metrics",
);
const db = createEmpty();
db.clubs.push(club, { ...club, id: "unassociated" });
db.contacts.push(contact, { ...contact, id: "second-contact" });
db.messages.push(
  { ...legacy.messages[0], id: "sent", contactId: contact.id },
  {
    ...legacy.messages[0],
    id: "draft",
    contactId: contact.id,
    status: "Draft",
  },
);
db.conversations.push({
  ...legacy.conversations[0],
  id: "conv",
  contactId: contact.id,
});
db.opportunities.push(
  ...["Trial Discussion", "Trial Confirmed", "Trial Rejected", "Closed"].map(
    (stage) => ({
      ...legacy.opportunities[0],
      id: stage,
      contactId: contact.id,
      stage,
    }),
  ),
);
assert.equal(counts(db)["Contacts researched"], 2);
assert.equal(counts(db)["Clubs"], 1);
assert.equal(counts(db)["Messages sent"], 1);
assert.equal(counts(db)["Trial discussions"], 2);
db.contacts[0].status = "Dormant";
assert.equal(counts(db)["Active conversations"], 0);
db.contacts[0].status = "Closed";
assert.equal(counts(db)["Active conversations"], 0);
const imported = createEmpty();
const added = importHistory(imported, legacy);
assert.equal(imported.contacts.length, 1);
assert.equal(added, 2);
assert.equal(
  importHistory(imported, legacy),
  0,
  "Repeated imports must deduplicate messages",
);
assert.equal(imported.messages.length, 2);
assert.throws(() =>
  importHistory(imported, {
    version: 1,
    clubs: [],
    contacts: [{}],
    messages: [],
  }),
);
assert.throws(
  () => importHistory(createEmpty(), { ...legacy, workspaceMode: "demo" }),
  /DEMO DATA/,
);
assert.deepEqual(
  Object.values(counts({ ...legacy, workspaceMode: "demo" })),
  [0, 0, 0, 0, 0, 0],
);
console.log(
  "Passed: empty installs, persisted zero metrics, migration backup, preservation of real data, demo isolation, inbound reply counts, unique associated clubs, exact trial stages, inactive conversations, import validation and deduplication.",
);
