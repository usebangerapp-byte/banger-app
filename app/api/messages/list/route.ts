import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { searchParams } = new URL(req.url);
  const user_id  = searchParams.get("user_id")  || "";
  const other_id = searchParams.get("other_id") || "";
  if (!user_id) return Response.json({ ok: false, error: "Missing user_id" }, { status: 400 });
  let query = sb.from("messages").select("id,created_at,sender_id,receiver_id,content,read").order("created_at", { ascending: true }).limit(100);
  if (other_id) query = query.or(`and(sender_id.eq.${user_id},receiver_id.eq.${other_id}),and(sender_id.eq.${other_id},receiver_id.eq.${user_id})`);
  else query = query.or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`);
  const { data, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (other_id && data?.length) await sb.from("messages").update({ read: true }).eq("sender_id", other_id).eq("receiver_id", user_id).eq("read", false);
  return Response.json({ ok: true, messages: data || [] });
}
