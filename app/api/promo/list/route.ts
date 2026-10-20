import { adminClient, userFromRequest } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → the promos I sent, with who listened
export async function GET(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, promos: [] }, { status: 401 });

  const { data: promos, error } = await sb.from("promo_sends")
    .select("id,title,artist,note,created_at").eq("sender_id", user.id)
    .order("created_at", { ascending: false }).limit(30);
  if (error) return Response.json({ ok: false, error: error.message, promos: [] }, { status: 500 });
  const ids = (promos || []).map((p) => p.id);
  if (!ids.length) return Response.json({ ok: true, promos: [] });

  const { data: recs } = await sb.from("promo_recipients")
    .select("*").in("promo_id", ids);
  const peopleIds = Array.from(new Set((recs || []).map((r) => r.recipient_id)));
  const { data: people } = peopleIds.length
    ? await sb.from("profiles").select("id,display_name,avatar_url").in("id", peopleIds)
    : { data: [] as any[] };
  const byId = new Map((people || []).map((p: any) => [p.id, p]));

  return Response.json({
    ok: true,
    promos: (promos || []).map((p) => ({
      ...p,
      recipients: (recs || []).filter((r) => r.promo_id === p.id).map((r) => ({
        id: r.recipient_id,
        name: byId.get(r.recipient_id)?.display_name || "DJ",
        avatar: byId.get(r.recipient_id)?.avatar_url || null,
        listened_at: r.listened_at, plays: r.plays || 0, liked: !!(r as any).liked_at,
      })),
    })),
  });
}
