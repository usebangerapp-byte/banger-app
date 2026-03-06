import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const form = await req.formData();

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const mode = String(form.get("mode") || "DJ");
    const name = String(form.get("name") || "unknown");
    const deleteAfter = String(form.get("delete_after") || "0") === "1";

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("BANGER_UNRELEASED")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("SUPABASE STORAGE UPLOAD ERROR:", uploadError);
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const row = {
      title: file.name,
      artist: mode === "DJ" ? name : null,
      label: mode === "LABEL" ? name : null,
      path,
      bucket: "BANGER_UNRELEASED",
      created_at: new Date().toISOString(),
      delete_after: deleteAfter,
    };

    // table principale
    let dbError: any = null;

    const a = await supabase.from("unreleased_tracks").insert(row);
    dbError = a.error;

    if (dbError) {
      const b = await supabase.from("recent").insert(row);
      dbError = b.error;
    }

    if (dbError) {
      console.error("SUPABASE DB INSERT ERROR:", dbError);
      return NextResponse.json(
        { ok: false, error: dbError.message, uploaded: true, path },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      bucket: "BANGER_UNRELEASED",
      path,
      file: file.name,
    });
  } catch (e: any) {
    console.error("BPRO UPLOAD FATAL:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Upload failed" }, { status: 500 });
  }
}
