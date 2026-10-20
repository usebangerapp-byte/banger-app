"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function MoreToggle({ total, shown, open, onToggle }: { total: number; shown: number; open: boolean; onToggle: () => void }) {
  if (total <= shown) return null;
  return (
    <button onClick={onToggle} style={moreBtn}>
      {open ? "Show less" : `+${total - shown} more`}
    </button>
  );
}

type Person = { id: string; display_name: string; genre?: string | null; avatar_url?: string | null };

function Avatar({ p }: { p: Person }) {
  return (
    <div style={avatar}>
      {p.avatar_url
        ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
        : (p.display_name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function PersonRow({ p, onClick }: { p: Person; onClick?: () => void }) {
  return (
    <Link href={`/dj/${p.id}`} onClick={onClick} style={row}>
      <Avatar p={p} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.display_name}</div>
        {p.genre && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{p.genre}</div>}
      </div>
      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 14 }}>›</span>
    </Link>
  );
}

/** Discreet "find people" search — a thin line that expands into results. */
export function PeopleSearch({ selfId }: { selfId?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/profile/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const j = await r.json().catch(() => null);
        const list: Person[] = Array.isArray(j?.results) ? j.results : [];
        setResults(list.filter((p) => p.id !== selfId));
      } finally { setBusy(false); }
    }, 250);
  }, [q, selfId]);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={searchWrap}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ opacity: 0.35, flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people…" style={searchInput} />
        {q && <button onClick={() => setQ("")} style={clearBtn}>✕</button>}
      </div>
      {q.trim().length >= 2 && (
        <div style={resultsBox}>
          {busy && results.length === 0 ? <div style={hint}>Searching…</div>
            : results.length === 0 ? <div style={hint}>No one found.</div>
            : <>
                {(all ? results : results.slice(0, 4)).map((p) => <PersonRow key={p.id} p={p} />)}
                <MoreToggle total={results.length} shown={4} open={all} onToggle={() => setAll((v) => !v)} />
              </>}
        </div>
      )}
    </div>
  );
}

/** Bottom sheet listing followers / following of a user. */
export function PeopleSheet({ userId, list, onClose }: { userId: string; list: "followers" | "following"; onClose: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    fetch(`/api/profile/follow?list=${list}&user_id=${userId}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => setPeople(Array.isArray(j?.people) ? j.people : []))
      .catch(() => setPeople([]));
  }, [userId, list]);

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={sheet}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={sheetTitle}>{list === "followers" ? "Followers" : "Following"}</div>
          <button onClick={onClose} style={clearBtn}>✕</button>
        </div>
        {people === null ? <div style={hint}>Loading…</div>
          : people.length === 0 ? <div style={hint}>{list === "followers" ? "No followers yet." : "Not following anyone yet."}</div>
          : <>
              {(all ? people : people.slice(0, 8)).map((p) => <PersonRow key={p.id} p={p} onClick={onClose} />)}
              <MoreToggle total={people.length} shown={8} open={all} onToggle={() => setAll((v) => !v)} />
            </>}
      </div>
    </div>
  );
}

const avatar: React.CSSProperties = {
  width: 34, height: 34, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "12px 4px",
  borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#fff", textDecoration: "none", minWidth: 0,
};
const searchWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "2px 14px",
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, color: "rgba(255,255,255,0.6)",
  backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
};
const searchInput: React.CSSProperties = {
  flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
  color: "#fff", fontSize: 15, padding: "9px 0", fontFamily: "inherit",
};
const clearBtn: React.CSSProperties = {
  background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", padding: 4,
};
const resultsBox: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "2px 12px", background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", marginTop: 8,
};
const moreBtn: React.CSSProperties = {
  background: "none", border: "none", padding: "10px 4px 8px", color: "#f5cf68",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const hint: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "10px 4px" };
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const sheet: React.CSSProperties = {
  width: "100%", maxWidth: 680, maxHeight: "70vh", overflowY: "auto",
  background: "rgba(28,28,28,0.82)", border: "1px solid rgba(255,255,255,0.12)", borderBottom: "none",
  backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
  borderRadius: "26px 26px 0 0", padding: "16px 16px calc(24px + env(safe-area-inset-bottom))",
};
const sheetTitle: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: "#fff" };
