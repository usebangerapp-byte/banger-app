"use client";

import React from "react";

export default function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "6px 0 16px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.28em",
        color: "rgba(255,255,255,0.35)",
        marginBottom: 4,
      }}>BANGER</div>
      <div style={{
        fontSize: 22,
        fontWeight: 900,
        letterSpacing: "0.04em",
        color: "#fff",
      }}>{title}</div>
      {sub && (
        <div style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          marginTop: 4,
          letterSpacing: "0.02em",
        }}>{sub}</div>
      )}
    </div>
  );
}
