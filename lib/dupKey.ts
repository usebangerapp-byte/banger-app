/** Identity of a track for duplicate detection: core title + main artist. */
const n = (s: string) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

export function dupKey(title: string, artist: string): string {
  const t = String(title || "")
    // "(Original Mix)", "(Extended Mix)", "(Radio Edit)"… are the same song; remixes are not.
    .replace(/\s*[\(\[]\s*(?:original|extended|club|radio|vocal|instrumental|dub|remaster(?:ed)?|clean|explicit)(?:\s+(?:mix|version|edit|cut))?\s*[\)\]]/gi, " ");
  const a = String(artist || "").split(/,|&|\bx\b|\bfeat\.?|\bft\.?|\bvs\.?/i)[0];
  return `${n(t)}|${n(a)}`;
}
