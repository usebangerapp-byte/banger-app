"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
            : results.map((p) => <PersonRow key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

/** Bottom sheet listing followers / following of a user. */
export function PeopleSheet({ userId, list, onClose }: { userId: string; list: "followers" | "following"; onClose: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);

  useEffect(() => {
    fetch(`/api/profile/follow?list=${list}&user_id=${userId}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => setPeople(Array.isArray(j?.people) ? j.people : []))
      .catch(() => setPeople([]));
  }, [userId, list]);

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={sheet}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={sheetTitle}>{list === "followers" ? "FOLLOWERS" : "FOLLOWING"}</div>
          <button onClick={onClose} style={clearBtn}>✕</button>
        </div>
        {people === null ? <div style={hint}>Loading…</div>
          : people.length === 0 ? <div style={hint}>{list === "followers" ? "No followers yet." : "Not following anyone yet."}</div>
          : people.map((p) => <PersonRow key={p.id} p={p} onClick={onClose} />)}
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
  display: "flex", alignItems: "center", gap: 10, padding: "9px 4px",
  borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#fff", textDecoration: "none",
};
const searchWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "0 4px 6px",
  borderBottom: "1px solid rgba(255,255,255,0.07)", color: "#fff",
};
const searchInput: React.CSSProperties = {
  flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
  color: "#fff", fontSize: 13, padding: "6px 0",
};
const clearBtn: React.CSSProperties = {
  background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", padding: 4,
};
const resultsBox: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "2px 10px", background: "rgba(255,255,255,0.02)",
};
const hint: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "10px 4px" };
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const sheet: React.CSSProperties = {
  width: "100%", maxWidth: 680, maxHeight: "70vh", overflowY: "auto",
  background: "#0e0e0e", borderTop: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "20px 20px 0 0", padding: "16px 16px calc(24px + env(safe-area-inset-bottom))",
};
const sheetTitle: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)" };
