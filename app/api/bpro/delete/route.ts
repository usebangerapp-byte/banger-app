import { adminClient, userFromRequest } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Removes this title's fingerprints from the ACR bucket (best effort). */
async function removeFromAcr(title: string, artist: string | null) {
  const token = process.env.ACR_CONSOLE_TOKEN, bucket = process.env.ACR_BUCKET_ID;
  if (!token || !bucket) return 0;
  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
  try {
    const res = await fetch(`https://api-v2.acrcloud.com/api/buckets/${bucket}/files?search=${encodeURIComponent(title)}&per_page=100`, { headers });
    const j: any = await res.json().catch(() => null);
    const norm = (v: any) => String(v || "").toLowerCase().trim();
    const ids = (Array.isArray(j?.data) ? j.data : [])
      .filter((f: any) => norm(f.title) === norm(title) && (!artist || !f.artist || norm(f.artist) === norm(artist) ||
        norm(f?.user_defined?.artist) === norm(artist)))
      .map((f: any) => f.id).filter(Boolean);
    if (!ids.length) return 0;
    await fetch(`https://api-v2.acrcloud.com/api/buckets/${bucket}/files/${ids.join(",")}`, { method: "DELETE", headers });
    return ids.length;
  } catch { return 0; }
}

// POST { track_id } → delete one of MY uploads
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { track_id } = await req.json().catch(() => ({}));

  const { data: track } = await sb.from("bpro_tracks").select("id,title,artist,uploader_email,snippet_path").eq("id", track_id).maybeSingle();
  if (!track) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  if (String(track.uploader_email || "").toLowerCase() !== String(user.email || "").toLowerCase()) {
    return Response.json({ ok: false, error: "Not your upload" }, { status: 403 });
  }

  // audio snippets in storage
  const { data: snips } = await sb.from("bpro_track_snippets").select("snippet_path").eq("track_id", track.id);
  const paths = Array.from(new Set([...(snips || []).map((s: any) => s.snippet_path), track.snippet_path].filter(Boolean)));
  if (paths.length) await sb.storage.from("bpro_uploads").remove(paths).catch(() => {});
  await sb.from("bpro_track_snippets").delete().eq("track_id", track.id);
  const { error } = await sb.from("bpro_tracks").delete().eq("id", track.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // Only remove the fingerprints if no other upload still uses this title (duplicates keep working)
  const { data: twins } = await sb.from("bpro_tracks").select("id").ilike("title", track.title).limit(1);
  const removed = twins?.length ? 0 : await removeFromAcr(track.title, track.artist);

  return Response.json({ ok: true, acr_removed: removed });
}
