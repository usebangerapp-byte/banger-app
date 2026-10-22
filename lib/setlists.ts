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
    if (!rest || /^id$|^id\s*[-–—]\s*id$|^\?+$|^unknown$/i.test(rest)) { rows.push({ start_sec, title: null, artist: null }); continue; }
    const parts = rest.split(/\s+[-–—]\s+/);
    if (parts.length >= 2) {
      const artist = parts[0].trim(), title = parts.slice(1).join(" - ").trim();
      rows.push({ start_sec, artist: /^id$/i.test(artist) ? null : artist, title: /^id$/i.test(title) ? null : title });
    } else rows.push({ start_sec, artist: null, title: rest });
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
