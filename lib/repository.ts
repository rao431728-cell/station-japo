import type { Database } from "@/types";
import { createEmpty } from "@/data/empty";
import { createSeed } from "@/data/seed";
import { personalRecords, type WorkspaceMode } from "./provenance";
export const PERSONAL_KEY = "station-japo-personal-v2";
export const DEMO_KEY = "station-japo-demo-v2";
export interface Repository {
  load(mode?: WorkspaceMode): Database;
  save(db: Database, mode?: WorkspaceMode): void;
}
export function validateDatabase(value: unknown): Database {
  const v = value as Database;
  if (
    !v ||
    v.version !== 1 ||
    !v.player ||
    ![
      "clubs",
      "contacts",
      "messages",
      "conversations",
      "followUps",
      "opportunities",
      "research",
      "assets",
      "notifications",
      "audit",
    ].every((k) => Array.isArray(v[k as keyof Database]))
  )
    throw new Error(
      "Unsupported workspace format. Existing records have not been changed.",
    );
  return v;
}
export const localRepository: Repository = {
  load(mode = "personal") {
    const key = mode === "demo" ? DEMO_KEY : PERSONAL_KEY;
    const raw = localStorage.getItem(key);
    if (raw) return validateDatabase(JSON.parse(raw));
    // Keep the original legacy store untouched as a recoverable backup.
    const legacy =
      mode === "personal" ? localStorage.getItem("station-japo-v1") : null;
    const db = legacy
      ? personalRecords(validateDatabase(JSON.parse(legacy)))
      : createEmpty();
    localStorage.setItem(key, JSON.stringify(db));
    return db;
  },
  save(db, mode = "personal") {
    localStorage.setItem(
      mode === "demo" ? DEMO_KEY : PERSONAL_KEY,
      JSON.stringify({ ...db, workspaceMode: mode }),
    );
  },
};
/** Called only by the explicit Load Demo Data action. Never modifies personal storage. */
export function loadDemoData() {
  if (!localStorage.getItem(DEMO_KEY))
    localRepository.save(createSeed(), "demo");
  return localRepository.load("demo");
}
export function downloadBackup(
  db: Database,
  name = "station-japo-backup.json",
) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
