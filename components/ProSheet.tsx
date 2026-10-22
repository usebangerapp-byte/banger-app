"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ui, C, glass } from "@/lib/ui";

export type ProKind = "follow" | "radar" | "charts" | "sets";

const COPY: Record<ProKind, { title: string; text: string }> = {
  follow: { title: "Follow every ID you find", text: "Free accounts follow 3 tracks. Go Pro to follow unlimited IDs and get notified the day they drop." },
  radar:  { title: "See what the scene is scanning", text: "The full Radar and Most wanted are Pro." },
  charts: { title: "Unlock the full Top 100", text: "Free shows the Top 3. Pro shows everything, with search." },
  sets:   { title: "Unlock the full tracklist", text: "Every track, every ID, from 0:00 to the end." },
};

const EVT = "banger-open-pro";
/** Open the Pro sheet from anywhere. */
export function openPro(kind: ProKind) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVT, { detail: kind }));
}

/** Mounted once (in the top bar); shows the right message for what the person tried to open. */
export function ProSheetHost() {
  const router = useRouter();
  const [kind, setKind] = useState<ProKind | null>(null);
  useEffect(() => {
    const on = (e: Event) => setKind((e as CustomEvent).detail as ProKind);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  if (!kind || typeof document === "undefined") return null;
  const c = COPY[kind];
  return createPortal(
    <div onClick={() => setKind(null)} style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...glass, background: "rgba(20,20,20,0.97)", width: "100%", maxWidth: 520, borderRadius: "26px 26px 0 0",
        padding: "22px 20px calc(24px + env(safe-area-inset-bottom))", display: "grid", gap: 12, textAlign: "center", justifyItems: "center" }}>
        <span style={{ width: 52, height: 52, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(245,207,104,0.12)", border: "1px solid rgba(245,207,104,0.3)", boxShadow: "0 0 24px rgba(245,207,104,0.25)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={2.1} strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
        </span>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>{c.title}</div>
        <div style={{ fontSize: 15, color: C.text2, lineHeight: 1.5, maxWidth: 360 }}>{c.text}</div>
        <button onClick={() => { setKind(null); router.push(`/upgrade?from=${kind}`); }} style={{ ...ui.cta, width: "100%", marginTop: 6 }}>Start 7-day free trial</button>
        <div style={{ fontSize: 12, color: C.text3 }}>7 days free, then €9.99/month. Cancel anytime.</div>
        <button onClick={() => setKind(null)} style={{ background: "none", border: "none", color: C.text3, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 6 }}>Not now</button>
      </div>
    </div>,
    document.body
  );
}

/** A locked list row: same height as a track row, blurred placeholder, opens the Pro sheet. */
export function LockedRow({ rank, kind, last, bigRank }: { rank?: number; kind: ProKind; last?: boolean; bigRank?: boolean }) {
  return (
    <button onClick={() => openPro(kind)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 0", background: "none",
      border: "none", borderBottom: last ? "none" : `1px solid ${C.lineSoft}`, cursor: "pointer", fontFamily: "inherit", color: "#fff", textAlign: "left" }}>
      {rank !== undefined && <span style={bigRank ? { width: 34, flexShrink: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: C.gold, opacity: 0.6 } : { ...ui.rank, width: 18 }}>{rank}</span>}
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: "50%", border: `1px dashed ${C.lineSoft}`, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 7, filter: "blur(5px)", opacity: 0.7 }} aria-hidden>
        <span style={{ height: 13, width: `${55 + ((rank || 1) * 13) % 35}%`, borderRadius: 6, background: "rgba(255,255,255,0.45)" }} />
        <span style={{ height: 10, width: `${30 + ((rank || 1) * 7) % 25}%`, borderRadius: 6, background: "rgba(255,255,255,0.25)" }} />
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, flexShrink: 0,
        color: C.gold, background: "rgba(245,207,104,0.10)", border: "1px solid rgba(245,207,104,0.30)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
        Pro
      </span>
    </button>
  );
}
