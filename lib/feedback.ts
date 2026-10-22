/** Promo feedback vocabulary (shared by the listen page, the API and the producer's Sent list). */
export type Verdict = "play" | "maybe" | "pass";
export const VERDICTS: Record<Verdict, { emoji: string; label: string }> = {
  play: { emoji: "🔥", label: "I'll play it" },
  maybe: { emoji: "👍", label: "Maybe" },
  pass: { emoji: "✋", label: "Not for me" },
};
export const TAGS_SOUND = ["Huge drop", "Groove", "Mixdown needs work", "Intro too long", "Bass too loud"];
export const TAGS_ASK = ["Send extended", "Send WAV", "Still unsigned?", "Let's collab?", "Can I remix it?"];
export const isVerdict = (v: any): v is Verdict => v === "play" || v === "maybe" || v === "pass";

/** "5 DJs · 3 listened · 🔥 2 · 👍 1 · 2 requests" */
export function promoSummary(rs: { listened_at: string | null; verdict?: Verdict | null; tags?: string[] }[]) {
  const parts = [`${rs.length} DJ${rs.length > 1 ? "s" : ""}`, `${rs.filter((r) => r.listened_at).length} listened`];
  for (const v of ["play", "maybe", "pass"] as Verdict[]) {
    const n = rs.filter((r) => r.verdict === v).length;
    if (n) parts.push(`${VERDICTS[v].emoji} ${n}`);
  }
  const asks = rs.reduce((n, r) => n + (r.tags || []).filter((t) => TAGS_ASK.includes(t)).length, 0);
  if (asks) parts.push(`${asks} request${asks > 1 ? "s" : ""}`);
  return parts.join(" · ");
}
