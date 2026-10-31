import type { Database, PlayerProfile } from "@/types";
export const targetMarkets = ["Australia", "UAE", "Netherlands", "Belgium", "Germany", "Croatia", "Portugal", "Spain", "USA", "England", "Pakistan", "Other"];
export const strengthTags = ["Dribbling", "Playmaking", "Creativity", "1v1 ability", "Ball carrying", "Chance creation", "Attacking movement"];
export const splitList = (s: string) => s.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
export function playerAge(p: PlayerProfile) {
  if (!p.dateOfBirth) return p.age || null;
  const birth = new Date(p.dateOfBirth + "T00:00:00");
  const now = new Date();
  return now.getFullYear() - birth.getFullYear() - Number(now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate()));
}
export function profileContext(p: PlayerProfile) {
  return {
    ...p, age: playerAge(p),
    achievements: [p.achievements, ...(p.achievementRecords || []).map(a => `${a.title}${a.team ? " — " + a.team : ""}${a.year ? " (" + a.year + ")" : ""}${a.description ? ": " + a.description : ""}`)].filter(Boolean).join("; "),
    availability: [p.availableForTrials && p.availableForTrials !== "Not confirmed" ? `Available for trials: ${p.availableForTrials}` : "", p.travelAvailability, p.upcomingTravel, p.travelCountries?.length ? `Travel countries: ${p.travelCountries.join(", ")}` : "", p.educationCommitments ? `Education commitments: ${p.educationCommitments}` : "", p.availability].filter(Boolean).join(". "),
  };
}
export function setupProgress(db: Database) {
  const p = db.player;
  const steps = [
    { label: "Complete player profile", route: "Player Profile", done: !!(p.confirmedAt && p.name && p.nationality && p.position && p.strengths && (p.age || p.dateOfBirth)) },
    { label: "Add CV & highlights", route: "Documents", done: ["Football CV", "Highlights"].every(kind => db.assets.some(a => a.kind === kind && (a.url || a.storageKey))) },
    { label: "Import previous outreach", route: "Import Outreach", done: db.contacts.some(c => !c.demo && c.provenance?.some(s => s.source.startsWith("Imported"))) },
    { label: "Choose target countries", route: "Player Profile", done: !!p.confirmedAt && p.markets.length > 0 },
    { label: "Start researching new clubs", route: "Discover", done: db.research.length > 0 },
  ];
  return { steps, percent: Math.round(steps.filter(s => s.done).length / steps.length * 100) };
}
