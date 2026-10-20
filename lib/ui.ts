import type { CSSProperties } from "react";

/**
 * BANGER design system — "Glass".
 * Black ground lit by a soft KRK-gold glow, translucent frosted cards,
 * iOS system typography, gold only for actions and the active state.
 *
 * Information (meta, dates, counts, section names) = small grey text.
 * Content (tracks, people) = white semibold text inside glass cards.
 * Actions = gold capsule buttons.
 */

export const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', var(--font-geist-sans), system-ui, sans-serif";
/** Kept for numbers only (tabular figures) — no more "technical" labels. */
export const MONO = SANS;

export const C = {
  bg: "#000",
  fg: "#fff",
  text2: "rgba(255,255,255,0.64)",
  text3: "rgba(255,255,255,0.50)",
  text4: "rgba(255,255,255,0.40)",
  line: "rgba(255,255,255,0.12)",
  lineSoft: "rgba(255,255,255,0.07)",
  surface: "rgba(255,255,255,0.07)",
  glassBorder: "rgba(255,255,255,0.12)",
  gold: "#f5cf68",
  goldDeep: "#d9a227",
  // Same gold as the scan woofer cone, with its top-left sheen
  goldGrad: "radial-gradient(130% 160% at 28% -10%, rgba(255,226,120,0.55) 0%, rgba(255,200,60,0.10) 42%, rgba(0,0,0,0) 60%), linear-gradient(180deg, #e2ad2e 0%, #c88c0f 55%, #9c6807 100%)",
  goldInk: "#1a1000",
  rel: "#5fe39a",
  unrel: "#f5cf68",
  danger: "#ff7a7a",
};

const blur = "blur(28px) saturate(160%)";

/** Frosted glass surface — spread into any card. */
export const glass: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.glassBorder}`,
  backdropFilter: blur,
  WebkitBackdropFilter: blur,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
};

export const ui: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "transparent", color: C.fg, padding: "18px 0 150px", overflowX: "hidden", fontFamily: SANS, position: "relative" },
  shell: { position: "relative", maxWidth: 560, margin: "0 auto", padding: "0 18px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18, boxSizing: "border-box", width: "100%" },

  // Legacy header pieces (PageHeader is preferred)
  catalogue: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: C.text3 },
  title: { margin: "8px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 },
  subtitle: { margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: C.text2 },

  // Glass card section: label on top, rows inside
  card: { ...glass, borderRadius: 22, padding: 18, minWidth: 0 },
  section: { ...glass, borderRadius: 22, padding: "2px 16px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0, minWidth: 0 },
  label: { fontSize: 13, fontWeight: 600, color: C.text3, padding: "14px 0 10px", borderBottom: `1px solid ${C.lineSoft}` },

  // List rows
  row: { display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: `1px solid ${C.lineSoft}`, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowSub: { fontSize: 13, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rank: { fontSize: 15, fontWeight: 700, color: C.gold, width: 22, flexShrink: 0, fontVariantNumeric: "tabular-nums" },

  // Buttons
  pill: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, lineHeight: 1,
    background: "rgba(255,255,255,0.08)", color: C.fg, border: `1px solid ${C.glassBorder}`,
    cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
  },
  pillSolid: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, lineHeight: 1,
    background: C.goldGrad, color: C.goldInk, border: "1px solid transparent",
    boxShadow: "0 6px 16px rgba(200,140,15,0.22), inset 0 1px 0 rgba(255,235,160,0.35)",
    cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
  },
  pillSmall: {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 999,
    fontSize: 12, fontWeight: 600, lineHeight: 1, background: "rgba(255,255,255,0.08)", color: C.fg,
    border: `1px solid ${C.glassBorder}`, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
  },
  cta: {
    width: "100%", padding: "16px", borderRadius: 999, border: "none", cursor: "pointer",
    background: C.goldGrad, color: C.goldInk, fontWeight: 700, fontSize: 16, fontFamily: SANS,
    boxShadow: "0 8px 24px rgba(200,140,15,0.25), inset 0 1px 0 rgba(255,235,160,0.35)",
  },
  more: { justifySelf: "start", background: "none", border: "none", padding: "12px 0 14px", fontSize: 13, fontWeight: 600, color: C.gold, cursor: "pointer", fontFamily: SANS },

  // Inputs
  input: {
    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.glassBorder}`,
    borderRadius: 14, color: C.fg, fontSize: 15, padding: "12px 14px", outline: "none", fontFamily: SANS,
  },

  empty: { fontSize: 14, color: C.text3, padding: "16px 0" },
  avatar: {
    width: 42, height: 42, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
    background: "rgba(255,255,255,0.08)", border: `1px solid ${C.glassBorder}`,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700,
  },
  toast: {
    position: "fixed", bottom: 112, left: "50%", transform: "translateX(-50%)", zIndex: 999,
    ...glass, background: "rgba(30,30,30,0.75)", borderRadius: 999,
    padding: "11px 18px", fontSize: 14, fontWeight: 600, color: C.fg, whiteSpace: "nowrap",
  },
};

/** Status capsules (Unreleased / Released / Pro) — one style everywhere. */
export function tag(kind: "rel" | "unrel" | "pro" | "neutral"): CSSProperties {
  const base: CSSProperties = {
    fontFamily: SANS, fontSize: 11, fontWeight: 600, lineHeight: 1, letterSpacing: "0.01em",
    padding: "5px 9px", borderRadius: 999, flexShrink: 0, whiteSpace: "nowrap",
  };
  if (kind === "pro") return { ...base, background: C.goldGrad, color: C.goldInk, fontWeight: 700 };
  if (kind === "rel") return { ...base, background: "rgba(95,227,154,0.14)", color: C.rel };
  if (kind === "unrel") return { ...base, background: "rgba(245,207,104,0.16)", color: C.gold };
  return { ...base, background: "rgba(255,255,255,0.08)", color: C.text2 };
}

/** Label text for tags, so the wording is the same everywhere. */
export const TAG_TEXT = { rel: "Released", unrel: "Unreleased", pro: "PRO", neutral: "" } as const;
