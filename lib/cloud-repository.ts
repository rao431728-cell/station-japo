import type { Database } from "@/types";
import { validateDatabase } from "./repository";
export async function loadWorkspace(): Promise<{ db: Database | null; revision: number }> {
  const res = await fetch("/api/workspace", { cache: "no-store" });
  const data = await res.json() as { error?: string; db: Database | null; revision: number }; if (!res.ok) throw new Error(data.error || "Could not load workspace.");
  return { db: data.db ? validateDatabase(data.db) : null, revision: data.revision };
}
export async function saveWorkspace(db: Database, revision: number): Promise<number> {
  const res = await fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ db: { ...db, workspaceMode: "personal" }, revision }) });
  const data = await res.json() as { error?: string; revision: number }; if (!res.ok) throw new Error(data.error || "Could not save workspace.");
  return data.revision;
}
