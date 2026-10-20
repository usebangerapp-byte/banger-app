"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import PageHeader from "@/components/PageHeader";
import { ui, C, glass } from "@/lib/ui";


const PERKS = [
  { label: "The full unreleased chart", sub: "Every ID moving through the scene, not just the top 3." },
  { label: "Upload your IDs", sub: "Drop your unreleased tracks into BANGER." },
  { label: "Scan statistics", sub: "See where and how often your music is scanned." },
  { label: "Release control", sub: "Flip Unreleased → Released the day you drop." },
  { label: "Priority in the charts", sub: "Your tracks ranked first when they get scanned." },
];

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
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader title="Pro" sub="Unlock the whole scene." />

        <section style={{ textAlign: "center", padding: "26px 8px 8px", display: "grid", gap: 10 }}>
          <h2 style={headline}>Every unreleased ID.<br />Before everyone else.</h2>
          <p style={intro}>For the DJs and producers who move first.</p>
        </section>

        <section style={{ ...glass, borderRadius: 24, padding: "4px 18px" }}>
          {PERKS.map((p, i) => (
            <div key={p.label} style={{ ...perkRow, borderBottom: i === PERKS.length - 1 ? "none" : perkRow.borderBottom }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M5 12l5 5 9-10" />
              </svg>
              <div style={{ minWidth: 0 }}>
                <div style={perkLabel}>{p.label}</div>
                <div style={perkSub}>{p.sub}</div>
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gap: 12, textAlign: "center", paddingTop: 6 }}>
          {isPro ? (
            <div style={alreadyPro}>You&apos;re already Pro ✦</div>
          ) : (
            <button style={{ ...ui.cta, opacity: loading ? 0.6 : 1 }} onClick={handleUpgrade} disabled={loading}>
              {loading ? "Redirecting…" : authed ? "Go Pro · €9.99 / month" : "Sign in to go Pro"}
            </button>
          )}
          <div style={footer}>Cancel anytime · Secure payment with Stripe</div>
          <div style={freeNote}>Free stays free: unlimited scans, released charts and the top 3 unreleased.</div>
        </section>
      </div>
    </main>
  );
}

const headline: React.CSSProperties = {
  margin: 0, fontSize: "clamp(30px, 9vw, 40px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.06,
};
const intro: React.CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.5, color: C.text2 };
const perkRow: React.CSSProperties = {
  display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.lineSoft}`,
};
const perkLabel: React.CSSProperties = { fontSize: 16, fontWeight: 600 };
const perkSub: React.CSSProperties = { fontSize: 13, color: C.text3, marginTop: 2, lineHeight: 1.45 };
const alreadyPro: React.CSSProperties = {
  ...glass, padding: "16px", borderRadius: 999, fontSize: 15, fontWeight: 600, color: C.gold,
};
const footer: React.CSSProperties = { fontSize: 13, color: C.text3 };
const freeNote: React.CSSProperties = { fontSize: 12, color: C.text4, lineHeight: 1.5, padding: "0 20px" };
