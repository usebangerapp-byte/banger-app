"use client";

import React from "react";
import { C } from "@/lib/ui";

/**
 * Page header shared by every tab: UPPERCASE title + one grey sentence,
 * optional status capsule on the right (glass).
 */
export default function PageHeader({ title, sub, code }: { title: string; sub?: string; code?: React.ReactNode }) {
  return (
    <header style={wrap}>
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
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
