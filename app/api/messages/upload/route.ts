import { userFromRequest } from "@/lib/server/notify";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Lire le formData depuis le stream brut
    let form: FormData;
    try {
      form = await req.formData();
    } catch (e: any) {
      return Response.json({ ok: false, error: "FormData parse failed: " + (e?.message || String(e)) }, { status: 400 });
    }

    const me = await userFromRequest(sb, req);
    if (!me) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
    const file = form.get("file") as File | null;
    const sender_id = me.id;

    if (!file) return Response.json({ ok: false, error: "No file in form" }, { status: 400 });
    if (!sender_id) return Response.json({ ok: false, error: "No sender_id in form" }, { status: 400 });

    // 50 MB limit
    if (file.size > 52_428_800) {
      return Response.json({ ok: false, error: "File too large (max 50MB)" }, { status: 413 });
    }

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `chat/${sender_id}/${safeName}`;

    let arrayBuf: ArrayBuffer;
    try {
      arrayBuf = await file.arrayBuffer();
    } catch (e: any) {
      return Response.json({ ok: false, error: "Buffer read failed: " + (e?.message || String(e)) }, { status: 500 });
    }

    const { error: uploadError } = await sb.storage
      .from("bpro_uploads")
      .upload(path, arrayBuf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return Response.json({ ok: false, error: "Storage: " + uploadError.message }, { status: 500 });
    }

    const { data } = sb.storage.from("bpro_uploads").getPublicUrl(path);

    return Response.json({
      ok: true,
      url: data.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: "Unexpected: " + (e?.message || String(e)) }, { status: 500 });
  }
}
