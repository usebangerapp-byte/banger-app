/** Sets (community tracklists) — shared helpers for pages and API. */

export type SetTrack = {
  id: string; position: number; start_sec: number | null;
  title: string | null; artist: string | null;            // null title = still an ID
  locked?: boolean; asks?: number; fires?: number; asked?: boolean;
  suggestions?: { key: string; title: string; artist: string; count: number; weight?: number; verified?: boolean; mine: boolean; scan?: number }[];
  named_by?: string[];
};

export function fmtTime(sec: number | null | undefined) {
  if (sec == null || !isFinite(sec)) return "";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function parseTime(t: string): number | null {
  const p = t.trim().split(":").map((x) => Number(x));
  if (!p.length || p.some((n) => !isFinite(n))) return null;
  return p.reduce((acc, n) => acc * 60 + n, 0);
}

/**
 * A name that says "we don't know": ID, ID - ID, Unknown, Untitled, TBA, ?, Track ID…
 * Such a row is a missing track (an ID), not a named one.
 */
const NO_NAME = /^(?:ids?|id\s*\d+|track\s*id|unknown(?:\s*(?:artist|track|title))?|untitled|unreleased|tba|tbc|n\/?a|none|\?+|[-–—_.]+)$/i;
export function isNoName(s: string | null | undefined) {
  const v = String(s ?? "").replace(/[()\[\]"'“”]/g, " ").replace(/\s+/g, " ").trim();
  if (!v) return true;
  if (NO_NAME.test(v)) return true;
  // "ID - ID", "Unknown - Unknown", "ID (ID Remix)", "ID ID"
  return v.split(/\s+[-–—]\s+|\s+/).every((w) => NO_NAME.test(w) || /^(?:remix|edit|mix|vip|dub|bootleg|rework)$/i.test(w));
}
/** Title + artist as stored: an unknown title makes the whole row an ID. */
export function cleanNames(title: string | null | undefined, artist: string | null | undefined) {
  const t = isNoName(title) ? null : String(title).trim();
  if (!t) return { title: null, artist: null };
  return { title: t, artist: isNoName(artist) ? null : String(artist).trim() };
}

/** "0:00 Artist - Title" / "34:10 ID" / "1:02:30 Artist – Title (X Remix)" → rows */
export function parseTracklist(text: string) {
  const rows: { start_sec: number | null; title: string | null; artist: string | null }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^\d{1,3}[.)]\s*(?=\[?\d{1,2}:\d{2})/, "").replace(/^\d+[.)]\s+/, "");
    if (!line) continue;
    const m = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—]?\s*(.*)$/);
    const start_sec = m ? parseTime(m[1]) : null;
    // "(Unreleased)", "[FREE DL]"… are notes, not part of the name
    const rest = (m ? m[2] : line).replace(/\s*[\(\[](?:unreleased|forthcoming|free\s*(?:dl|download)|out\s*now|soon)[\)\]]\s*/gi, " ").trim();
    if (isNoName(rest)) { rows.push({ start_sec, title: null, artist: null }); continue; }
    const parts = rest.split(/\s+[-–—]\s+/);
    if (parts.length >= 2) rows.push({ start_sec, ...cleanNames(parts.slice(1).join(" - "), parts[0]) });
    else rows.push({ start_sec, artist: null, title: rest });
  }
  return rows;
}

export function youtubeId(url: string): string | null {
  const m = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
export function sourceKind(url: string) {
  if (youtubeId(url)) return "YouTube";
  if (/soundcloud\.com/i.test(url)) return "SoundCloud";
  if (/mixcloud\.com/i.test(url)) return "Mixcloud";
  return "Link";
}
