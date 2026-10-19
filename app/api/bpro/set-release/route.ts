import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await req.json().catch(() => ({}));
  const { track_id, is_released } = body;

  if (!track_id || typeof is_released !== "boolean") {
    return Response.json({ error: "Missing track_id or is_released" }, { status: 400 });
  }

  const release_status = is_released ? "released" : "unreleased";

  // Update bpro_tracks
  const { error } = await supabase
    .from("bpro_tracks")
    .update({
      is_released,
      release_status,
      release_checked_at: new Date().toISOString(),
      release_source: "manual",
    })
    .eq("id", track_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // If marking as released → update existing scan_events for this track
  if (is_released) {
    const { data: track } = await supabase
      .from("bpro_tracks")
      .select("title")
      .eq("id", track_id)
      .maybeSingle();

    if (track?.title) {
      await supabase
        .from("scan_events")
        .update({ result_type: "recognized_world" })
        .eq("track_title", track.title)
        .eq("result_type", "recognized_unreleased");
    }
  }

  return Response.json({ ok: true, release_status });
}
