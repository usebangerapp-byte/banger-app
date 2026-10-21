import { adminClient, userFromRequest } from "@/lib/server/notify";
import { isPro } from "@/lib/server/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { path, title, artist } → registers the FULL track with ACR in one go (fast bulk upload), then deletes the temp file
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!(await isPro(sb, user.id))) return Response.json({ ok: false, error: "Pro only" }, { status: 403 });

  const { path, title, artist } = await req.json().catch(() => ({}));
  const p = String(path || "");
  if (!p.startsWith(`${user.id}/`) || !title) return Response.json({ ok: false, error: "Bad request" }, { status: 400 });

  const token = process.env.ACR_CONSOLE_TOKEN, bucketId = process.env.ACR_BUCKET_ID;
  if (!token || !bucketId) return Response.json({ ok: false, error: "Missing ACR env" }, { status: 500 });

  const { data: blob, error } = await sb.storage.from("acr-sources").download(p);
  if (error || !blob) return Response.json({ ok: false, error: error?.message || "File not found" }, { status: 404 });

  try {
    const fd = new FormData();
    fd.append("file", blob, p.split("/").pop() || "track.mp3");
    fd.append("title", String(title));
    fd.append("artist", String(artist || "Unknown"));
    fd.append("data_type", "audio");
    const res = await fetch(`https://api-v2.acrcloud.com/api/buckets/${bucketId}/files`, {
      method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, body: fd,
    });
    const text = await res.text();
    let j: any = null; try { j = JSON.parse(text); } catch {}
    if (!res.ok) return Response.json({ ok: false, error: j?.error || j?.message || "ACR upload failed" }, { status: 500 });
    return Response.json({ ok: true });
  } finally {
    await sb.storage.from("acr-sources").remove([p]).catch(() => {});
  }
}
