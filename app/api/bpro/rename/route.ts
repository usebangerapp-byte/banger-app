import { adminClient, userFromRequest } from "@/lib/server/notify";
import { dupKey } from "@/lib/dupKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renames one of MY uploads everywhere the name is used:
 * the track, its ACR fingerprints (so scans return the new name), past scans and follows.
 */
async function renameInAcr(oldTitle: string, title: string, artist: string) {
  const token = process.env.ACR_CONSOLE_TOKEN, bucket = process.env.ACR_BUCKET_ID;
  if (!token || !bucket) return 0;
  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
  const norm = (v: any) => String(v || "").toLowerCase().trim();
  try {
    const res = await fetch(`https://api-v2.acrcloud.com/api/buckets/${bucket}/files?search=${encodeURIComponent(oldTitle)}&per_page=100`, { headers });
    const j: any = await res.json().catch(() => null);
    const files = (Array.isArray(j?.data) ? j.data : []).filter((f: any) => norm(f.title) === norm(oldTitle));
    let n = 0;
    for (const f of files) {
      const r = await fetch(`https://api-v2.acrcloud.com/api/buckets/${bucket}/files/${f.id}`, {
        method: "PUT", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ title, user_defined: { ...(f.user_defined || {}), artist } }),
      });
      if (r.ok) n++;
    }
    return n;
  } catch { return 0; }
}

export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const artist = String(body?.artist || "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (!title || !artist) return Response.json({ ok: false, error: "Title and artist are required" }, { status: 400 });

  const { data: track } = await sb.from("bpro_tracks").select("id,title,artist,uploader_email").eq("id", body?.track_id).maybeSingle();
  if (!track) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  if (String(track.uploader_email || "").toLowerCase() !== String(user.email || "").toLowerCase()) {
    return Response.json({ ok: false, error: "Not your upload" }, { status: 403 });
  }
  if (track.title === title && track.artist === artist) return Response.json({ ok: true });

  // The new name can't be another song already on BANGER.
  const { data: all } = await sb.from("bpro_tracks").select("id,title,artist").neq("id", track.id).limit(20000);
  const k = dupKey(title, artist);
  if ((all || []).some((r: any) => dupKey(r.title, r.artist) === k)) {
    return Response.json({ ok: false, error: "Another track already has this name on BANGER" }, { status: 409 });
  }

  const { error } = await sb.from("bpro_tracks").update({ title, artist }).eq("id", track.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  if (track.title !== title) {
    await sb.from("scan_events").update({ track_title: title, track_subtitle: artist }).eq("track_title", track.title);
    await sb.from("track_followers").update({ track_title: title }).eq("track_title", track.title);
  } else {
    await sb.from("scan_events").update({ track_subtitle: artist }).eq("track_id", track.id);
  }
  const acr = await renameInAcr(track.title, title, artist);
  return Response.json({ ok: true, acr_updated: acr });
}
