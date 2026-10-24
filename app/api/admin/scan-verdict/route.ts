import { adminFromRequest } from "@/lib/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admins (chokrymusic / usebanger) say if a scan result was right.
 * POST { scan_id, verdict: "right" | "wrong", note? } — a wrong scan stops counting in Charts / Radar.
 */
export async function POST(req: Request) {
  const { sb, user } = await adminFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!["right", "wrong"].includes(b.verdict)) return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  if (!b.scan_id) {
    // no id came back with the result: this admin's latest scan (of that title) in the last 10 minutes
    let q = sb.from("scan_events").select("id").eq("user_id", user.id).gte("created_at", new Date(Date.now() - 600000).toISOString()).order("created_at", { ascending: false }).limit(1);
    if (b.title) q = q.eq("track_title", String(b.title));
    const { data } = await q;
    b.scan_id = (data || [])[0]?.id;
    if (!b.scan_id) return Response.json({ ok: false, error: "Scan not found" }, { status: 404 });
  }
  const note = String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  const { error } = await sb.from("scan_events").update({ admin_verdict: b.verdict, ...(b.note !== undefined ? { admin_note: note } : {}) }).eq("id", b.scan_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
