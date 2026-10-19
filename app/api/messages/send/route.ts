import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { sender_id, receiver_id, content, file_url, file_name, file_type } = body;

  if (!sender_id || !receiver_id) {
    return Response.json({ ok: false, error: "Missing sender_id or receiver_id" }, { status: 400 });
  }

  const hasContent = content && String(content).trim().length > 0;
  const hasFile = !!file_url;

  if (!hasContent && !hasFile) {
    return Response.json({ ok: false, error: "Message is empty (no content, no file)" }, { status: 400 });
  }

  // Build row — try with file columns first
  const row: any = { sender_id, receiver_id };
  if (hasContent) row.content = String(content).trim();
  if (hasFile) {
    row.file_url  = file_url;
    row.file_name = file_name || "file";
    row.file_type = file_type || "";
  }

  const { error } = await sb.from("messages").insert([row]);

  if (error) {
    // If file columns don't exist, retry with text-only fallback
    if (hasFile && error.message?.includes("column")) {
      const fallback: any = { sender_id, receiver_id, content: `📎 ${file_name || "file"} — ${file_url}` };
      const { error: e2 } = await sb.from("messages").insert([fallback]);
      if (e2) return Response.json({ ok: false, error: "DB fallback: " + e2.message }, { status: 500 });
      return Response.json({ ok: true, fallback: true });
    }
    return Response.json({ ok: false, error: "DB: " + error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
