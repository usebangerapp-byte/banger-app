"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BottomNav from "@/components/BottomNav";

type Item = {
  title: string;
  subtitle: string;
  tag: string;
  ts: number;
};

const KEY = "banger_recent_v1";

function readItems(): Item[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 30);
  } catch {
    return [];
  }
}

export default function LibraryPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    setItems(readItems());
  }, []);

  const empty = items.length === 0;

  const badgeBg = useMemo(() => {
    return (tag: string) => {
      if (tag === "UNRELEASED") return "rgba(225,225,225,0.14)";
      if (tag === "RELEASED") return "rgba(225,225,225,0.10)";
      return "rgba(225,225,225,0.08)";
    };
  }, []);

  return (
    <AuthGate>
      <main style={S.page}>
        <div style={S.phone}>
          <div style={S.top}>
            <div style={S.h1}>LIBRARY</div>
            <div style={S.p}>Historique des tracks reconnues.</div>
          </div>

          <div style={S.body}>
            {empty ? (
              <div style={S.empty}>
                Rien pour l’instant. Fais un scan sur Home.
              </div>
            ) : (
              items.map((it) => (
                <div key={it.ts} style={S.card}>
                  <div style={S.row}>
                    <div style={S.title}>{it.title}</div>
                    <div style={{ ...S.badge, background: badgeBg(it.tag) }}>
                      {it.tag}
                    </div>
                  </div>
                  <div style={S.sub}>{it.subtitle}</div>
                </div>
              ))
            )}
          </div>

          <BottomNav />
        </div>
      </main>
    </AuthGate>
  );
}

const S: any = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 700px at 50% 18%, rgba(18,18,18,1) 0%, rgba(8,8,8,1) 42%, rgba(5,5,5,1) 70%, rgba(2,2,2,1) 100%)",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
  },
  phone: {
    width: "100%",
    maxWidth: 420,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  top: { paddingTop: 44, paddingLeft: 24, paddingRight: 24, textAlign: "center" },
  h1: { marginTop: 6, fontSize: 28, fontWeight: 900, letterSpacing: "0.12em" },
  p: { marginTop: 10, fontSize: 13, opacity: 0.7, letterSpacing: "0.06em" },
  body: { flex: 1, padding: "18px 24px 22px" },
  empty: {
    opacity: 0.7,
    textAlign: "center",
    marginTop: 30,
    letterSpacing: "0.06em",
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(235,235,235,0.08)",
    background: "rgba(10,10,10,0.55)",
    padding: 14,
    boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
    backdropFilter: "blur(10px)",
    marginBottom: 12,
  },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: {
    fontSize: 14,
    fontWeight: 800,
    background: "linear-gradient(180deg, rgba(235,235,235,0.95), rgba(160,160,160,0.65))",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  sub: { marginTop: 8, fontSize: 12, opacity: 0.6 },
  badge: {
    fontSize: 10,
    padding: "6px 10px",
    borderRadius: 9999,
    border: "1px solid rgba(235,235,235,0.10)",
    opacity: 0.9,
    letterSpacing: "0.12em",
    whiteSpace: "nowrap",
  },
};
