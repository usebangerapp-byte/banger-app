import { adminFromRequest } from "@/lib/server/admin";
import { titleKey } from "@/lib/titleKey";
import { renameTrackRow } from "@/lib/server/renameTrack";
import { notifyTrackReleased } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
const likeExact = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

/** All-time scans of this title (what the Charts count). */
async function realCount(sb: any, title: string) {
  const { count } = await sb.from("scan_events").select("id", { count: "exact", head: true })
    .ilike("track_title", likeExact(title)).neq("result_type", "not_found");
  return count || 0;
}

/**
 * Admin edits on any track, identified by its current title.
 * POST { title, artist?, newTitle?, newArtist?, hidden?, scans? (number | null), released? (boolean) }
 */
export async function POST(req: Request) {
  const { sb, user } = await adminFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const oldTitle = clean(b.title);
  if (!oldTitle) return Response.json({ ok: false, error: "Missing title" }, { status: 400 });
  const key = titleKey(oldTitle);

  // The uploaded track(s) behind this title, if any
  const { data: rows } = await sb.from("bpro_tracks").select("id,title,artist").ilike("title", likeExact(oldTitle)).limit(5);
  const track: any = (rows || [])[0] || null;

  let finalTitle = oldTitle;

  // 1) rename (title / artist) — everywhere
  const newTitle = clean(b.newTitle), newArtist = clean(b.newArtist);
  if (newTitle && (newTitle !== oldTitle || (newArtist && newArtist !== clean(b.artist)))) {
    if (track) {
      const r = await renameTrackRow(sb, track, newTitle, newArtist || track.artist || "");
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
    } else {
      // not uploaded on BANGER (world track): rename its scans + follows
      const upd: any = { track_title: newTitle };
      if (newArtist) upd.track_subtitle = newArtist;
      await sb.from("scan_events").update(upd).ilike("track_title", likeExact(oldTitle));
      await sb.from("track_followers").update({ track_title: newTitle, ...(newArtist ? { track_subtitle: newArtist } : {}) }).ilike("track_title", likeExact(oldTitle));
    }
    finalTitle = newTitle;
  }

  // 2) released / unreleased (uploaded tracks only)
  if (typeof b.released === "boolean" && track) {
    await sb.from("bpro_tracks").update({
      is_released: b.released, release_status: b.released ? "released" : "unreleased",
      release_source: "manual", release_checked_at: new Date().toISOString(),
    }).eq("id", track.id);
    await sb.from("scan_events").update({ result_type: b.released ? "recognized_world" : "recognized_unreleased" })
      .eq("track_title", finalTitle).eq("result_type", b.released ? "recognized_unreleased" : "recognized_world");
    if (b.released) await notifyTrackReleased(sb, finalTitle, track.artist).catch(() => {});
  }

  // 3) list overrides (hide / forced scan count) — stored under the final title's key
  if ("hidden" in b || "scans" in b) {
    // The number typed is what shows today; we store the difference with the real count,
    // so every new scan keeps adding on top (185 shown + 1 new scan = 186).
    const fk = titleKey(finalTitle);
    let bonus: number | null = null;
    if (!(b.scans === null || b.scans === "" || b.scans === undefined)) {
      const target = Math.max(0, Math.floor(Number(b.scans)) || 0);
      bonus = target - (await realCount(sb, finalTitle));
    }
    const { error } = await sb.from("track_overrides").upsert({ key: fk, hidden: !!b.hidden, scans: null, scan_bonus: bonus, updated_at: new Date().toISOString() });
    if (error && /scan_bonus/.test(error.message)) return Response.json({ ok: false, error: "Run the scan bonus SQL first" }, { status: 500 });
    if (error) return Response.json({ ok: false, error: "Run the track_overrides SQL first (" + error.message + ")" }, { status: 500 });
    if (fk !== key) await sb.from("track_overrides").delete().eq("key", key);
  }

  // 4) Staff pick: shown first when a list is completed at launch (picked earlier = higher)
  if (typeof b.pick === "boolean") {
    const fk = titleKey(finalTitle);
    const { data: cur } = await sb.from("track_overrides").select("key,staff_pick").eq("key", fk).maybeSingle();
    const value = b.pick ? (cur?.staff_pick || new Date().toISOString()) : null;
    const { error } = cur ? await sb.from("track_overrides").update({ staff_pick: value, updated_at: new Date().toISOString() }).eq("key", fk)
      : await sb.from("track_overrides").insert({ key: fk, hidden: false, staff_pick: value, updated_at: new Date().toISOString() });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, inBanger: !!track });
}

/** GET ?title= → current state for the edit sheet */
export async function GET(req: Request) {
  const { sb, user } = await adminFromRequest(req);
  if (!user) return Response.json({ ok: false }, { status: 403 });
  const title = clean(new URL(req.url).searchParams.get("title"));
  const { data: rows } = await sb.from("bpro_tracks").select("id,title,artist,is_released,release_status").ilike("title", likeExact(title)).limit(1);
  const t: any = (rows || [])[0] || null;
  const realScans = await realCount(sb, title);
  let ov: any = null;
  try {
    const r = await sb.from("track_overrides").select("hidden,scans,scan_bonus,staff_pick").eq("key", titleKey(title)).maybeSingle();
    ov = r.error ? (await sb.from("track_overrides").select("hidden,scans").eq("key", titleKey(title)).maybeSingle()).data : r.data;
  } catch {}
  return Response.json({
    ok: true, inBanger: !!t, artist: t?.artist || null,
    released: t ? (t.is_released === true || t.release_status === "released") : null,
    hidden: !!ov?.hidden, realScans, pick: !!ov?.staff_pick,
    scans: ov?.scan_bonus != null ? Math.max(0, realScans + ov.scan_bonus) : (ov?.scans ?? null),
  });
}
