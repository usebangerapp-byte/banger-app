import { adminClient, userFromRequest } from "@/lib/server/notify";
import { isPro } from "@/lib/server/pro";
import { ADMIN_EMAILS } from "@/lib/admins";
import { dupKey } from "@/lib/dupKey";
import { FREE } from "@/lib/plan";
import { lookupRelease } from "@/lib/server/catalog";
import { checkSetTracks } from "@/lib/server/setRelease";
import { titleKey } from "@/lib/titleKey";
export const maxDuration = 60;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMINS = (process.env.ADMIN_EMAILS || ADMIN_EMAILS.join(",")).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const isAdmin = (u: any) => !!u && ADMINS.includes(String(u.email || "").toLowerCase());
const clean = (v: any, n = 140) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

async function notify(sb: any, userIds: string[], type: string, title: string, message: string) {
  if (!userIds.length) return;
  const rows = userIds.map((user_id) => ({ user_id, type, track_title: title, title, message, body: message, read: false }));
  const { error } = await sb.from("notifications").insert(rows);
  if (error) { try { await sb.from("notifications").insert(rows.map(({ title: _t, body: _b, ...r }) => r)); } catch {} }
}

/** All tracks known → the set is unlocked: stamp it and tell its followers (once). */
async function checkUnlocked(sb: any, setId: string) {
  const { data: set } = await sb.from("setlists").select("id,title,venue,unlocked_at").eq("id", setId).maybeSingle();
  if (!set || set.unlocked_at) return;
  const { data: tracks } = await sb.from("setlist_tracks").select("title").eq("setlist_id", setId);
  if (!tracks?.length || tracks.some((t: any) => !t.title)) return;
  await sb.from("setlists").update({ unlocked_at: new Date().toISOString() }).eq("id", setId);
  const { data: fol } = await sb.from("setlist_reactions").select("user_id").eq("setlist_id", setId).eq("kind", "follow");
  const name = set.venue ? `${set.title} · ${set.venue}` : set.title;
  await notify(sb, [...new Set((fol || []).map((f: any) => f.user_id))] as string[], `set_unlocked:${setId}`, name, "Unlocked — every track is known.");
}

/**
 * How much one person's name counts (2 points needed before an admin is asked):
 *  Pro = 2 · free account older than 7 days with 5+ scans = 1 · brand-new account = 0
 *  3+ rejected names = 0 (someone trying to mess with the sets stops counting).
 */
async function trustWeight(sb: any, user: any) {
  const { count: rejected } = await sb.from("setlist_suggestions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "rejected");
  if ((rejected || 0) >= 3) return 0;
  if (await isPro(sb, user.id)) return 2;
  const age = Date.now() - new Date(user.created_at || Date.now()).getTime();
  const { count: scans } = await sb.from("scan_events").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return age > 7 * 86400000 && (scans || 0) >= 5 ? 1 : 0;
}

async function load(sb: any, id: string, user: any) {
  const { data: set } = await sb.from("setlists").select("*").eq("id", id).maybeSingle();
  if (!set) return null;
  const [{ data: tracks }, { data: reacts }] = await Promise.all([
    sb.from("setlist_tracks").select("*").eq("setlist_id", id).order("position"),
    sb.from("setlist_reactions").select("user_id,kind,track_id,at_sec").eq("setlist_id", id).limit(20000),
  ]);
  const trackIds = (tracks || []).map((t: any) => t.id);
  const { data: sug } = trackIds.length ? await sb.from("setlist_suggestions").select("track_id,user_id,title,artist,key,weight,verified").eq("status", "open").in("track_id", trackIds) : { data: [] };
  const pro = user ? await isPro(sb, user.id) : false;
  const admin = isAdmin(user);
  const r = (reacts || []) as any[];
  const fires = r.filter((x) => x.kind === "fire" && x.at_sec != null).map((x) => x.at_sec as number);
  const list = (tracks || []) as any[];
  const out = list.map((t, i) => {
    const end = list[i + 1]?.start_sec ?? Infinity;
    const groups = new Map<string, any>();
    for (const s of (sug || []).filter((s: any) => s.track_id === t.id)) {
      const g = groups.get(s.key) || { key: s.key, title: s.title, artist: s.artist, count: 0, weight: 0, verified: false, mine: false };
      g.count++; g.weight += Number(s.weight ?? 1); g.verified = g.verified || !!s.verified;
      if (user && s.user_id === user.id) g.mine = true; groups.set(s.key, g);
    }
    const row: any = {
      id: t.id, position: t.position, start_sec: t.start_sec, title: t.title, artist: t.artist,
      asks: r.filter((x) => x.kind === "ask" && x.track_id === t.id).length,
      asked: !!user && r.some((x) => x.kind === "ask" && x.track_id === t.id && x.user_id === user.id),
      fires: t.start_sec == null ? 0 : fires.filter((f) => f >= t.start_sec && f < end).length,
      suggestions: [...groups.values()].sort((a, b) => b.count - a.count),
      named: !!(t.named_by && t.named_by.length),
    };
    // Free accounts: the first tracks in full; after that the KNOWN titles are locked,
    // but the IDs stay open so everyone can help name them.
    if (!pro && i >= FREE.chartRows && t.title) return { id: t.id, position: t.position, start_sec: t.start_sec, locked: true, known: true };
    return row;
  });
  // Status of named tracks: BANGER base first (scannable = uploaded on BANGER), else the stored catalogue check
  const named = list.filter((t) => t.title);
  const { data: base } = named.length ? await sb.from("bpro_tracks").select("title,is_released,release_status").limit(20000) : { data: [] };
  const baseMap = new Map<string, any>();
  for (const b of (base || []) as any[]) baseMap.set(titleKey(b.title), b);
  const titles = [...new Set(named.map((t) => t.title))];
  const { data: fol } = titles.length ? await sb.from("track_followers").select("track_title").in("track_title", titles) : { data: [] };
  for (const row of out as any[]) {
    if (!row.title) continue;
    const t = list.find((x) => x.id === row.id);
    const b = baseMap.get(titleKey(row.title));
    row.scannable = !!b;
    row.released = b ? (b.is_released === true || b.release_status === "released") : (t?.released ?? null);
    row.release_date = t?.release_date || null; row.release_label = t?.release_label || null;
    row.wanted = (row.asks || 0) + (fol || []).filter((f: any) => f.track_title === row.title).length;
  }

  // Credits: the people who named IDs in this set
  const namers = [...new Set(list.flatMap((t) => t.named_by || []))] as string[];
  const { data: people } = namers.length ? await sb.from("profiles").select("id,display_name").in("id", namers) : { data: [] };
  return {
    set: { id: set.id, title: set.title, venue: set.venue, played_on: set.played_on, source_url: set.source_url, cover_url: set.cover_url, unlocked_at: set.unlocked_at },
    tracks: out, fires: pro ? fires : fires.slice(0, 3000),
    total: list.length, known: list.filter((t) => t.title).length,
    likes: r.filter((x) => x.kind === "like").length, followers: r.filter((x) => x.kind === "follow").length,
    liked: !!user && r.some((x) => x.kind === "like" && x.user_id === user.id),
    following: !!user && r.some((x) => x.kind === "follow" && x.user_id === user.id),
    credits: (people || []).map((p: any) => p.display_name).filter(Boolean),
    pro, admin,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = adminClient();
  const user = await userFromRequest(sb, req).catch(() => null);
  const data = await load(sb, id, user);
  if (!data) return Response.json({ ok: false, error: "Set not found" }, { status: 404 });
  return Response.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

// POST { action, ... }
//  like | follow (toggle) · fire {at_sec} · ask {track_id} (toggle)
//  suggest {track_id, title, artist}  (Pro; also "Confirm" = suggest the same name)
//  validate {track_id, key} · reject {track_id, key} · name {track_id, title, artist} · delete (admins)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Sign in" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const admin = isAdmin(user);
  const { data: set } = await sb.from("setlists").select("id,title,venue").eq("id", id).maybeSingle();
  if (!set) return Response.json({ ok: false, error: "Set not found" }, { status: 404 });

  const toggle = async (kind: string, bucket: number, extra: any = {}) => {
    const { data: ex } = await sb.from("setlist_reactions").select("id").eq("setlist_id", id).eq("user_id", user.id).eq("kind", kind).eq("bucket", bucket).limit(1);
    if (ex?.length) { await sb.from("setlist_reactions").delete().eq("id", ex[0].id); return false; }
    const { error } = await sb.from("setlist_reactions").insert([{ setlist_id: id, user_id: user.id, kind, bucket, ...extra }]);
    if (error) throw error;
    return true;
  };

  try {
    if (b.action === "like") return Response.json({ ok: true, on: await toggle("like", -1) });
    if (b.action === "follow") return Response.json({ ok: true, on: await toggle("follow", -1) });
    if (b.action === "fire") {
      const at = Math.max(0, Math.floor(Number(b.at_sec) || 0));
      // one fire per person per 30 s of the set
      const { error } = await sb.from("setlist_reactions").insert([{ setlist_id: id, user_id: user.id, kind: "fire", at_sec: at, bucket: Math.floor(at / 30) }]);
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      return Response.json({ ok: true });
    }
    if (b.action === "ask") {
      const { data: t } = await sb.from("setlist_tracks").select("id,position").eq("id", b.track_id).eq("setlist_id", id).maybeSingle();
      if (!t) return Response.json({ ok: false, error: "Track not found" }, { status: 404 });
      return Response.json({ ok: true, on: await toggle("ask", t.position, { track_id: t.id }) });
    }

    if (b.action === "suggest") {
      const title = clean(b.title), artist = clean(b.artist);
      if (!title || !artist) return Response.json({ ok: false, error: "Title and artist are required" }, { status: 400 });
      const { data: t } = await sb.from("setlist_tracks").select("id,title").eq("id", b.track_id).eq("setlist_id", id).maybeSingle();
      if (!t || t.title) return Response.json({ ok: false, error: "This track is already named" }, { status: 400 });

      // Anti-abuse: a daily cap, and a trust weight per account
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count: today } = await sb.from("setlist_suggestions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
      if ((today || 0) >= 30) return Response.json({ ok: false, error: "Daily limit reached — try again tomorrow" }, { status: 429 });
      const weight = await trustWeight(sb, user);

      const key = dupKey(title, artist);
      // Does this title + artist exist anywhere? (BANGER uploads, Deezer, iTunes)
      const k2 = key;
      const { data: up } = await sb.from("bpro_tracks").select("id").eq("dup_key", k2).limit(1);
      let verified = !!up?.length;
      if (!verified) { try { verified = !!(await Promise.race([lookupRelease(title, artist), new Promise((r) => setTimeout(() => r(null), 5000))])); } catch {} }

      await sb.from("setlist_suggestions").delete().eq("track_id", t.id).eq("user_id", user.id).eq("status", "open");   // one name per person per ID
      const { error } = await sb.from("setlist_suggestions").insert([{ track_id: t.id, user_id: user.id, title, artist, key, weight, verified, status: "open" }]);
      if (error) throw error;
      const { data: same } = await sb.from("setlist_suggestions").select("weight").eq("track_id", t.id).eq("key", key).eq("status", "open");
      const total = (same || []).reduce((n: number, x: any) => n + Number(x.weight ?? 1), 0);
      const before = total - weight;
      if (before < 2 && total >= 2) {
        // enough trusted people agree → ask the admins to validate
        const { data: admins } = await sb.from("profiles").select("id").in("email", ADMINS);
        await notify(sb, (admins || []).map((a: any) => a.id), `set_suggestion:${id}`, `${artist} — ${title}`, `An ID was named in ${set.title}${verified ? " (found in catalogues)" : ""}. Tap to validate.`);
      }
      return Response.json({ ok: true });
    }

    // Anyone opening a set fills in the release status of tracks never checked yet
    if (b.action === "refresh_status") {
      const n = await checkSetTracks(sb, { setId: id, limit: 12 }).catch(() => 0);
      return Response.json({ ok: true, changed: n });
    }

    if (!admin) return Response.json({ ok: false, error: "Admins only" }, { status: 403 });

    if (b.action === "validate" || b.action === "name") {
      const { data: t } = await sb.from("setlist_tracks").select("id").eq("id", b.track_id).eq("setlist_id", id).maybeSingle();
      if (!t) return Response.json({ ok: false, error: "Track not found" }, { status: 404 });
      let title = clean(b.title), artist = clean(b.artist), namedBy: string[] = [];
      if (b.action === "validate") {
        const { data: s } = await sb.from("setlist_suggestions").select("user_id,title,artist").eq("track_id", t.id).eq("key", b.key).eq("status", "open");
        if (!s?.length) return Response.json({ ok: false, error: "Suggestion not found" }, { status: 404 });
        title = s[0].title; artist = s[0].artist; namedBy = [...new Set(s.map((x: any) => x.user_id))] as string[];
      }
      if (!title) return Response.json({ ok: false, error: "Title required" }, { status: 400 });
      await sb.from("setlist_tracks").update({ title, artist: artist || null, named_by: namedBy, validated_at: new Date().toISOString() }).eq("id", t.id);
      await sb.from("setlist_suggestions").update({ status: "accepted" }).eq("track_id", t.id).eq("key", dupKey(title, artist)).eq("status", "open");
      await sb.from("setlist_suggestions").update({ status: "closed" }).eq("track_id", t.id).eq("status", "open");
      await checkUnlocked(sb, id);
      await checkSetTracks(sb, { setId: id, limit: 5 }).catch(() => 0);
      return Response.json({ ok: true });
    }
    if (b.action === "replace_tracks") {
      // New tracklist from the set scanner / editor. Rows keep their validation credits when the name stays the same.
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 400).map((r: any) => ({
        start_sec: r.start_sec == null || !isFinite(Number(r.start_sec)) ? null : Math.max(0, Math.floor(Number(r.start_sec))),
        title: clean(r.title) || null, artist: clean(r.artist) || null,
      })).sort((x: any, y: any) => (x.start_sec ?? 0) - (y.start_sec ?? 0));
      const { data: old } = await sb.from("setlist_tracks").select("id,title,artist,named_by,validated_at").eq("setlist_id", id);
      const keep = new Map<string, any>();
      for (const o of old || []) if (o.title) keep.set(dupKey(o.title, o.artist || ""), o);
      await sb.from("setlist_tracks").delete().eq("setlist_id", id);
      if (rows.length) {
        const { error } = await sb.from("setlist_tracks").insert(rows.map((r: any, i: number) => {
          const o = r.title ? keep.get(dupKey(r.title, r.artist || "")) : null;
          return { ...r, setlist_id: id, position: i + 1, named_by: o?.named_by || [], validated_at: o?.validated_at || null };
        }));
        if (error) throw error;
      }
      // reopen the set if new IDs appeared, or unlock it if everything is known
      if (rows.some((r: any) => !r.title)) await sb.from("setlists").update({ unlocked_at: null }).eq("id", id);
      else await checkUnlocked(sb, id);
      await checkSetTracks(sb, { setId: id, limit: 30 }).catch(() => 0);
      return Response.json({ ok: true, count: rows.length });
    }
    // One row: fix its time / name, or remove it (admins)
    if (b.action === "edit_track" || b.action === "delete_track") {
      const { data: t } = await sb.from("setlist_tracks").select("id,title,artist").eq("id", b.track_id).eq("setlist_id", id).maybeSingle();
      if (!t) return Response.json({ ok: false, error: "Track not found" }, { status: 404 });
      if (b.action === "delete_track") await sb.from("setlist_tracks").delete().eq("id", t.id);
      else {
        const title = clean(b.title) || null, artist = clean(b.artist) || null;
        const start = b.start_sec == null || !isFinite(Number(b.start_sec)) ? null : Math.max(0, Math.floor(Number(b.start_sec)));
        const renamed = (title || "") !== (t.title || "") || (artist || "") !== (t.artist || "");
        await sb.from("setlist_tracks").update({
          start_sec: start, title, artist: title ? artist : null,
          ...(renamed ? { released: null, release_checked_at: null } : {}),
          ...(title && !t.title ? { validated_at: new Date().toISOString() } : {}),
        }).eq("id", t.id);
        if (title && !t.title) await sb.from("setlist_suggestions").update({ status: "closed" }).eq("track_id", t.id).eq("status", "open");
      }
      // keep positions in time order
      const { data: all } = await sb.from("setlist_tracks").select("id,start_sec,position").eq("setlist_id", id);
      const sorted = [...(all || [])].sort((x: any, y: any) => (x.start_sec ?? 1e9) - (y.start_sec ?? 1e9) || x.position - y.position);
      await Promise.all(sorted.map((r: any, i: number) => r.position === i + 1 ? null : sb.from("setlist_tracks").update({ position: i + 1 }).eq("id", r.id)));
      const hasIds = sorted.length && (await sb.from("setlist_tracks").select("id").eq("setlist_id", id).is("title", null).limit(1)).data?.length;
      if (hasIds) await sb.from("setlists").update({ unlocked_at: null }).eq("id", id); else await checkUnlocked(sb, id);
      if (b.action === "edit_track") await checkSetTracks(sb, { setId: id, limit: 3 }).catch(() => 0);
      return Response.json({ ok: true });
    }
    if (b.action === "reject") {
      // kept as "rejected": people with several rejected names stop counting (see trustWeight)
      await sb.from("setlist_suggestions").update({ status: "rejected" }).eq("track_id", b.track_id).eq("key", b.key).eq("status", "open");
      return Response.json({ ok: true });
    }
    if (b.action === "delete") {
      await sb.from("setlists").delete().eq("id", id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return Response.json({ ok: false, error: /relation|does not exist|column/i.test(e?.message || "") ? "Run the Sets SQL first" : (e?.message || "Error") }, { status: 500 });
  }
}
