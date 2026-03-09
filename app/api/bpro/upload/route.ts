import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const STORAGE_BUCKET = process.env.BPRO_STORAGE_BUCKET || "bpro_uploads";
const ACR_BUCKET_ID = process.env.ACR_BUCKET_ID || "";

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.ACR_CONSOLE_TOKEN;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  if (!token || !ACR_BUCKET_ID) {
    return NextResponse.json({ error: "Missing ACR env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const form = await req.formData();

  const source = form.get("file");
  if (!(source instanceof File)) {
    return NextResponse.json({ error: "Audio file missing" }, { status: 400 });
  }

  const artwork = form.get("artwork");
  const mode = String(form.get("mode") || "");
  const name = String(form.get("name") || "");
  const title = String(form.get("title") || "");
  const info = String(form.get("info") || "");
  const releaseStatus = String(form.get("release_status") || "");
  const releaseDate = String(form.get("release_date") || "");
  const allowPreview = String(form.get("allow_preview") || "1") === "1";
  const hasRights = String(form.get("has_rights") || "0") === "1";
  const uploaderEmail = String(form.get("uploader_email") || "").trim().toLowerCase();
  const snippetStartRaw = Number(form.get("snippet_start") || 0);
  const snippetDurationRaw = Number(form.get("snippet_duration") || 0);

  if (!mode || !name.trim() || !title.trim()) {
    return NextResponse.json({ error: "Missing required metadata" }, { status: 400 });
  }

  if (!hasRights) {
    return NextResponse.json({ error: "Rights confirmation required" }, { status: 400 });
  }

  const sourceBuffer = Buffer.from(await source.arrayBuffer());
  const sourceExt = source.name.includes(".") ? source.name.split(".").pop() : "mp3";
  const snippetPath = `snippets/${Date.now()}-${randomUUID()}-${sanitizeName(title)}.${sourceExt}`;

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(snippetPath, new Blob([sourceBuffer]), {
      contentType: source.type || "audio/mpeg",
      upsert: false,
    });

  if (storageError) {
    return NextResponse.json({ error: `Snippet storage failed: ${storageError.message}` }, { status: 500 });
  }

  let artworkPath: string | null = "B-logo.png";

  if (artwork instanceof File && artwork.size > 0) {
    const artworkBuffer = Buffer.from(await artwork.arrayBuffer());
    const ext = artwork.name.includes(".") ? artwork.name.split(".").pop() : "jpg";
    artworkPath = `artwork/${Date.now()}-${randomUUID()}-${sanitizeName(title)}.${ext}`;

    const { error: artworkError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(artworkPath, new Blob([artworkBuffer]), {
        contentType: artwork.type || "image/jpeg",
        upsert: false,
      });

    if (artworkError) {
      return NextResponse.json({ error: `Artwork storage failed: ${artworkError.message}` }, { status: 500 });
    }
  }

  const acrForm = new FormData();
  acrForm.append(
    "file",
    new Blob([sourceBuffer], { type: source.type || "audio/mpeg" }),
    source.name || "snippet.mp3"
  );
  acrForm.append("title", title);
  acrForm.append("data_type", "audio");
  acrForm.append(
    "user_defined",
    JSON.stringify({
      mode,
      name,
      info,
      release_status: releaseStatus,
      release_date: releaseDate || null,
      allow_preview: allowPreview,
      storage_bucket: STORAGE_BUCKET,
      snippet_path: snippetPath,
      artwork_path: artworkPath,
      snippet_start: Number.isFinite(snippetStartRaw) ? snippetStartRaw : 0,
      snippet_duration: Number.isFinite(snippetDurationRaw) ? snippetDurationRaw : null,
      source_file_name: source.name,
      source_size: source.size,
    })
  );

  const acrRes = await fetch(`https://api-v2.acrcloud.com/api/buckets/${ACR_BUCKET_ID}/files`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: acrForm,
  });

  const acrJson = await acrRes.json().catch(() => null);

  if (!acrRes.ok) {
    return NextResponse.json(
      { error: acrJson?.error || "ACR upload failed", snippet_path: snippetPath, artwork_path: artworkPath },
      { status: 500 }
    );
  }

  const acrItem = Array.isArray(acrJson?.data) ? acrJson.data[0] : acrJson?.data;
  const fingerprintStatus = acrItem?.state === 1 ? "ready" : "processing";

  try {
    await supabase.from("bpro_uploads").insert({
      mode,
      name,
      title,
      info: info || null,
      release_status: releaseStatus || null,
      release_date: releaseDate || null,
      allow_preview: allowPreview,
      storage_bucket: STORAGE_BUCKET,
      snippet_path: snippetPath,
      artwork_path: artworkPath,
      snippet_start: Number.isFinite(snippetStartRaw) ? snippetStartRaw : 0,
      snippet_duration: Number.isFinite(snippetDurationRaw) ? snippetDurationRaw : null,
      source_file_name: source.name,
      source_size: source.size,
      acr_id: acrItem?.acr_id || null,
      fingerprint_status: fingerprintStatus,
      uploader_email: uploaderEmail || null,
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    snippet_path: snippetPath,
    artwork_path: artworkPath,
    acr_id: acrItem?.acr_id || null,
    acr_state: acrItem?.state ?? null,
    fingerprint_status: fingerprintStatus,
  });
}
