"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import PageHeader from "@/components/PageHeader";

const MONO = "var(--font-geist-mono), ui-monospace, monospace";

const PERKS = [
  { label: "The full unreleased chart", sub: "Every ID moving through the scene — not just the top 3." },
  { label: "Upload your IDs", sub: "Drop your unreleased tracks into the BANGER database." },
  { label: "Priority in the charts", sub: "Your tracks ranked first when they get scanned." },
  { label: "Scan statistics", sub: "See where and how often your music is being scanned." },
  { label: "Release control", sub: "Flip UNREL → REL the day you drop." },
  { label: "10s audio snippet", sub: "Let the crowd hear a teaser before the release." },
];

const TICKER = "UNRELEASED  ✦  IDS  ✦  UPLOAD  ✦  CHARTS  ✦  SCAN STATS  ✦  RELEASE CONTROL  ✦  ";

// Film-grain texture (inline SVG noise)
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>")`;

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createSupabaseBrowser();
      if (!sb) return;
      const { data } = await sb.auth.getUser();
      setAuthed(!!data.user);
      if (data.user) setIsPro((await getBrowserRole()) === "pro");
    })();
  }, []);

  const handleUpgrade = async () => {
    if (!authed) { router.push("/login"); return; }
    setLoading(true);
    try {
      const sb = createSupabaseBrowser()!;
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else alert("Something went wrong. Try again.");
    } catch {
      alert("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={page}>
      <style>{`
        @keyframes bngr-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
      <div aria-hidden style={grain} />

      <div style={shell}>

        {/* ── Catalogue line ── */}
        <PageHeader title="Upgrade" sub="Go PRO and unlock the full scene." code="CAT. 001" />

        {/* ── Headline ── */}
        <header>
          <h1 style={headline}>
            UNLOCK<br />
            <span style={outline}>THE</span><br />
            UNRELEASED.
          </h1>
          <p style={intro}>
            For the DJs and producers who move first. Upload your IDs,
            see the whole underground chart, and watch your tracks travel.
          </p>
        </header>
      </div>

      {/* ── Ticker ── */}
      <div style={tickerWrap} aria-hidden>
        <div style={tickerTrack}>{TICKER.repeat(4)}</div>
      </div>

      <div style={shell}>

        {/* ── Perks ── */}
        <section>
          <div style={sectionLabel}>WHAT YOU GET</div>
          {PERKS.map((p, i) => (
            <div key={p.label} style={perkRow}>
              <span style={perkNum}>{String(i + 1).padStart(2, "0")}</span>
              <div style={{ minWidth: 0 }}>
                <div style={perkLabel}>{p.label}</div>
                <div style={perkSub}>{p.sub}</div>
              </div>
            </div>
          ))}
          <div style={freeNote}>
            Free stays free — unlimited scans, released charts and the top 3 unreleased.
          </div>
        </section>

        {/* ── Price ── */}
        <section style={{ display: "grid", gap: 10 }}>
          <div style={sectionLabel}>ENTRY</div>
          <div style={price}>€9.99</div>
          <div style={priceNote}>PER MONTH · CANCEL ANYTIME</div>
        </section>

        {/* ── CTA ── */}
        <section style={{ display: "grid", gap: 16 }}>
          {isPro ? (
            <div style={alreadyPro}>✦ YOU&apos;RE ALREADY PRO</div>
          ) : (
            <button
              style={{ ...cta, opacity: loading ? 0.6 : 1 }}
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? "REDIRECTING…" : authed ? "START PRO  →" : "SIGN IN TO UPGRADE  →"}
            </button>
          )}
          <div style={footer}>
            <span>SECURE PAYMENT — STRIPE</span>
            <span>MANAGE IN ⚙ SETTINGS</span>
          </div>
        </section>

      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  position: "relative", minHeight: "100vh", background: "#000", color: "#fff",
  padding: "28px 0 140px", overflowX: "hidden",
};
const grain: React.CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
  backgroundImage: GRAIN, opacity: 0.09, mixBlendMode: "screen",
};
const shell: React.CSSProperties = {
  position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto",
  padding: "0 22px", display: "grid", gap: 56,
};
const catalogue: React.CSSProperties = {
  display: "flex", justifyContent: "space-between",
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.28em", color: "rgba(255,255,255,0.4)",
  paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.1)",
};
const headline: React.CSSProperties = {
  margin: 0, fontSize: "clamp(46px, 14vw, 88px)", fontWeight: 900,
  letterSpacing: "-0.05em", lineHeight: 0.88,
};
const outline: React.CSSProperties = {
  color: "transparent", WebkitTextStroke: "1.5px rgba(255,255,255,0.85)",
};
const intro: React.CSSProperties = {
  margin: "28px 0 0", maxWidth: 420, fontSize: 15, lineHeight: 1.75, color: "rgba(255,255,255,0.55)",
};
const tickerWrap: React.CSSProperties = {
  position: "relative", zIndex: 1, margin: "56px 0",
  borderTop: "1px solid rgba(255,255,255,0.12)", borderBottom: "1px solid rgba(255,255,255,0.12)",
  overflow: "hidden", whiteSpace: "nowrap", padding: "14px 0",
};
const tickerTrack: React.CSSProperties = {
  display: "inline-block", fontFamily: MONO, fontSize: 11, letterSpacing: "0.3em",
  color: "rgba(255,255,255,0.55)", animation: "bngr-ticker 28s linear infinite",
};
const sectionLabel: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.3em", color: "rgba(255,255,255,0.35)", marginBottom: 8,
};
const perkRow: React.CSSProperties = {
  display: "flex", gap: 18, alignItems: "baseline", padding: "22px 0",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};
const perkNum: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.3)", width: 22, flexShrink: 0,
};
const perkLabel: React.CSSProperties = { fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" };
const perkSub: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6, lineHeight: 1.6 };
const freeNote: React.CSSProperties = {
  marginTop: 22, fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.35)", fontStyle: "italic",
};
const price: React.CSSProperties = {
  fontFamily: MONO, fontSize: "clamp(56px, 16vw, 84px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1,
};
const priceNote: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: "0.24em", color: "rgba(255,255,255,0.45)",
};
const cta: React.CSSProperties = {
  width: "100%", padding: "20px 18px", borderRadius: 6, border: "none", cursor: "pointer",
  background: "#fff", color: "#000", fontFamily: MONO, fontWeight: 700, fontSize: 14, letterSpacing: "0.22em",
  transition: "opacity 0.15s",
};
const alreadyPro: React.CSSProperties = {
  textAlign: "center", padding: "20px 18px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.25)",
  fontFamily: MONO, fontSize: 13, letterSpacing: "0.22em",
};
const footer: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
  fontFamily: MONO, fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)",
};
