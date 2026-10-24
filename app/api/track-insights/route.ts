import { adminClient, userFromRequest } from "@/lib/server/notify";
import { isPro } from "@/lib/server/pro";
import { isAdminEmail } from "@/lib/admins";
import { titleKey } from "@/lib/titleKey";
import { loadOverrides, ovFor, shownScans, SHOW_COUNT_FROM } from "@/lib/server/overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

/**
 * Everything BANGER knows about one track, from real data only (scans, follows, sets, uploads):
 * chart / hot rank, people waiting, and for Pro: where it's scanned, first spotted, 8-week curve,
 * "DJs who scanned this also scanned…". Uploader: admins only.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const title = (u.searchParams.get("t") || "").trim();
  if (!title) return Response.json({ ok: false }, { status: 400 });
  const sb = adminClient();
  const me = await userFromRequest(sb, req).catch(() => null);
  const pro = me ? await isPro(sb, me.id) : false;
  const admin = !!me && isAdminEmail(me.email);
  const key = titleKey(title);
  const core = esc(title.replace(/\(.*?\)|\[.*?\]/g, "").trim() || title);

  // scans of this track (any version spelling that normalises to the same title)
  const { data: raw } = await sb.from("scan_events").select("created_at,user_id,region,country,track_title,result_type")
    .ilike("track_title", `%${core}%`).neq("result_type", "not_found").or("admin_verdict.is.null,admin_verdict.neq.wrong").order("created_at", { ascending: true }).limit(5000);
  const scans = ((raw || []) as any[]).filter((s) => titleKey(s.track_title) === key);
  const ov = await loadOverrides(sb);
  const shown = shownScans(ovFor(ov, title), scans.length);

  // people waiting for it (follows not marked out)
  let waiting = 0;
  try {
    const { count } = await sb.from("track_followers").select("id", { count: "exact", head: true }).ilike("track_title", esc(title));
    waiting = count || 0;
  } catch {}

  // rank in the Unreleased Charts (same list the app shows)
  let chartRank: number | null = null;
  try {
    const r = await fetch(`${u.origin}/api/charts?rank=${encodeURIComponent(title)}`, { cache: "no-store" });
    chartRank = (await r.json())?.rank ?? null;
  } catch {}

  // rank this week: different people who scanned it in the last 7 days, among all tracks
  let hotRank: number | null = null;
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: week } = await sb.from("scan_events").select("track_title,user_id,created_at").gte("created_at", since).neq("result_type", "not_found").or("admin_verdict.is.null,admin_verdict.neq.wrong").limit(10000);
    const people = new Map<string, Set<string>>();
    for (const s of (week || []) as any[]) {
      const k = titleKey(s.track_title); if (!k || k === "unknown") continue;
      const set = people.get(k) || new Set<string>(); set.add(s.user_id || `a-${s.created_at}`); people.set(k, set);
    }
    if (people.has(key)) {
      const order = [...people.entries()].filter(([k]) => !ov.get(k)?.hidden).sort((a, b) => b[1].size - a[1].size).map(([k]) => k);
      const i = order.indexOf(key);
      hotRank = i >= 0 && i < 30 ? i + 1 : null;
    }
  } catch {}

  // ---- Pro ----
  let regions: string[] | null = null, firstSpotted: string | null = null, weeks: number[] | null = null;
  let also: { title: string; artist: string }[] | null = null;
  if (pro) {
    const tally = new Map<string, number>();
    for (const s of scans) { const place = s.region && !/^unknown$/i.test(s.region) ? s.region : s.country; if (place && !/^unknown$/i.test(place)) tally.set(place, (tally.get(place) || 0) + 1); }
    regions = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
    firstSpotted = scans.at(0)?.created_at || null;
    if (shown >= SHOW_COUNT_FROM) {
      const now = Date.now();
      weeks = Array.from({ length: 8 }, (_, i) => {
        const end = now - (7 - i) * 7 * 86400000, start = end - 7 * 86400000;
        return scans.filter((s) => { const t = new Date(s.created_at).getTime(); return t > start && t <= end; }).length;
      });
    }
    // DJs who scanned this also scanned… (needs 2+ different people in common)
    const users = [...new Set(scans.map((s) => s.user_id).filter(Boolean))].slice(0, 300) as string[];
    if (users.length >= 2) {
      const { data: theirs } = await sb.from("scan_events").select("track_title,track_subtitle,user_id").in("user_id", users).neq("result_type", "not_found").or("admin_verdict.is.null,admin_verdict.neq.wrong").limit(10000);
      const co = new Map<string, { title: string; artist: string; people: Set<string> }>();
      for (const s of (theirs || []) as any[]) {
        const k = titleKey(s.track_title); if (!k || k === key || k === "unknown" || ov.get(k)?.hidden) continue;
        const e = co.get(k) || { title: s.track_title, artist: s.track_subtitle || "", people: new Set<string>() };
        e.people.add(s.user_id); co.set(k, e);
      }
      also = [...co.values()].filter((e) => e.people.size >= 2).sort((a, b) => b.people.size - a.people.size).slice(0, 3).map(({ title, artist }) => ({ title, artist }));
    } else also = [];
  }

  // ---- admins: who uploaded it ----
  let uploader: { id: string; name: string } | null = null;
  if (admin) {
    const { data: up } = await sb.from("bpro_tracks").select("uploader_email").ilike("title", esc(title)).limit(1);
    const email = (up || [])[0]?.uploader_email;
    if (email) {
      const { data: p } = await sb.from("profiles").select("id,display_name").ilike("email", esc(email)).maybeSingle();
      if (p) uploader = { id: p.id, name: p.display_name || email.split("@")[0] };
    }
  }

  return Response.json({
    ok: true, pro, admin,
    scans: shown >= SHOW_COUNT_FROM ? shown : null,
    waiting, chartRank, hotRank,
    regions, firstSpotted, weeks, also, uploader,
  }, { headers: { "Cache-Control": "no-store" } });
}
