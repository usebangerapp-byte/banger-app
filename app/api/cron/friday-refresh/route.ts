import { createClient } from "@supabase/supabase-js";
import { findMusicLinks } from "@/lib/music/findLinks";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data } = await supabase
      .from("unreleased_tracks")
      .select("id,title,artist,spotify_url,beatport_url")
      .or("spotify_url.is.null,beatport_url.is.null")
      .limit(200);

    for (const track of data || []) {
      const title = String(track.title || "").trim();
      const artist = String(track.artist || "").trim();
      if (!title || !artist) continue;

      const links = await findMusicLinks(artist, title);

      await supabase
        .from("unreleased_tracks")
        .update({
          spotify_url: track.spotify_url || links.spotify_url,
          beatport_url: track.beatport_url || links.beatport_url,
        })
        .eq("id", track.id);
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false });
  }
}
