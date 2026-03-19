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

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const supabase = getSupabase();

    const a = await supabase
      .from("bpro_tracks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);

    if (!a.error) {
      return NextResponse.json({ ok: true, data: a.data || [] });
    }

    const b = await supabase
      .from("recent")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);

    if (b.error) {
      return NextResponse.json({ ok: false, error: b.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: b.data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Recent failed" }, { status: 500 });
  }
}
