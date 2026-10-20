import { adminClient, userFromRequest } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { message_id, like: boolean } → double-tap like on a message I received
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { message_id, like } = await req.json().catch(() => ({}));
  const { data: msg } = await sb.from("messages").select("id,receiver_id").eq("id", message_id).maybeSingle();
  if (!msg || msg.receiver_id !== user.id) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  const { error } = await sb.from("messages").update({ liked_at: like === false ? null : new Date().toISOString() }).eq("id", message_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
