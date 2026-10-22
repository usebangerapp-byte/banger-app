"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import PageHeader from "@/components/PageHeader";
import { useIsAdmin } from "@/components/AdminTrackSheet";
import { sourceKind } from "@/lib/setlists";
import { ui, C, glass } from "@/lib/ui";

type SetRow = { id: string; title: string; venue: string | null; source_url: string; cover_url: string | null; unlocked_at: string | null; total: number; known: number; asks: number };

export default function SetsPage() {
  const [sets, setSets] = useState<SetRow[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"unlocking" | "unlocked">("unlocking");
  const isAdmin = useIsAdmin();

  useEffect(() => {
    authFetch("/api/setlists", { cache: "no-store" }).then((r) => r.json())
      .then((j) => { if (j?.ok) setSets(j.sets); else { setSets([]); setError(j?.error || ""); } })
      .catch(() => setSets([]));
  }, []);

  const list = (sets || []).filter((s) => (tab === "unlocked" ? !!s.unlocked_at : !s.unlocked_at));

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader title="Sets" code={isAdmin ? <Link href="/sets/new" style={{ color: C.gold, textDecoration: "none" }}>+ Add a set</Link> : undefined} />

        <div style={{ ...glass, display: "grid", gridTemplateColumns: "1fr 1fr", padding: 4, borderRadius: 999 }}>
          {(["unlocking", "unlocked"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ height: 40, borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 15,
              fontWeight: tab === t ? 700 : 600, background: tab === t ? "rgba(255,255,255,0.14)" : "transparent", color: tab === t ? "#fff" : C.text2 }}>
              {t === "unlocking" ? "🔓 Unlocking" : "✅ Unlocked"}
            </button>
          ))}
        </div>

        {sets === null ? <div style={ui.empty}>Loading…</div>
          : error ? <div style={ui.empty}>{error}</div>
          : list.length === 0 ? <div style={ui.empty}>{tab === "unlocking" ? "No sets being unlocked right now." : "No set fully unlocked yet."}</div>
          : list.map((s) => {
            const pct = s.total ? Math.round((s.known / s.total) * 100) : 0;
            const left = s.total - s.known;
            return (
              <Link key={s.id} href={`/sets/${s.id}`} style={{ ...glass, borderRadius: 22, padding: 12, display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "#fff" }}>
                <div style={{ width: 84, height: 84, borderRadius: 16, flexShrink: 0, background: s.cover_url ? `center/cover no-repeat url(${s.cover_url})` : "linear-gradient(160deg,#3a2c12,#0b0b0b)" }} />
                <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[s.venue, sourceKind(s.source_url)].filter(Boolean).join(" · ")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: s.unlocked_at ? C.rel : C.goldGrad }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.unlocked_at ? C.rel : C.gold }}>{s.known}/{s.total}</span>
                  </div>
                  {!s.unlocked_at && <div style={{ fontSize: 12, color: C.text3 }}>{left} ID{left === 1 ? "" : "s"} left{s.asks ? ` · ${s.asks} want to know` : ""}</div>}
                </div>
              </Link>
            );
          })}
      </div>
    </main>
  );
}
