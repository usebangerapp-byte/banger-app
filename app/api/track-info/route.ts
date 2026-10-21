/**
 * Release date + label for any track, from public catalogues (no key needed).
 * Deezer first (good coverage of electronic labels, gives `label` + `release_date`),
 * then iTunes (date + label parsed from the ℗ copyright line).
 * Only accepts a match when title AND artist really match.
 */
export const runtime = "nodejs";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\((?:original|extended|radio|club)\s*(?:mix|edit|version)?\)/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const base = (s: string) => norm(s.replace(/\(.*?\)|\[.*?\]/g, ""));
const firstArtist = (a: string) => (a || "").split(/,|&| x |feat\.?|ft\.?/i)[0].trim();

function titleOk(found: string, wanted: string) {
  const f = norm(found), w = norm(wanted);
  if (f === w) return true;
  // "Out of My Head" vs "Out of My Head (Extended Mix)": same core title, and the
  // remix credit (if any) must be present on both sides.
  if (base(found) !== base(wanted)) return false;
  const remix = (s: string) => (s.match(/\(([^)]*(?:remix|edit|rework|bootleg|vip|dub)[^)]*)\)/i)?.[1] || "").toLowerCase();
  return remix(found) === remix(wanted);
}
const artistOk = (found: string, wanted: string) => {
  const f = norm(found), w = norm(firstArtist(wanted));
  return !!w && (f === w || f.split(" ").join(" ").includes(w) || w.includes(f));
};

function cleanLabel(copyright: string) {
  return copyright.replace(/^[℗©\s]*(?:\(?[pc]\)?\s*)?\d{4}\s*/i, "").replace(/\s*(?:under exclusive licen[cs]e.*)$/i, "").trim() || null;
}

async function deezer(title: string, artist: string) {
  const q = `artist:"${firstArtist(artist)}" track:"${title.replace(/\(.*?\)/g, "").trim()}"`;
  const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`, { signal: AbortSignal.timeout(6000) });
  const j = await r.json();
  const hit = (j?.data || []).find((t: any) => titleOk(t.title || "", title) && artistOk(t.artist?.name || "", artist))
    || (j?.data || []).find((t: any) => base(t.title || "") === base(title) && artistOk(t.artist?.name || "", artist));
  if (!hit?.album?.id) return null;
  const a = await (await fetch(`https://api.deezer.com/album/${hit.album.id}`, { signal: AbortSignal.timeout(6000) })).json();
  return { releaseDate: a?.release_date || null, label: a?.label || null, deezer: hit.link || null };
}

async function itunes(title: string, artist: string) {
  const term = `${firstArtist(artist)} ${title.replace(/\(.*?\)/g, "")}`;
  const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=10`, { signal: AbortSignal.timeout(6000) });
  const j = await r.json();
  const hit = (j?.results || []).find((t: any) => titleOk(t.trackName || "", title) && artistOk(t.artistName || "", artist))
    || (j?.results || []).find((t: any) => base(t.trackName || "") === base(title) && artistOk(t.artistName || "", artist));
  if (!hit) return null;
  let label: string | null = null;
  try {
    const l = await (await fetch(`https://itunes.apple.com/lookup?id=${hit.collectionId}`, { signal: AbortSignal.timeout(6000) })).json();
    label = l?.results?.[0]?.copyright ? cleanLabel(l.results[0].copyright) : null;
  } catch {}
  return { releaseDate: hit.releaseDate ? String(hit.releaseDate).slice(0, 10) : null, label, deezer: null };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const title = (u.searchParams.get("t") || "").trim();
  const artist = (u.searchParams.get("a") || "").trim();
  if (!title || !artist) return Response.json({ found: false });
  let res: any = null;
  try { res = await deezer(title, artist); } catch {}
  if (!res?.releaseDate || !res?.label) {
    try {
      const it = await itunes(title, artist);
      if (it) res = { releaseDate: res?.releaseDate || it.releaseDate, label: res?.label || it.label, deezer: res?.deezer || null };
    } catch {}
  }
  return Response.json({ found: !!res, ...(res || {}) }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
