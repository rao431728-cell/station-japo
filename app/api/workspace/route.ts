import { env } from "cloudflare:workers";
import { z } from "zod";
import { validateDatabase } from "@/lib/repository";
import { researchJobSchema,marketStatuses } from "@/lib/research-model";

export const dynamic = "force-dynamic";
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
function owner(request: Request) { return request.headers.get("oai-authenticated-user-id"); }
const record = z.object({ id: z.string().min(1).max(200) }).passthrough();
const payload = z.object({ revision: z.number().int().nonnegative(), db: z.object({
  version: z.literal(1), workspaceMode: z.literal("personal").optional(),
  researchJobs:z.array(researchJobSchema).optional(),marketPriorities:z.record(z.enum(marketStatuses)).optional(),outreachQueue:z.array(z.object({id:z.string(),contactId:z.string(),date:z.string(),researchJobId:z.string()})).optional(),
  player: z.object({ name: z.string(), age: z.number(), nationality: z.string(), city: z.string(), position: z.string(), foot: z.string(), strengths: z.string(), goals: z.string(), achievements: z.string(), availability: z.string(), markets: z.array(z.string()) }).passthrough(),
  clubs: z.array(record), contacts: z.array(record), messages: z.array(record), conversations: z.array(record), followUps: z.array(record), opportunities: z.array(record), research: z.array(record), assets: z.array(record), notifications: z.array(record), audit: z.array(record), referrals: z.array(record).optional(),
}).passthrough() });
export async function GET(request: Request) {
  const id = owner(request); if (!id) return response({ error: "Sign in to open your saved workspace." }, 401);
  try {
    if (!env.DB) throw new Error("DB unavailable");
    const row = await env.DB.prepare("SELECT data, revision FROM workspaces WHERE owner_id = ?").bind(id).first<{ data: string; revision: number }>();
    return response({ db: row ? JSON.parse(row.data) : null, revision: row?.revision || 0 });
  } catch(e) { console.error("Workspace load failed", e); return response({ error: "Workspace storage is temporarily unavailable. Your records have not been changed." }, 503); }
}
export async function PUT(request: Request) {
  const id = owner(request); if (!id) return response({ error: "Sign in to save your workspace." }, 401);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return response({ error: "Invalid origin" }, 403);
  try {
    if (!env.DB) throw new Error("DB unavailable");
    if (Number(request.headers.get("content-length")) > 4500000) return response({ error: "Workspace exceeds the 4 MB limit. Export a backup." }, 413);
    const raw = await request.text(); if (raw.length > 4000000) return response({ error: "Workspace exceeds the 4 MB limit. Export a backup." }, 413);
    const { db, revision } = payload.parse(JSON.parse(raw));
    validateDatabase(db);
    if (db.contacts.some(c => c.demo)) return response({ error: "Demo records cannot be saved as personal history." }, 400);
    const updated = revision === 0
      ? await env.DB.prepare("INSERT INTO workspaces (owner_id, data, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(owner_id) DO NOTHING").bind(id, JSON.stringify(db), new Date().toISOString()).run()
      : await env.DB.prepare("UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?").bind(JSON.stringify(db), new Date().toISOString(), id, revision).run();
    if (!updated.meta.changes) return response({ error: "This workspace changed in another tab or device. Reload and retry; your unsaved input is still here." }, 409);
    return response({ revision: revision + 1 });
  } catch(e) { if (e instanceof z.ZodError || e instanceof SyntaxError) return response({ error: "Invalid workspace data; nothing was saved." }, 400); console.error("Workspace save failed", e); return response({ error: "Could not save to workspace storage. Keep this page open and retry." }, 503); }
}
