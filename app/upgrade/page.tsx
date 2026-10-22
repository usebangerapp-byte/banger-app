"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import { ui, C, glass } from "@/lib/ui";


const SCENES = [
  { icon: "chart", title: "The whole underground chart", text: "Not just the top 3. Every ID moving through the scene, right now." },
  { icon: "upload", title: "Your track in their crates", text: "Upload your unreleased music. Every BANGER scan can now name it." },
  { icon: "stats", title: "See it travel", text: "Know how often your IDs get scanned, week after week." },
  { icon: "play", title: "Let them taste it", text: "A 10-second preview before anyone else can buy it." },
  { icon: "bolt", title: "Drop day, your call", text: "Flip to Released and everyone following the track gets the alert." },
  { icon: "crown", title: "First in line", text: "Your tracks get priority in the charts when they're scanned." },
];

function SceneIcon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
    upload: <path d="M12 19V5M6 11l6-6 6 6" />,
    stats: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    play: <path d="M8 5v14l11-7z" />,
    bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
    crown: <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />,
  };
  return (
    <span style={iconWrap}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>
    </span>
  );
}

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [hasYearly, setHasYearly] = useState(false);
  useEffect(() => { fetch("/api/stripe/plans").then((r) => r.json()).then((j) => { setHasYearly(!!j.yearly); if (!j.yearly) setPlan("monthly"); }).catch(() => setPlan("monthly")); }, []);
  const [vault, setVault] = useState<{ titles: string[]; total: number }>({ titles: [], total: 0 });

  // Tease the real hidden part of the unreleased chart (blurred)
  useEffect(() => {
    fetch("/api/charts").then((r) => r.json()).then((rows) => {
      const seen = new Set<string>();
      const titles: string[] = [];
      let lockedN = 0;
      for (const r of Array.isArray(rows) ? rows : []) {
        if (r.result_type !== "recognized_unreleased") continue;
        if (r.locked) { lockedN++; continue; }
        const t = String(r.track_title || "").trim();
        const k = t.toLowerCase();
        if (!t || k === "unknown" || seen.has(k)) continue;
        seen.add(k); titles.push(r.track_subtitle ? `${r.track_subtitle} - ${t}` : t);
      }
      setVault({ titles: titles.slice(3, 8), total: Math.max(0, titles.length - 3) + lockedN });
    }).catch(() => {});
  }, []);

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
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
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

  const planPicker = !isPro && hasYearly && (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
      {([["monthly", "Monthly", "€9.99 / month"], ["yearly", "Yearly", "€79 / year · save 34%"]] as const).map(([k, label, price]) => (
        <button key={k} onClick={() => setPlan(k)} style={{ ...glass, borderRadius: 18, padding: "12px 10px", cursor: "pointer", fontFamily: "inherit", color: "#fff", textAlign: "center",
          border: plan === k ? "1px solid rgba(245,207,104,0.7)" : `1px solid ${C.glassBorder}`, boxShadow: plan === k ? "0 0 18px rgba(245,207,104,0.25)" : "none" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: plan === k ? C.gold : "#fff" }}>{label}</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>{price}</div>
        </button>
      ))}
    </div>
  );
  const priceLine = plan === "yearly" ? "7 days free, then €79/year. Cancel anytime." : "7 days free, then €9.99/month. Cancel anytime.";
  const cta = isPro ? (
    <div style={alreadyPro}>You&apos;re Pro ✦ Enjoy the vault.</div>
  ) : (
    <button style={{ ...ui.cta, opacity: loading ? 0.6 : 1 }} onClick={handleUpgrade} disabled={loading}>
      {loading ? "Redirecting…" : authed ? "Start 7-day free trial" : "Sign in to go Pro"}
    </button>
  );

  return (
    <main style={ui.page}>
      <style>{`
        @keyframes proHalo { 0%,100% { opacity: .55; transform: scale(.95); } 50% { opacity: 1; transform: scale(1.06); } }
        @keyframes proFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes proShine { from { background-position: -200% 0; } to { background-position: 200% 0; } }
      `}</style>
      <div style={ui.shell}>

        {/* ── HERO ── */}
        <section style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 14, padding: "26px 6px 6px" }}>
          <h1 style={headline}>Go deeper.<br /><span style={shine}>Go Pro.</span></h1>
          <p style={intro}>For DJs and producers.</p>
          <div style={{ width: "100%", marginTop: 6, display: "grid", gap: 10 }}>{planPicker}{cta}</div>
          <div style={{ fontSize: 12, color: C.text3 }}>{isPro ? "Secure payment with Stripe" : `${priceLine} · Secure payment with Stripe`}</div>
        </section>

        {/* ── THE VAULT: real hidden chart, blurred ── */}
        <section style={{ ...glass, borderRadius: 24, padding: "16px 16px 18px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>The vault</span>
            <span style={{ fontSize: 12, color: C.text3 }}>Unreleased chart</span>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ filter: "blur(6px)", opacity: 0.75, pointerEvents: "none", userSelect: "none" }} aria-hidden>
              {(vault.titles.length ? vault.titles : ["", "", "", "", ""]).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < 4 ? `1px solid ${C.lineSoft}` : "none" }}>
                  <span style={{ color: C.gold, fontWeight: 700, width: 18 }}>{i + 4}</span>
                  {t ? <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden" }}>{t}</span>
                     : <span style={{ height: 12, width: `${50 + ((i * 17) % 40)}%`, borderRadius: 6, background: "rgba(255,255,255,0.25)" }} />}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div style={lockPill}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                {vault.total > 0 ? `${vault.total} IDs locked` : "Locked for Pro"}
              </div>
            </div>
          </div>
        </section>

        {/* ── WHAT CHANGES ── */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {SCENES.map((sc) => (
            <div key={sc.title} style={{ ...glass, borderRadius: 20, padding: 14, display: "grid", gap: 8, alignContent: "start" }}>
              <SceneIcon name={sc.icon} />
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{sc.title}</div>
              <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.4 }}>{sc.text}</div>
            </div>
          ))}
        </section>

        {/* ── CLOSING ── */}
        <section style={{ textAlign: "center", display: "grid", gap: 12, padding: "14px 4px 4px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15 }}>The scene moves fast.<br />Move first.</div>
          {cta}
          <div style={{ fontSize: 12, color: C.text4, lineHeight: 1.5 }}>Free stays free: unlimited scans, radar, released charts and the top 3 unreleased.</div>
        </section>
      </div>
    </main>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: C.gold,
  padding: "6px 12px", borderRadius: 999, background: "rgba(245,207,104,0.12)", border: "1px solid rgba(245,207,104,0.28)",
};
const headline: React.CSSProperties = {
  margin: "4px 0 0", fontSize: "clamp(36px, 11vw, 48px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02,
};
const shine: React.CSSProperties = {
  background: "linear-gradient(90deg, #d9a227 0%, #fff1c2 25%, #f5cf68 50%, #d9a227 75%, #fff1c2 100%)", backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "proShine 6s linear infinite",
};
const intro: React.CSSProperties = { margin: 0, maxWidth: 340, fontSize: 15, lineHeight: 1.5, color: C.text2 };
const iconWrap: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(245,207,104,0.12)", border: "1px solid rgba(245,207,104,0.22)",
};
const lockPill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999,
  background: "rgba(20,20,20,0.75)", border: "1px solid rgba(245,207,104,0.35)", color: C.gold, fontSize: 14, fontWeight: 600,
  backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: "0 0 24px rgba(245,207,104,0.25)",
};
const alreadyPro: React.CSSProperties = {
  ...glass, padding: "16px", borderRadius: 999, fontSize: 15, fontWeight: 600, color: C.gold, textAlign: "center",
};
