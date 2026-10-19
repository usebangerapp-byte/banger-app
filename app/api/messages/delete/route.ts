import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { message_id, user_id } = await req.json().catch(() => ({}));
  if (!message_id || !user_id) return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });
  // Only sender can delete their own message
  const { error } = await sb.from("messages").delete().eq("id", message_id).eq("sender_id", user_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
