"use client";

import { fmtTitle, fmtArtist } from "@/lib/format";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import PageHeader from "@/components/PageHeader";
import { useIsAdmin } from "@/components/AdminTrackSheet";
import { sourceKind } from "@/lib/setlists";
import { ui, C, glass } from "@/lib/ui";

type SetRow = { id: string; title: string; venue: string | null; played_on?: string | null; source_url: string; cover_url: string | null; unlocked_at: string | null; total: number; known: number; asks: number; played?: string[] };

// accents, case and punctuation don't matter: "anotr" finds "ANOTR", "cafe" finds "Café"
const fold = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export default function SetsPage() {
  const [sets, setSets] = useState<SetRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const isAdmin = useIsAdmin();

  useEffect(() => {
    authFetch("/api/setlists", { cache: "no-store" }).then((r) => r.json())
      .then((j) => { if (j?.ok) setSets(j.sets); else { setSets([]); setError(j?.error || ""); } })
      .catch(() => setSets([]));
  }, []);

  // One list. Search: every word must be found in the DJs, the venue / event, the date, the platform or a track played.
  const words = fold(q).split(" ").filter(Boolean);
  const hitIn = (s: SetRow) => {
    if (!words.length) return { ok: true, track: "" };
    const head = fold([s.title, s.venue, s.played_on, sourceKind(s.source_url)].filter(Boolean).join(" "));
    const tracks = (s.played || []).map((t) => ({ t, f: fold(t) }));
    const all = head + " " + tracks.map((x) => x.f).join(" ");
    if (!words.every((w) => all.includes(w))) return { ok: false, track: "" };
    const track = words.some((w) => !head.includes(w)) ? (tracks.find((x) => words.some((w) => !head.includes(w) && x.f.includes(w)))?.t || "") : "";
    return { ok: true, track };
  };
  const list = (sets || []).map((s) => ({ s, h: hitIn(s) })).filter((x) => x.h.ok);

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader title="Sets" code={isAdmin ? <Link href="/sets/new" style={{ color: C.gold, textDecoration: "none" }}>+ Add a set</Link> : undefined} />
        {isAdmin && <Link href="/sets/review" style={{ ...ui.pill, justifyContent: "center", color: C.gold, borderColor: "rgba(245,207,104,0.35)", textDecoration: "none" }}>🔎 Review IDs</Link>}

        {/* Set mode (Pro): record the tracklist of your own set — lives with the Sets */}
        <Link href="/set" style={{ ...glass, borderRadius: 20, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#fff" }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,207,104,0.12)", border: "1px solid rgba(245,207,104,0.25)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="18" cy="16" r="3" /></svg>
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Get my tracklist</span>
          <span style={{ color: C.text4 }}>›</span>
        </Link>

        <div style={{ position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth={2.2} strokeLinecap="round" aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a DJ, a track, a venue…" type="search"
            style={{ ...ui.input, width: "100%", boxSizing: "border-box", padding: "12px 14px 12px 40px", borderRadius: 999 }} />
        </div>

        {sets === null ? <div style={ui.empty}>Loading…</div>
          : error ? <div style={ui.empty}>{error}</div>
          : list.length === 0 ? <div style={ui.empty}>{q ? "No set matches." : "No sets yet."}</div>
          : list.map(({ s, h }) => {
            const pct = s.total ? Math.round((s.known / s.total) * 100) : 0;
            const left = s.total - s.known;
            const done = s.total > 0 && left === 0;
            return (
              <Link key={s.id} href={`/sets/${s.id}`} style={{ ...glass, borderRadius: 22, padding: 12, display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "#fff" }}>
                <div style={{ width: 84, height: 84, borderRadius: 16, flexShrink: 0, background: s.cover_url ? `center/cover no-repeat url(${s.cover_url})` : "linear-gradient(160deg,#3a2c12,#0b0b0b)" }} />
                <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtArtist(s.title)}</div>
                  <div style={{ fontSize: 13, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[s.venue, sourceKind(s.source_url)].filter(Boolean).join(" · ")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: done ? C.rel : C.goldGrad }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: done ? C.rel : C.gold }}>{s.known}/{s.total}</span>
                  </div>
                  {done
                    ? <div style={{ fontSize: 12, fontWeight: 700, color: C.rel }}>✅ Unlocked</div>
                    : <div style={{ fontSize: 12, color: C.text3 }}>{left} ID{left === 1 ? "" : "s"} left{s.asks ? ` · ${s.asks} want to know` : ""}</div>}
                  {h.track && <div style={{ fontSize: 12, color: C.gold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>▶ Played: {h.track}</div>}
                </div>
              </Link>
            );
          })}
      </div>
    </main>
  );
}
