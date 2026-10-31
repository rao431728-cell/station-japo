import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
const fail = (error: string, status: number) => Response.json({ error }, { status });
export async function POST(request: Request) {
  const owner = request.headers.get("oai-authenticated-user-id");
  if (!owner) return fail("Sign in before uploading files.", 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Invalid origin", 403);
  try {
    if (!env.BUCKET) return fail("File storage unavailable.", 503);
    if (Number(request.headers.get("content-length")) > 11000000) return fail("Files must be under 10 MB. Use share links for videos.", 413);
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || file.size > 10000000 || !file.size) return fail("Choose a file under 10 MB.", 400);
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) return fail("Use PDF, Word, PNG, JPG or WebP. Save a link for video footage.", 400);
    const id = crypto.randomUUID();
    await env.BUCKET.put(`${owner}/${id}`, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { filename: file.name.slice(0, 200) } });
    return Response.json({ storageKey: id, fileName: file.name });
  } catch(e) { console.error("Asset upload failed", e); return fail("Upload failed. No asset has been added to your profile.", 503); }
}
export async function GET(request: Request) {
  const owner = request.headers.get("oai-authenticated-user-id"); if (!owner) return fail("Sign in to view this file.", 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[\da-f-]{36}$/i.test(id)) return fail("Invalid file", 400);
  try {
    const file = await env.BUCKET?.get(`${owner}/${id}`); if (!file) return fail("File not found", 404);
    return new Response(file.body, { headers: { "Content-Type": file.httpMetadata?.contentType || "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.customMetadata?.filename || "asset")}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch(e) { console.error("Asset read failed", e); return fail("File storage unavailable", 503); }
}
