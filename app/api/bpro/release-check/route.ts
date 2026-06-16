import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
const MB_UA = "BangerApp/1.0 (contact@usebangerapp.com)";

function norm(s: string): string {
  return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
function cleanTitle(t: string): string {
  return t.replace(/\s*\(\s*(original|extended|club|radio|vocal|instrumental|dub|remaster|reprise)(\s+(mix|version|edit|cut))?\s*\)/gi,"").trim()||t;
}
function firstArtist(a: string): string {
  return a.split(/,|feat\.|ft\.|&/i)[0].trim()||a;
}

async function checkMusicBrainz(title: string, artist: string) {
  const q = `artist:"${firstArtist(artist)}" AND recording:"${cleanTitle(title)}"`;
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=5`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": MB_UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { isReleased: false, mbid: null, releaseDate: null };
    const json = await res.json();
    const match = (json?.recordings||[]).find((r: any) => {
      if ((r.score||0) < 85) return false;
      const rTitle   = norm(r.title||"");
      const rArtists = (r["artist-credit"]||[]).map((a: any) => norm(a.name||a.artist?.name||"")).join(" ");
      const tNorm = norm(cleanTitle(title)); const aNorm = norm(firstArtist(artist));
      return (rTitle.includes(tNorm)||tNorm.includes(rTitle)) && (!aNorm||rArtists.includes(aNorm)||aNorm.includes(rArtists.split(" ")[0]));
    });
    if (!match) return { isReleased: false, mbid: null, releaseDate: null };
    const releases = match.releases||[];
    const official = releases.find((r: any) => r.status==="Official")||releases[0];
    const releaseDate = official?.date||match["first-release-date"]||null;
    return { isReleased: !!releaseDate, mbid: match.id, releaseDate };
  } catch { return { isReleased: false, mbid: null, releaseDate: null }; }
}

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const cutoff = new Date(Date.now() - 6*60*60*1000).toISOString();
  const { data: tracks, error } = await supabase.from("bpro_tracks")
    .select("id, title, artist, release_status, release_checked_at")
    .not("release_status","eq","released")
    .or(`release_checked_at.is.null,release_checked_at.lt.${cutoff}`)
    .order("updated_at",{ascending:false}).limit(50);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const results: any[] = [];
  for (const track of tracks||[]) {
    const title  = (track.title||"").trim();
    const artist = (track.artist||"").trim();
    if (!title) { results.push({ id: track.id, skipped: true }); continue; }

    await new Promise(r => setTimeout(r, 1100)); // rate limit MusicBrainz 1 req/s

    try {
      const { isReleased, mbid, releaseDate } = await checkMusicBrainz(title, artist);
      await supabase.from("bpro_tracks").update({
        release_status: isReleased?"released":"unknown", is_released: isReleased,
        release_checked_at: new Date().toISOString(), release_source: "musicbrainz",
        ...(releaseDate?{release_date:releaseDate}:{}),
        ...(isReleased?{beatport_url:`https://www.beatport.com/search?q=${encodeURIComponent(firstArtist(artist)+" "+cleanTitle(title))}`}:{}),
      }).eq("id",track.id);

      if (isReleased) {
        await supabase.from("scan_events").update({result_type:"recognized_world"})
          .eq("track_title",title).eq("result_type","recognized_unreleased");
      }
      results.push({ id:track.id, title, artist, searchTitle:cleanTitle(title), searchArtist:firstArtist(artist), isReleased, mbid, releaseDate, release_status:isReleased?"released":"unknown" });
    } catch(e: any) { results.push({ id:track.id, title, artist, error:e?.message }); }
  }
  return Response.json({ ok:true, count:results.length, results });
}
