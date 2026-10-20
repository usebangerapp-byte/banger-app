"use client";

import React from "react";
import { C, MONO } from "@/lib/ui";

/**
 * Page header shared by every tab: one compact band at the top —
 * UPPERCASE title (left) + small mono code (right), the sentence under it, then a hairline.
 */
export default function PageHeader({ title, sub, code }: { title: string; sub?: string; code?: React.ReactNode }) {
  return (
    <header style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={titleStyle}>{title.toUpperCase()}</h1>
        {code && <span style={codeStyle}>{code}</span>}
      </div>
      {sub && <p style={subStyle}>{sub}</p>}
    </header>
  );
}

const wrap: React.CSSProperties = {
  display: "grid", gap: 6, paddingBottom: 16, borderBottom: `1px solid ${C.lineSoft}`,
};
const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "0.26em", lineHeight: 1.2, color: C.fg,
};
const codeStyle: React.CSSProperties = {
  fontFamily: MONO, fontSize: 9, letterSpacing: "0.3em", color: C.text4, whiteSpace: "nowrap",
};
const subStyle: React.CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: 1.5, color: C.text3,
};
