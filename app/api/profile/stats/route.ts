import { adminClient, userFromRequest } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How the signed-in user's uploaded IDs were scanned over the last 7 days (PRO card on the profile)
export async function GET(req: Request) {
  const sb = adminClient();
  const me = await userFromRequest(sb, req);
  if (!me) return Response.json({ ok: false }, { status: 401 });

  const { data: tracks } = await sb.from("bpro_tracks")
    .select("id,title").eq("uploader_email", me.email || "").limit(200);
  const ids = (tracks || []).map((t: any) => t.id);
  if (!ids.length) return Response.json({ ok: true, uploads: 0, uploadScans7d: 0, topUpload: null });

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: scans } = await sb.from("scan_events")
    .select("track_id").in("track_id", ids).gte("created_at", since).limit(5000);

  const counts = new Map<string, number>();
  for (const s of scans || []) counts.set((s as any).track_id, (counts.get((s as any).track_id) || 0) + 1);
  let topId: string | null = null; let topN = 0;
  counts.forEach((n, id) => { if (n > topN) { topN = n; topId = id; } });
  const topTitle = topId ? (tracks || []).find((t: any) => t.id === topId)?.title || null : null;

  return Response.json({
    ok: true,
    uploads: ids.length,
    uploadScans7d: (scans || []).length,
    topUpload: topTitle ? { title: topTitle, scans: topN } : null,
  });
}
