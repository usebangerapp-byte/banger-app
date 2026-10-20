"use client";

import React from "react";
import { ui } from "@/lib/ui";

/**
 * Page header shared by every tab (same look as the Upgrade page):
 * mono catalogue line, then a big heavy title and a short subtitle.
 */
export default function PageHeader({ title, sub, code }: { title: string; sub?: string; code?: string }) {
  return (
    <header>
      <div style={ui.catalogue}>
        <span>BNGR — {title.toUpperCase()}</span>
        {code && <span>{code}</span>}
      </div>
      <h1 style={ui.title}>{title}</h1>
      {sub && <p style={ui.subtitle}>{sub}</p>}
    </header>
  );
}
