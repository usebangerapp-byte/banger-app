import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
  const supabase = createClient(url, key);
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || "";
  let query = supabase
    .from("bpro_tracks")
    .select("id,title,artist,release_status,release_url,created_at,is_released,allow_preview,snippet_path")
    .order("created_at", { ascending: false }).limit(50);
  if (email) query = query.eq("uploader_email", email);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: data || [] });
}
