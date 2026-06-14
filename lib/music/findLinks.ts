function clean(v: unknown): string {
  return typeof v === "string" ? v.replace(/\(Private DB\)/gi, "").trim() : "";
}
function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[()[\]{}\-_/\\.,;:'"]+/g, " ")
    .replace(/\s+/g, " ").trim();
}
function titleMatches(a: string, b: string): boolean {
  const na = norm(a); const nb = norm(b);
  return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
}
function artistMatches(input: string, candidates: string[]): boolean {
  const want = norm(input); if (!want) return true;
  const pool = norm(candidates.join(" "));
  return !!pool && (pool.includes(want) || want.includes(pool));
}

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
      body: "grant_type=client_credentials", cache: "no-store",
    });
    const j = await res.json();
    return j?.access_token || null;
  } catch { return null; }
}

async function findSpotifyUrl(artist: string, title: string): Promise<string> {
  const q = encodeURIComponent(`${artist} ${title}`.trim());
  const fallback = `https://open.spotify.com/search/${q}`;
  const token = await getSpotifyToken();
  if (!token) return fallback;
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(`track:${title} artist:${artist}`)}&type=track&limit=5`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    const j = await res.json();
    const match = (j?.tracks?.items || []).find((item: any) =>
      titleMatches(title, item?.name || "") &&
      artistMatches(artist, (item?.artists || []).map((a: any) => a?.name || ""))
    );
    return match?.external_urls?.spotify || fallback;
  } catch { return fallback; }
}

async function findBeatportUrl(artist: string, title: string): Promise<string> {
  const q = encodeURIComponent(`${artist} ${title}`.trim());
  const fallback = `https://www.beatport.com/search?q=${q}`;
  try {
    const res = await fetch(
      `https://www.beatport.com/api/v4/catalog/search?q=${encodeURIComponent(`${artist} ${title}`)}&type=tracks&per_page=10`,
      { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (res.ok) {
      const j = await res.json();
      const tracks: any[] = j?.tracks?.data || j?.results?.tracks || j?.data || [];
      const match = tracks.find((t: any) => {
        const tTitle = clean(t?.name || t?.title || t?.release?.name || "");
        const tArtists = Array.isArray(t?.artists) ? t.artists.map((a: any) => clean(a?.name || "")) : [];
        return titleMatches(title, tTitle) && artistMatches(artist, tArtists);
      });
      if (match) {
        const slug = clean(match?.slug || ""); const id = match?.id;
        if (slug && id) return `https://www.beatport.com/track/${slug}/${id}`;
      }
    }
  } catch {}
  return fallback;
}

export async function findMusicLinks(artist: string, title: string) {
  const [spotify_url, beatport_url] = await Promise.all([
    findSpotifyUrl(clean(artist), clean(title)),
    findBeatportUrl(clean(artist), clean(title)),
  ]);
  return { spotify_url, beatport_url };
}
