import { lookupRelease } from "@/lib/server/catalog";
import { notifyTrackReleased } from "@/lib/server/notify";
import { titleKey } from "@/lib/titleKey";

/**
 * Release status of the named tracks in the Sets:
 * BANGER's own base first, then Deezer / iTunes (a strict title + artist match = it's out).
 * When a track comes out, everyone who followed it or asked "ID?" on it is told.
 */
export async function checkSetTracks(sb: any, opts: { setId?: string; limit?: number } = {}) {
  const limit = opts.limit ?? 20;
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString();
  let q = sb.from("setlist_tracks").select("id,setlist_id,title,artist,released,release_checked_at")
    .not("title", "is", null).or("released.is.null,released.eq.false")
    .or(`release_checked_at.is.null,release_checked_at.lt.${weekAgo}`)
    .or("release_source.is.null,release_source.neq.manual").limit(limit);   // a status set by hand is kept
  if (opts.setId) q = q.eq("setlist_id", opts.setId);
  const { data: rows, error } = await q;
  if (error || !rows?.length) return 0;

  const { data: base } = await sb.from("bpro_tracks").select("title,is_released,release_status,release_date").limit(20000);
  const inBase = new Map<string, any>();
  for (const b of (base || []) as any[]) inBase.set(titleKey(b.title), b);

  let changed = 0;
  // a few at a time so one run stays short
  for (let i = 0; i < rows.length; i += 8) {
    await Promise.all(rows.slice(i, i + 8).map(async (t: any) => {
      const b = inBase.get(titleKey(t.title));
      // true = out · false = known unreleased (BANGER upload, or a release date still to come)
      // null = not found in the catalogues: we don't know, so no "Unreleased" label is shown
      let released: boolean | null = null, date: string | null = null, label: string | null = null;
      if (b && (b.is_released || b.release_status === "released")) { released = true; date = b.release_date || null; }
      else if (b) released = false;
      else {
        const r = await Promise.race([lookupRelease(t.title, t.artist || ""), new Promise<null>((res) => setTimeout(() => res(null), 9000))]).catch(() => null);
        if (r?.releaseDate) { released = new Date(r.releaseDate).getTime() <= Date.now(); date = r.releaseDate; label = r.label || null; }
      }
      await sb.from("setlist_tracks").update({ released, release_date: date, release_label: label, release_checked_at: new Date().toISOString() }).eq("id", t.id);
      if (released === true && t.released !== true && t.release_checked_at) {
        // it just came out: followers of the title + people who asked "ID?" on it
        changed++;
        await notifyTrackReleased(sb, t.title, t.artist).catch(() => {});
        const { data: askers } = await sb.from("setlist_reactions").select("user_id").eq("kind", "ask").eq("track_id", t.id);
        const ids = [...new Set((askers || []).map((a: any) => a.user_id))];
        if (ids.length) {
          const rows = ids.map((user_id) => ({ user_id, type: "track_released", track_title: t.title, title: t.title, message: t.artist ? `${t.artist} — out now. Tap to listen.` : "Out now. Tap to listen.", read: false }));
          try { await sb.from("notifications").insert(rows); } catch {}
        }
      }
    }));
  }
  return changed;
}
