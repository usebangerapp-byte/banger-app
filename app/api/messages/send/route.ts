import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { sender_id, receiver_id, content, file_url, file_name, file_type } = await req.json().catch(() => ({}));
  if (!sender_id || !receiver_id) return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });
  if (!content?.trim() && !file_url) return Response.json({ ok: false, error: "Empty message" }, { status: 400 });
  const row: any = { sender_id, receiver_id };
  if (content?.trim()) row.content = content.trim();
  if (file_url) { row.file_url = file_url; row.file_name = file_name || "file"; row.file_type = file_type || ""; }
  const { error } = await sb.from("messages").insert([row]);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
