import { adminClient, userFromRequest } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMINS = (process.env.ADMIN_EMAILS || "chokrymusic@gmail.com,usebangerapp@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function count(q: any) {
  const { count } = await q;
  return count || 0;
}

// GET → BANGER growth numbers (admins only)
export async function GET(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user || !ADMINS.includes(String(user.email || "").toLowerCase())) {
    return Response.json({ ok: false, error: "Admins only" }, { status: 403 });
  }
  const now = Date.now();
  const iso = (days: number) => new Date(now - days * 86400000).toISOString();

  const [users, pros, newUsers7, scans1, scans7, scans30, found7, uploads, promos] = await Promise.all([
    count(sb.from("profiles").select("id", { count: "exact", head: true })),
    count(sb.from("profiles").select("id", { count: "exact", head: true }).in("role", ["pro", "dj", "label"])),
    count(sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso(7))),
    count(sb.from("scan_events").select("id", { count: "exact", head: true }).gte("created_at", iso(1))),
    count(sb.from("scan_events").select("id", { count: "exact", head: true }).gte("created_at", iso(7))),
    count(sb.from("scan_events").select("id", { count: "exact", head: true }).gte("created_at", iso(30))),
    count(sb.from("scan_events").select("id", { count: "exact", head: true }).gte("created_at", iso(7)).neq("result_type", "not_found")),
    count(sb.from("bpro_tracks").select("id", { count: "exact", head: true })),
    count(sb.from("promo_sends").select("id", { count: "exact", head: true })),
  ]);

  // scans per day (last 14 days) + top tracks this week
  const { data: rows } = await sb.from("scan_events").select("created_at,track_title,track_subtitle,result_type")
    .gte("created_at", iso(14)).limit(20000);
  const days: { day: string; scans: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    days.push({ day: d, scans: 0 });
  }
  const byDay = new Map(days.map((d) => [d.day, d]));
  const tally = new Map<string, { title: string; artist: string; n: number; unreleased: boolean }>();
  const weekAgo = now - 7 * 86400000;
  for (const r of (rows || []) as any[]) {
    const d = byDay.get(String(r.created_at).slice(0, 10));
    if (d) d.scans++;
    if (new Date(r.created_at).getTime() < weekAgo || r.result_type === "not_found" || !r.track_title) continue;
    const k = String(r.track_title).toLowerCase().trim();
    const t = tally.get(k) || { title: r.track_title, artist: r.track_subtitle || "", n: 0, unreleased: r.result_type === "recognized_unreleased" };
    t.n++; tally.set(k, t);
  }
  const top = Array.from(tally.values()).sort((a, b) => b.n - a.n).slice(0, 10);

  return Response.json({
    ok: true,
    users, pros, newUsers7, scans1, scans7, scans30,
    foundRate7: scans7 ? Math.round((found7 / scans7) * 100) : 0,
    uploads, promos, days, top,
  });
}
