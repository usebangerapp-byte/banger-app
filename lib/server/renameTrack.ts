import { dupKey } from "@/lib/dupKey";
import { existingKeys, saveDupKey } from "@/lib/server/dups";

export async function renameInAcr(oldTitle: string, title: string, artist: string) {
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


/** Renames a BANGER track everywhere: the row, its fingerprints, past scans and follows. */
export async function renameTrackRow(sb: any, track: { id: string; title: string; artist: string | null }, title: string, artist: string) {
  if (track.title === title && track.artist === artist) return { ok: true as const };
  const k = dupKey(title, artist);
  if ((await existingKeys(sb, [k], track.id)).has(k)) return { ok: false as const, status: 409, error: "Another track already has this name on BANGER" };
  const { error } = await sb.from("bpro_tracks").update({ title, artist }).eq("id", track.id);
  if (error) return { ok: false as const, status: 500, error: error.message };
  await saveDupKey(sb, track.id, title, artist);
  if (track.title !== title) {
    await sb.from("scan_events").update({ track_title: title, track_subtitle: artist }).eq("track_title", track.title);
    await sb.from("track_followers").update({ track_title: title }).eq("track_title", track.title);
  } else {
    await sb.from("scan_events").update({ track_subtitle: artist }).eq("track_id", track.id);
  }
  const acr = await renameInAcr(track.title, title, artist);
  return { ok: true as const, acr_updated: acr };
}
