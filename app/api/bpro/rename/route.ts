import { adminClient, userFromRequest } from "@/lib/server/notify";
import { renameTrackRow } from "@/lib/server/renameTrack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renames one of MY uploads everywhere the name is used:
 * the track, its ACR fingerprints (so scans return the new name), past scans and follows.
 */
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

  const r = await renameTrackRow(sb, track, title, artist);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
  return Response.json(r);
}
