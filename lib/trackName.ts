/**
 * Smart "Artist - Title" from a dropped file: reads the ID3 tags of MP3s first,
 * then falls back to a careful filename parser that keeps remix credits in the title.
 */

const VERSION_WORDS = "remix|mix|edit|rework|bootleg|vip|dub|version|flip|refix|re-edit|reprise|extended|instrumental|acapella|club|radio|remaster(?:ed)?";
const VERSION_RE = new RegExp(`\\b(${VERSION_WORDS})\\b`, "i");

// Bits producers leave in filenames that are not part of the name
const JUNK = [
  /\[(?![^\]]*\b(?:remix|rework|bootleg|vip|flip|refix)\b)(?:free\s*(?:dl|download)|out\s*now|premiere|master(?:ed)?|final|wip|demo|preview|clip|snippet|unmastered|promo)[^\]]*\]/gi,
  /\((?![^)]*\b(?:remix|rework|bootleg|vip|flip|refix)\b)(?:free\s*(?:dl|download)|out\s*now|premiere|master(?:ed)?|final|wip|demo|preview|clip|snippet|unmastered|promo)[^)]*\)/gi,
  /\b(?:master(?:ed)?|unmastered|wip|v\d+|copy)\b\s*$/gi,
  /\b\d{2,3}\s?bpm\b/gi,
  /\b(?:[1-9]|1[0-2])[ab]\b(?=\s*$)/gi,                // Camelot key at the end (8A, 11B)
  /\b[a-g](?:#|b)?\s?(?:maj|min|m)\b(?=\s*$)/gi,        // musical key at the end
  /\[[^\]]*\]/g,                                       // remaining [Label] / [Catalog]
  /\s*\(\s*\d{1,2}\s*\)/g,                             // download duplicates: "(1)", "(2)"
  /\s*\(\s*v\s?\d+(?:\.\d+)?\s*\)/gi,                   // "(v2)", "(V 3)"
  /\bv\d+(?:\.\d+)?\b/gi,                               // "v2", "V3.1"
  /\(\s*(?:copy|final|bounce|mixdown|export|render|ref|reference|draft)[^)]*\)/gi,
  /\s+-\s+(?:copy|final|master(?:ed)?|bounce|mixdown|export)\s*\d*\s*$/gi,   // "… - copy", "… - master"
  /\s+copy(?:\s*\d+)?\s*$/gi,                          // "… copy 2"
  /(?<=\))\s+\d{1,2}\s*$/g,                               // "(Extended Mix) 1"
];

function tidy(s: string) {
  return s.replace(/\s+/g, " ").replace(/\s+([,)\]])/g, "$1").replace(/([(\[])\s+/g, "$1").replace(/^[\s\-–—_.]+|[\s\-–—_.]+$/g, "").trim();
}

/** Title Case only when the whole thing is lower/upper case (keeps intentional styling like "DVIRNUNS" or "deadmau5"). */
function smartCase(s: string) {
  const letters = s.replace(/[^a-zA-Z]/g, "");
  if (!letters || (letters !== letters.toLowerCase())) return s;
  return s.replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b);
}

export function parseTrackFilename(filename: string): { artist: string; title: string } {
  let base = filename.replace(/\.[a-z0-9]{2,5}$/i, "")
    // leftover pseudo-extensions: "313 (Original Mix).x", "track.wav.mp3", ".part"…
    .replace(/(?:\.(?:wav|mp3|aiff?|flac|m4a|ogg|alac|tmp|part|crdownload|[a-z]))+$/i, "")
    .replace(/_\d{1,2}\s*$/, "");
  base = base.replace(/_/g, " ").replace(/\s*[–—]\s*/g, " - ");
  base = base.replace(/^\s*(?:\d{1,3}[\s.\-)]+(?=[^\s(])|[A-D][1-9]\s*[.\-)]\s*|[A-D][1-9]\s+(?=.+\s-\s))/, "");   // "01. ", "03 - ", "A1 "
  for (let pass = 0; pass < 3; pass++) {
    for (const re of JUNK) base = tidy(base.replace(re, " "));
    // "(DJ Master)", "(Final Master)", "[Bounce 2]"… = studio file notes, not part of the name
    // (but never touch a real credit like "(Master X Remix)")
    base = tidy(base.replace(/[\(\[]([^\)\]]*)[\)\]]/g, (m, inner: string) =>
      /\b(?:master(?:ed)?|premaster|unmastered|final|wip|demo|bounce|mixdown|export|render|draft|ref|test)\b/i.test(inner) &&
      !/\b(?:remix|rework|bootleg|vip|flip|refix|edit)\b/i.test(inner) ? " " : m));
    // trailing "Final" / "Final 2" / "Final Version" (but keep titles like "The Final")
    base = tidy(base.replace(/(?<!\b(?:the|my|your|a|so|grand|semi|last)\s)\bfinal(?:\s+(?:version|mix|master|edit))?(?:\s*v?\d+)?\s*$/i, " "));
  }
  base = tidy(base);

  // "Artist - Title - X Remix"  →  title "Title (X Remix)"
  let parts = base.split(/\s+-\s+/).map(tidy).filter(Boolean);
  if (parts.length >= 3 && VERSION_RE.test(parts[parts.length - 1]) && !/[()]/.test(parts[parts.length - 1])) {
    const version = parts.pop()!;
    parts[parts.length - 1] = `${parts[parts.length - 1]} (${version})`;
  }

  let artist = "", title = base;
  if (parts.length >= 2) {
    artist = parts[0];
    title = parts.slice(1).join(" - ");
  } else {
    // "Artist-Title" with a bare hyphen (only if the left side doesn't look like a version)
    const m = base.match(/^([^()\-]{2,}?)-([^-].+)$/);
    if (m && !VERSION_RE.test(m[1])) { artist = tidy(m[1]); title = tidy(m[2]); }
  }

  // "Title feat. X" → the featured artist belongs with the artist
  const feat = title.match(/\s+\(?(?:feat\.?|ft\.?|featuring)\s+([^()]+?)\)?(?=\s*\(|$)/i);
  if (feat && artist) {
    artist = `${artist} feat. ${tidy(feat[1])}`;
    title = tidy(title.replace(feat[0], " "));
  }

  return { artist: smartCase(tidy(artist)), title: smartCase(tidy(title)) };
}

/* ── ID3v2 (MP3 tags) ─────────────────────────────────────────────── */
function decodeText(bytes: Uint8Array): string {
  const enc = bytes[0], body = bytes.subarray(1);
  try {
    if (enc === 1 || enc === 2) return new TextDecoder(enc === 1 ? "utf-16" : "utf-16be").decode(body).replace(/\u0000/g, "").trim();
    if (enc === 3) return new TextDecoder("utf-8").decode(body).replace(/\u0000/g, "").trim();
    return new TextDecoder("latin1").decode(body).replace(/\u0000/g, "").trim();
  } catch { return ""; }
}

export async function readId3(file: File): Promise<{ artist: string; title: string } | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null; // "ID3"
    const ver = head[3];
    const size = (head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9];
    const tag = new Uint8Array(await file.slice(10, 10 + Math.min(size, 512 * 1024)).arrayBuffer());
    let i = 0; const out: Record<string, string> = {};
    while (i + 10 <= tag.length) {
      const id = String.fromCharCode(tag[i], tag[i + 1], tag[i + 2], tag[i + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fsize = ver === 4
        ? (tag[i + 4] << 21) | (tag[i + 5] << 14) | (tag[i + 6] << 7) | tag[i + 7]
        : (tag[i + 4] << 24) | (tag[i + 5] << 16) | (tag[i + 6] << 8) | tag[i + 7];
      if (fsize <= 0 || i + 10 + fsize > tag.length) break;
      if (id === "TIT2" || id === "TPE1") out[id] = decodeText(tag.subarray(i + 10, i + 10 + fsize));
      i += 10 + fsize;
    }
    const title = tidy(out.TIT2 || ""), artist = tidy(out.TPE1 || "");
    return title ? { artist, title } : null;
  } catch { return null; }
}

/** Best guess for a dropped file: tags first (cleaned the same way), then the filename. */
export async function guessTrackName(file: File): Promise<{ artist: string; title: string }> {
  const fromName = parseTrackFilename(file.name);
  const tags = await readId3(file);
  if (tags?.title) {
    // tags sometimes hold "Artist - Title" in the title field
    const cleaned = parseTrackFilename(`${tags.artist ? `${tags.artist} - ` : ""}${tags.title}.x`);
    return { artist: cleaned.artist || fromName.artist, title: cleaned.title || fromName.title };
  }
  return fromName;
}
