import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ unlocked: false, count: 0 });
  }

  const { data, error } = await supabase
    .from("bpro_uploads")
    .select("id, uploader_email, fingerprint_status")
    .eq("uploader_email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accepted = data || [];

  return NextResponse.json({
    unlocked: accepted.length >= 1,
    count: accepted.length,
    remaining: Math.max(0, 1 - accepted.length),
  });
}
