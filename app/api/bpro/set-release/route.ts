import { createClient } from "@supabase/supabase-js";
import { notifyTrackReleased } from "@/lib/server/notify";

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

  // Sync scan_events result_type to match new release status
  const { data: track } = await supabase
    .from("bpro_tracks")
    .select("title,artist")
    .eq("id", track_id)
    .maybeSingle();

  if (track?.title) {
    if (is_released) {
      // Mark all past scans of this track as released
      await supabase
        .from("scan_events")
        .update({ result_type: "recognized_world" })
        .eq("track_title", track.title)
        .eq("result_type", "recognized_unreleased");
      await notifyTrackReleased(supabase, track.title, (track as any).artist).catch(() => {});
    } else {
      // Revert back to unreleased
      await supabase
        .from("scan_events")
        .update({ result_type: "recognized_unreleased" })
        .eq("track_title", track.title)
        .eq("result_type", "recognized_world");
    }
  }

  return Response.json({ ok: true, release_status });
}
