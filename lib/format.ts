/** BANGER display style: ARTIST in capitals, Title With Capital Letters. Display only — stored names stay as they are. */

const ACRONYMS = new Set(["DJ", "DJS", "VIP", "ID", "UK", "US", "USA", "NYC", "LA", "EP", "LP", "MC", "II", "III", "IV", "TV", "OK", "BPM"]);

function capWord(w: string, allCaps: boolean) {
  const letters = w.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return w;
  if (ACRONYMS.has(letters.toUpperCase()) && letters === letters.toUpperCase()) return w;   // DJ, VIP, ID…
  if (/\d/.test(w) && /[A-Za-z]/.test(w) && w !== w.toUpperCase() && w !== w.toLowerCase()) return w; // Back2Life
  if (/^[A-Za-z](\.[A-Za-z])+\.?$/.test(w)) return w.toUpperCase();                         // N.O.Y
  const isUpper = letters === letters.toUpperCase();
  const isLower = letters === letters.toLowerCase();
  if (!isUpper && !isLower && !allCaps) {
    // mixed case on purpose (deadmau5, McCoy, iPhone): keep, just make sure it starts with a capital
    return /^[a-zà-ÿ]/.test(w) && /[A-Z]/.test(w.slice(1)) ? w : w.charAt(0).toUpperCase() + w.slice(1);
  }
  // first letter (after any opening bracket/quote) up, the rest down
  return w.toLowerCase().replace(/^([^A-Za-zÀ-ÿ]*)([a-zà-ÿ])/, (_, p: string, c: string) => p + c.toUpperCase());
}

/** "WE SEE" → "We See", "keep on groove" → "Keep On Groove", "Out of My Head (Extended Mix)" → "Out Of My Head (Extended Mix)" */
export function fmtTitle(t: string | null | undefined): string {
  const s = String(t || "").trim();
  if (!s) return s;
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const allCaps = letters.length > 0 && letters === letters.toUpperCase();
  return s.split(/(\s+|-|\/)/).map((part) => (/^(\s+|-|\/)$/.test(part) ? part : capWord(part, allCaps))).join("");
}

/** "Rafael & Toni B" → "RAFAEL & TONI B" */
export function fmtArtist(a: string | null | undefined): string {
  return String(a || "").trim().toUpperCase().replace(/\bFT\.?(?=\s)/g, "FT.").replace(/\bFEAT\.?(?=\s)/g, "FEAT.");
}
