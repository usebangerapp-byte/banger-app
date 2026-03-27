import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tracks, error } = await supabase
    .from("bpro_tracks")
    .select("id, title, artist, release_status")
    .limit(50);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  for (const track of tracks || []) {
    const isReleased = false;

    await supabase
      .from("bpro_tracks")
      .update({
        release_status: isReleased ? "released" : "unreleased",
        release_checked_at: new Date().toISOString(),
        release_source: "beatport",
      })
      .eq("id", track.id);
  }

  return Response.json({ ok: true, count: tracks?.length || 0 });
}
