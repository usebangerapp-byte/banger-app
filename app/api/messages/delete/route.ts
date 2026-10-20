import { userFromRequest } from "@/lib/server/notify";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const me = await userFromRequest(sb, req);
  if (!me) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const user_id = me.id;
  const { message_id, other_id } = await req.json().catch(() => ({}));
  if (!message_id && !other_id) return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });
  // A whole conversation (both directions) or one of your own messages
  const { error } = other_id
    ? await sb.from("messages").delete()
        .or(`and(sender_id.eq.${user_id},receiver_id.eq.${other_id}),and(sender_id.eq.${other_id},receiver_id.eq.${user_id})`)
    : await sb.from("messages").delete().eq("id", message_id).eq("sender_id", user_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
