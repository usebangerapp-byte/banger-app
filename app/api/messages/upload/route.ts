import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const sender_id = form.get("sender_id") as string | null;
    if (!file || !sender_id) return Response.json({ ok: false, error: "Missing file or sender_id" }, { status: 400 });

    // 50 MB limit
    if (file.size > 52_428_800) return Response.json({ ok: false, error: "File too large (max 50MB)" }, { status: 413 });

    const ext = file.name.split(".").pop() || "bin";
    const path = `chat/${sender_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuf = await file.arrayBuffer();
    const { error } = await sb.storage.from("message_files").upload(path, arrayBuf, { contentType: file.type, upsert: false });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    const { data } = sb.storage.from("message_files").getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl, name: file.name, size: file.size, type: file.type });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Upload failed" }, { status: 500 });
  }
}
