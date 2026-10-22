/**
 * Release date + label for any track, from public catalogues (no key needed).
 * Deezer first (good coverage of electronic labels, gives `label` + `release_date`),
 * then iTunes (date + label parsed from the ℗ copyright line).
 * Only accepts a match when title AND artist really match.
 */

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
// Word-for-word comparison that ignores brackets and filler words, so a title typed
// "Get The Girl Mellizos Extended Remix" matches "Get The Girl (Mellizos Extended Remix)"
// — but not the original "Get The Girl" (the remixer's name must be on both sides).
const FILLER = new Set(["original", "extended", "mix", "radio", "edit", "club", "version", "the", "a", "feat", "ft", "unreleased", "free", "dl", "download", "id"]);
const words = (s: string) => new Set(norm(s.replace(/[()\[\]]/g, " ")).split(" ").filter((w) => w && !FILLER.has(w)));
function sameWords(found: string, wanted: string) {
  const f = words(found), w = words(wanted);
  if (!f.size || f.size !== w.size) return false;
  for (const x of f) if (!w.has(x)) return false;
  return true;
}
/** The part of a typed title worth searching: before "(", "[", " - ", " /w ", " w/ ". */
const core = (t: string) => t.split(/\(|\[| - | \/\s?w | w\/ |\/w /i)[0].trim();

const artistOk = (found: string, wanted: string) => {
  const f = norm(found), w = norm(firstArtist(wanted));
  return !!w && (f === w || f.split(" ").join(" ").includes(w) || w.includes(f));
};

function cleanLabel(copyright: string) {
  return copyright.replace(/^[℗©\s]*(?:\(?[pc]\)?\s*)?\d{4}\s*/i, "").replace(/\s*(?:under exclusive licen[cs]e.*)$/i, "").trim() || null;
}

async function deezer(title: string, artist: string) {
  const fa = firstArtist(artist);
  const queries = [`artist:"${fa}" track:"${title.replace(/\(.*?\)/g, "").trim()}"`, `${fa} ${core(title)}`, `${fa} ${core(title).split(" ").slice(0, 3).join(" ")}`];
  let hit: any = null;
  for (const q of queries) {
    const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=15`, { signal: AbortSignal.timeout(6000) });
    const data = (await r.json())?.data || [];
    hit = data.find((t: any) => (titleOk(t.title || "", title) || sameWords(t.title || "", title)) && artistOk(t.artist?.name || "", artist))
      || data.find((t: any) => base(t.title || "") === base(title) && artistOk(t.artist?.name || "", artist));
    if (hit) break;
  }
  if (!hit?.album?.id) return null;
  const a = await (await fetch(`https://api.deezer.com/album/${hit.album.id}`, { signal: AbortSignal.timeout(6000) })).json();
  return { releaseDate: a?.release_date || null, label: a?.label || null, deezer: hit.link || null };
}

async function itunes(title: string, artist: string) {
  const term = `${firstArtist(artist)} ${core(title)}`;
  const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=10`, { signal: AbortSignal.timeout(6000) });
  const j = await r.json();
  const hit = (j?.results || []).find((t: any) => (titleOk(t.trackName || "", title) || sameWords(t.trackName || "", title)) && artistOk(t.artistName || "", artist))
    || (j?.results || []).find((t: any) => base(t.trackName || "") === base(title) && artistOk(t.artistName || "", artist));
  if (!hit) return null;
  let label: string | null = null;
  try {
    const l = await (await fetch(`https://itunes.apple.com/lookup?id=${hit.collectionId}`, { signal: AbortSignal.timeout(6000) })).json();
    label = l?.results?.[0]?.copyright ? cleanLabel(l.results[0].copyright) : null;
  } catch {}
  return { releaseDate: hit.releaseDate ? String(hit.releaseDate).slice(0, 10) : null, label, deezer: null };
}


/** Strict catalogue lookup (Deezer, then iTunes). null = not found anywhere. */
export async function lookupRelease(title: string, artist: string): Promise<{ releaseDate: string | null; label: string | null; deezer: string | null } | null> {
  if (!title || !artist) return null;
  let res: any = null;
  try { res = await deezer(title, artist); } catch {}
  if (!res?.releaseDate || !res?.label) {
    try {
      const it = await itunes(title, artist);
      if (it) res = { releaseDate: res?.releaseDate || it.releaseDate, label: res?.label || it.label, deezer: res?.deezer || null };
    } catch {}
  }
  return res;
}
