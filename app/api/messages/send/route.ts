import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { sender_id, receiver_id, content } = await req.json().catch(() => ({}));
  if (!sender_id || !receiver_id || !content?.trim()) return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });
  const { error } = await sb.from("messages").insert([{ sender_id, receiver_id, content: content.trim() }]);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
