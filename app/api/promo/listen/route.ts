import { adminClient, userFromRequest, notifyPromoListened } from "@/lib/server/notify";
import { PROMO_BUCKET } from "@/lib/server/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(sb: ReturnType<typeof adminClient>, token: string) {
  const { data: rec } = await sb.from("promo_recipients")
    .select("id,promo_id,recipient_id,listened_at,plays").eq("token", token).maybeSingle();
  if (!rec) return null;
  const { data: promo } = await sb.from("promo_sends")
    .select("id,sender_id,title,artist,note,file_path").eq("id", rec.promo_id).maybeSingle();
  return promo ? { rec, promo } : null;
}

// GET ?token= → track info + a short-lived signed audio URL (only for the recipient or the sender)
export async function GET(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Sign in to listen" }, { status: 401 });
  const token = new URL(req.url).searchParams.get("token") || "";
  const found = await load(sb, token);
  if (!found) return Response.json({ ok: false, error: "Link not found" }, { status: 404 });
  const { rec, promo } = found;
  if (user.id !== rec.recipient_id && user.id !== promo.sender_id) {
    return Response.json({ ok: false, error: "This private link was sent to someone else" }, { status: 403 });
  }
  const { data: signed } = await sb.storage.from(PROMO_BUCKET).createSignedUrl(promo.file_path, 60 * 60 * 2);
  const { data: sender } = await sb.from("profiles").select("display_name,avatar_url").eq("id", promo.sender_id).maybeSingle();
  return Response.json({
    ok: true, title: promo.title, artist: promo.artist, note: promo.note,
    sender: { id: promo.sender_id, name: sender?.display_name || "A producer", avatar: sender?.avatar_url || null },
    url: signed?.signedUrl || null,
  });
}

// POST { token } → the recipient pressed play (marks it listened + counts plays)
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  const found = await load(sb, String(token || ""));
  if (!found || found.rec.recipient_id !== user.id) return Response.json({ ok: true });
  await sb.from("promo_recipients").update({
    listened_at: found.rec.listened_at || new Date().toISOString(),
    plays: (found.rec.plays || 0) + 1,
  }).eq("id", found.rec.id);
  if (!found.rec.listened_at) {
    await notifyPromoListened(sb, found.promo.sender_id, user.id, found.promo.title).catch(() => {});
  }
  return Response.json({ ok: true });
}
