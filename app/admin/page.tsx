"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { ui, C, glass, tag, TAG_TEXT } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";
import MarqueeText from "@/components/MarqueeText";

type Stats = {
  users: number; pros: number; newUsers7: number; scans1: number; scans7: number; scans30: number;
  foundRate7: number; uploads: number; promos: number;
  days: { day: string; scans: number }[];
  top: { title: string; artist: string; n: number; unreleased: boolean }[];
};

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ ...glass, borderRadius: 20, padding: "14px 16px", display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, color: C.text3 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.text4 }}>{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch("/api/admin/stats").then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) setError(j.error || "Not available"); else setS(j);
    }).catch(() => setError("Network error"));
  }, []);

  const max = Math.max(1, ...(s?.days || []).map((d) => d.scans));

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader title="Dashboard" sub="How BANGER is growing." />
        {error && <div style={{ ...ui.card, color: C.text2 }}>{error}</div>}
        {!s && !error && <div style={ui.empty}>Loading…</div>}
        {s && (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
            <Tile label="Users" value={s.users} sub={`+${s.newUsers7} this week`} />
            <Tile label="Pro" value={s.pros} sub={s.users ? `${Math.round((s.pros / s.users) * 100)}% of users` : undefined} />
            <Tile label="Scans today" value={s.scans1} sub={`${s.scans7} this week · ${s.scans30} in 30 days`} />
            <Tile label="Found" value={`${s.foundRate7}%`} sub="of scans this week" />
            <Tile label="Uploads" value={s.uploads} />
            <Tile label="Promos sent" value={s.promos} />
          </div>

          <section style={{ ...ui.card, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text3 }}>Scans · last 14 days</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
              {s.days.map((d, i) => (
                <div key={d.day} title={`${d.day}: ${d.scans}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 10, color: C.text3, fontVariantNumeric: "tabular-nums" }}>{d.scans || ""}</span>
                  <div style={{ width: "100%", maxWidth: 18, borderRadius: 4, height: `${Math.max(3, (d.scans / max) * 92)}%`,
                    background: i === s.days.length - 1 ? C.goldGrad : "rgba(255,255,255,0.18)" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text4 }}>
              <span>{new Date(s.days[0].day).toLocaleDateString([], { day: "numeric", month: "short" })}</span>
              <span>Today</span>
            </div>
          </section>

          <section style={{ ...ui.section, paddingBottom: 4 }}>
            <div style={ui.label}>Top tracks this week</div>
            {s.top.length === 0 ? <div style={ui.empty}>No scans yet this week.</div> : s.top.map((t, i) => (
              <div key={t.title + i} style={ui.row}>
                <span style={ui.rank}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MarqueeText text={t.title} style={ui.rowTitle} />
                  <div style={ui.rowSub}>{t.artist || "—"} · {t.n} scan{t.n === 1 ? "" : "s"}</div>
                </div>
                {t.unreleased && <span style={tag("unrel")}>{TAG_TEXT.unrel}</span>}
              </div>
            ))}
          </section>
        </>)}
      </div>
    </main>
  );
}
