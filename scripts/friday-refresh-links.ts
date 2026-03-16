import { createClient } from "@supabase/supabase-js";
import { findMusicLinks } from "../lib/music/findLinks";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from("unreleased_tracks")
    .select("id,title,artist,spotify_url,beatport_url,release_date")
    .or("spotify_url.is.null,beatport_url.is.null")
    .limit(200);

  if (error) {
    console.error("refresh query failed", error);
    process.exit(1);
  }

  for (const track of data || []) {
    const title = String(track.title || "").trim();
    const artist = String(track.artist || "").trim();
    if (!title || !artist) continue;

    const links = await findMusicLinks(artist, title);

    const { error: updateError } = await supabase
      .from("unreleased_tracks")
      .update({
        spotify_url: track.spotify_url || links.spotify_url,
        beatport_url: track.beatport_url || links.beatport_url,
      })
      .eq("id", track.id);

    if (updateError) {
      console.error("update failed for", track.id, updateError);
    } else {
      console.log("updated", artist, "-", title);
    }
  }

  console.log("friday refresh done");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
