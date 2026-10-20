import { userFromRequest } from "@/lib/server/notify";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const me = await userFromRequest(sb, req);
  if (!me) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const user_id = me.id;
  // Delete user data
  await sb.from("scan_events").delete().eq("user_id", user_id);
  await sb.from("track_followers").delete().eq("user_id", user_id);
  await sb.from("profile_followers").delete().or(`follower_id.eq.${user_id},following_id.eq.${user_id}`);
  await sb.from("push_tokens").delete().eq("user_id", user_id);
  await sb.from("notifications").delete().eq("user_id", user_id);
  await sb.from("messages").delete().or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`);
  await sb.from("profiles").delete().eq("id", user_id);
  // Delete auth user
  await sb.auth.admin.deleteUser(user_id);
  return Response.json({ ok: true });
}
