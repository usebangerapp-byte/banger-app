"use client";

import type { ReactNode } from "react";
import { C } from "@/lib/ui";

/** Tabs as big words, the active one white and underlined in gold (the Radar look). */
export default function WordTabs<T extends string>({ items, value, onChange, right, size = 22 }: {
  items: { key: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; right?: ReactNode; size?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 20, borderBottom: `1px solid ${C.line}`, padding: "0 2px", minWidth: 0 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} aria-pressed={on}
            style={{ background: "none", border: "none", padding: "0 0 10px", marginBottom: -1, cursor: "pointer", fontFamily: "inherit",
              fontSize: size, fontWeight: 800, letterSpacing: "-0.02em", color: on ? "#fff" : C.text4, whiteSpace: "nowrap",
              borderBottom: `2px solid ${on ? C.gold : "transparent"}` }}>
            {it.label}
          </button>
        );
      })}
      {right && <><span style={{ flex: 1 }} /><span style={{ paddingBottom: 10 }}>{right}</span></>}
    </div>
  );
}
