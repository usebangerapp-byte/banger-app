import { userFromRequest } from "@/lib/server/notify";
import { isPro } from "@/lib/server/pro";
import { FREE } from "@/lib/plan";
import { createClient } from "@supabase/supabase-js"
import { lookupRelease } from "@/lib/server/catalog";
import { titleKey } from "@/lib/titleKey";
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
}
function norm(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : ""; return s || null;
}
export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ followed: [] });
  const supabase = createClient(url, key);
  const me = await userFromRequest(supabase, req);
  if (!me) return json({ followed: [] }, 401);
  const user_id = me.id;
  let { data, error } = await supabase.from("track_followers").select("track_title,track_subtitle,released,release_checked_at").eq("user_id", user_id).order("created_at", { ascending: false }) as any;
  if (error && /released|release_checked_at|column/i.test(error.message)) {
    // release columns not created yet: plain list
    ({ data, error } = await supabase.from("track_followers").select("track_title,track_subtitle").eq("user_id", user_id).order("created_at", { ascending: false }) as any);
    if (error) return json({ error: error.message }, 500);
    return json({ followed: data || [] });
  }
  if (error) return json({ error: error.message }, 500);
  const rows = (data || []) as any[];

  // Is it out? BANGER's own status first; tracks not on BANGER are checked in the catalogues
  // (Deezer / iTunes), at most every 3 days, a few per visit.
  const { data: base } = await supabase.from("bpro_tracks").select("title,is_released,release_status").limit(20000);
  const onBanger = new Map<string, boolean>();
  for (const b of (base || []) as any[]) onBanger.set(titleKey(b.title), b.is_released === true || b.release_status === "released");
  const stale = Date.now() - 3 * 86400000;
  const toCheck = rows.filter((r) => !onBanger.has(titleKey(r.track_title)) && r.released !== true
    && (!r.release_checked_at || new Date(r.release_checked_at).getTime() < stale)).slice(0, 6);
  await Promise.all(toCheck.map(async (r) => {
    const artist = String(r.track_subtitle || "").trim();
    // "Anotr - Talk To You" typed with the artist in the title
    let title = String(r.track_title || "");
    const dash = title.split(/\s+[-–—]\s+/);
    if (dash.length > 1 && (!artist || dash[0].toLowerCase().replace(/\W/g, "") === artist.toLowerCase().replace(/\W/g, ""))) title = dash.slice(1).join(" - ");
    const found = await Promise.race([lookupRelease(title, artist || dash[0]), new Promise<null>((res) => setTimeout(() => res(null), 6000))]).catch(() => null);
    const released = !!(found?.releaseDate && new Date(found.releaseDate).getTime() <= Date.now());
    r.released = released;
    try { await supabase.from("track_followers").update({ released, release_checked_at: new Date().toISOString() }).eq("track_title", r.track_title); } catch {}
  }));
  const followed = rows.map((r) => {
    const k = titleKey(r.track_title);
    const is_released = onBanger.has(k) ? !!onBanger.get(k) : r.released === true;
    return { track_title: r.track_title, track_subtitle: r.track_subtitle, is_released };
  });
  return json({ followed });
}
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: "Missing env" }, 500);
  const supabase = createClient(url, key);
  const body = await req.json().catch(() => ({}));
  const action = body?.action === "unfollow" ? "unfollow" : "follow";
  const me = await userFromRequest(supabase, req);
  if (!me) return json({ error: "Not signed in" }, 401);
  const user_id = me.id; const track_title = norm(body?.track_title);
  const track_subtitle = norm(body?.track_subtitle);
  if (!track_title) return json({ error: "Missing track_title" }, 400);
  if (action === "unfollow") {
    const { error } = await supabase.from("track_followers").delete().eq("user_id", user_id).eq("track_title", track_title);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, following: false });
  }
  const { data: existing } = await supabase.from("track_followers").select("id").eq("user_id", user_id).eq("track_title", track_title).limit(1);
  if (existing && existing.length > 0) return json({ ok: true, following: true });
  // Free accounts follow up to FREE.follows tracks
  if (!(await isPro(supabase, user_id))) {
    // tracks already out don't count (they only sit under "Out now")
    let { count, error: cErr } = await supabase.from("track_followers").select("id", { count: "exact", head: true }).eq("user_id", user_id).or("released.is.null,released.eq.false") as any;
    if (cErr) ({ count } = await supabase.from("track_followers").select("id", { count: "exact", head: true }).eq("user_id", user_id) as any);
    if ((count || 0) >= FREE.follows) return json({ error: "limit", limit: FREE.follows }, 402);
  }
  const { error } = await supabase.from("track_followers").insert([{ user_id, track_title, track_subtitle }]);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, following: true });
}
