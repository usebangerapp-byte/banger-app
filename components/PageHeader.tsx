"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/ui";

/**
 * Page header shared by every tab: UPPERCASE title + one grey sentence,
 * optional status capsule on the right (glass). `back` adds a round ‹ button
 * that returns to the previous screen (secondary pages: track, promo, set…).
 */
export default function PageHeader({ title, sub, code, back }: { title: string; sub?: string; code?: React.ReactNode; back?: boolean }) {
  const router = useRouter();
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/home");
  }
  return (
    <header style={wrap}>
      {back && (
        <button onClick={goBack} aria-label="Back" style={backBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
        <h1 style={titleStyle}>{title.toUpperCase()}</h1>
        {sub && <p style={subStyle}>{sub}</p>}
      </div>
      {code && <span style={codeStyle}>{code}</span>}
    </header>
  );
}

const wrap: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "6px 4px 6px",
};
const backBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: "50%", flexShrink: 0, cursor: "pointer", padding: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(255,255,255,0.08)", border: `1px solid ${C.glassBorder}`, color: "#fff",
};
const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "0.16em", lineHeight: 1.2, color: C.fg,
};
const subStyle: React.CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: 1.4, color: C.text3,
};
const codeStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: C.text2, whiteSpace: "nowrap", flexShrink: 0,
  padding: "6px 11px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.glassBorder}`,
};
