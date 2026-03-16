export async function findMusicLinks(artist: string, title: string) {
  const query = encodeURIComponent(`${artist} ${title}`);

  let spotify_url: string | null = null;
  let beatport_url: string | null = null;

  try {
    spotify_url = `https://open.spotify.com/search/${query}`;
    beatport_url = `https://www.beatport.com/search?q=${query}`;
  } catch (e) {
    console.error("music link search failed", e);
  }

  return {
    spotify_url,
    beatport_url,
  };
}
