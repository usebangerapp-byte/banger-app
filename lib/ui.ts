import type { CSSProperties } from "react";

/**
 * BANGER design system — one look for every tab, taken from the Upgrade page:
 * black ground, white heavy sans for titles, mono "catalogue" labels, hairline
 * rows instead of boxed cards, round pills, gold used only as a small accent.
 */

export const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
export const SANS = "var(--font-geist-sans), -apple-system, system-ui, sans-serif";

export const C = {
  bg: "#000",
  fg: "#fff",
  text2: "rgba(255,255,255,0.62)",
  text3: "rgba(255,255,255,0.40)",
  text4: "rgba(255,255,255,0.28)",
  line: "rgba(255,255,255,0.09)",
  lineSoft: "rgba(255,255,255,0.05)",
  surface: "rgba(255,255,255,0.03)",
  gold: "#e8b84a",
  rel: "#3ccf7a",
  unrel: "#f0b440",
  danger: "rgba(255,90,90,0.85)",
};

export const ui: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: C.bg, color: C.fg, padding: "20px 0 140px", overflowX: "hidden", fontFamily: SANS },
  shell: { maxWidth: 560, margin: "0 auto", padding: "0 22px", display: "grid", gap: 44, boxSizing: "border-box", width: "100%" },

  // Page header ("catalogue" line + big title)
  catalogue: {
    display: "flex", justifyContent: "space-between", gap: 12, fontFamily: MONO, fontSize: 9,
    letterSpacing: "0.3em", color: C.text4, paddingBottom: 12, borderBottom: `1px solid ${C.lineSoft}`,
  },
  title: { margin: "26px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 },
  subtitle: { margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.text3 },

  // Sections
  section: { display: "grid", gap: 0, minWidth: 0 },
  label: { fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.3em", color: C.text4, textTransform: "uppercase", paddingBottom: 12, borderBottom: `1px solid ${C.lineSoft}` },

  // List rows
  row: { display: "flex", alignItems: "center", gap: 14, padding: "18px 0", borderBottom: `1px solid ${C.lineSoft}`, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: 700, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowSub: { fontSize: 12, color: C.text3, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rank: { fontFamily: MONO, fontSize: 10, color: C.text4, width: 22, flexShrink: 0 },

  // Buttons
  pill: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, lineHeight: 1,
    background: "transparent", color: C.fg, border: "1px solid rgba(255,255,255,0.16)",
    cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
  },
  pillSolid: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, lineHeight: 1,
    background: C.fg, color: "#000", border: "1px solid transparent",
    cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
  },
  pillSmall: {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999,
    fontSize: 11, fontWeight: 600, lineHeight: 1, background: "transparent", color: C.text2,
    border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
  },
  cta: {
    width: "100%", padding: "15px", borderRadius: 6, border: "none", cursor: "pointer",
    background: C.fg, color: "#000", fontFamily: MONO, fontWeight: 700, fontSize: 11, letterSpacing: "0.24em",
  },
  more: { justifySelf: "start", background: "none", border: "none", padding: "16px 0 0", fontFamily: MONO, fontSize: 9, letterSpacing: "0.24em", color: C.text3, cursor: "pointer" },

  // Inputs
  input: {
    width: "100%", boxSizing: "border-box", background: "transparent", border: "none",
    borderBottom: `1px solid ${C.line}`, color: C.fg, fontSize: 14, padding: "12px 0", outline: "none",
  },

  empty: { fontSize: 13, color: C.text3, padding: "18px 0" },
  avatar: {
    width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900,
  },
  toast: {
    position: "fixed", bottom: 110, left: "50%", transform: "translateX(-50%)", zIndex: 999,
    background: "rgba(18,18,18,0.96)", border: `1px solid ${C.line}`, borderRadius: 999,
    padding: "10px 18px", fontSize: 13, fontWeight: 600, color: C.fg, whiteSpace: "nowrap",
  },
};

/** REL / UNREL / PRO tags — one style everywhere. */
export function tag(kind: "rel" | "unrel" | "pro" | "neutral"): CSSProperties {
  const color = kind === "rel" ? C.rel : kind === "unrel" ? C.unrel : kind === "pro" ? C.gold : C.text3;
  return {
    fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", lineHeight: 1,
    padding: "4px 7px", borderRadius: 4, border: `1px solid ${color}`, color, flexShrink: 0, whiteSpace: "nowrap",
    opacity: 0.9,
  };
}
