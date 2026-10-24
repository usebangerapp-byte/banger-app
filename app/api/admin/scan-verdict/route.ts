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
  if (!b.scan_id || !["right", "wrong"].includes(b.verdict)) return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  const note = String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  const { error } = await sb.from("scan_events").update({ admin_verdict: b.verdict, ...(b.note !== undefined ? { admin_note: note } : {}) }).eq("id", b.scan_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
