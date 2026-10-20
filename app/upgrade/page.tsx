"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createSupabaseBrowser();
      if (!sb) return;
      const { data } = await sb.auth.getUser();
      setAuthed(!!data.user);
    })();
  }, []);

  const handleUpgrade = async () => {
    if (!authed) { router.push("/login"); return; }
    setLoading(true);
    try {
      const sb = createSupabaseBrowser()!;
      const { data: { session } } = await sb.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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
      <div style={shell}>

        {/* ── HEADER ── */}
        <div style={{ paddingTop: 8 }}>
          <div style={eyebrow}>BANGER PRO</div>
          <h1 style={title}>GO PRO.</h1>
          <p style={subtitle}>
            Upload your unreleased tracks. Get scanned by the scene.
            Watch your IDs spread worldwide.
          </p>
        </div>

        {/* ── COMPARE FREE VS PRO ── */}
        <div style={compareWrap}>
          <div style={compareCol}>
            <div style={planLabel}>FREE</div>
            {FREE_ITEMS.map((item) => (
              <div key={item} style={compareRow}>
                <span style={checkNo}>✕</span>
                <span style={compareText}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
          <div style={compareCol}>
            <div style={{ ...planLabel, color: "#fff" }}>PRO ✦</div>
            {PRO_ITEMS.map((item) => (
              <div key={item.label} style={compareRow}>
                <span style={checkYes}>✓</span>
                <div>
                  <div style={compareText}>{item.label}</div>
                  {item.sub && <div style={compareSub}>{item.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRICING ── */}
        <div style={pricingCard}>
          <div style={pricingEyebrow}>MONTHLY PLAN</div>
          <div style={pricingPrice}>
            €9.99<span style={{ fontSize: 16, fontWeight: 500, opacity: 0.6 }}>/mo</span>
          </div>
          <div style={pricingNote}>Cancel anytime. No commitment.</div>
        </div>

        {/* ── CTA ── */}
        <button
          style={{ ...ctaBtn, opacity: loading ? 0.6 : 1 }}
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? "Redirecting…" : authed ? "Start PRO — €9.99/mo" : "Sign in to upgrade"}
        </button>

        <div style={disclaimer}>
          Secure payment via Stripe · Cancel anytime from Settings
        </div>

      </div>
    </main>
  );
}

const FREE_ITEMS = [
  "Full unreleased charts",
  "Upload unreleased tracks",
  "Priority in unreleased charts",
  "Track scan statistics",
  "Release control",
  "10s audio preview snippet",
];

const PRO_ITEMS = [
  { label: "Full unreleased charts", sub: "See every ID charting, not just the top 3" },
  { label: "Upload your IDs", sub: "Submit unreleased tracks to the database" },
  { label: "Priority in unreleased charts", sub: "Your tracks ranked first" },
  { label: "Scan statistics", sub: "See how many times you've been scanned" },
  { label: "Release control", sub: "Flip UNREL → REL when you drop" },
  { label: "10s audio snippet", sub: "Let fans hear a teaser before the drop" },
];

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
  padding: "24px 18px 120px",
};
const shell: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};
const eyebrow: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.22em",
  opacity: 0.45,
  fontWeight: 800,
};
const title: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "clamp(42px, 12vw, 72px)",
  fontWeight: 900,
  letterSpacing: "-0.04em",
  lineHeight: 0.9,
};
const subtitle: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: 15,
  opacity: 0.55,
  lineHeight: 1.6,
};
const compareWrap: React.CSSProperties = {
  display: "flex",
  gap: 0,
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};
const compareCol: React.CSSProperties = {
  flex: 1,
  padding: "18px 14px",
  display: "grid",
  gap: 10,
};
const planLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.18em",
  opacity: 0.45,
  marginBottom: 2,
};
const compareRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
};
const compareText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.3,
};
const compareSub: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.45,
  marginTop: 1,
  lineHeight: 1.3,
};
const checkNo: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(255,255,255,0.2)",
  flexShrink: 0,
  marginTop: 1,
};
const checkYes: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(29,185,84,1)",
  flexShrink: 0,
  fontWeight: 900,
  marginTop: 1,
};
const pricingCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 20,
  padding: "20px 18px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
  textAlign: "center",
  display: "grid",
  gap: 6,
};
const pricingEyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.28em",
  opacity: 0.4,
};
const pricingPrice: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  letterSpacing: "-0.03em",
};
const pricingNote: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.45,
};
const ctaBtn: React.CSSProperties = {
  padding: "16px",
  borderRadius: 16,
  width: "100%",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  fontSize: 16,
  border: "none",
  cursor: "pointer",
  letterSpacing: "0.02em",
  transition: "opacity 0.15s",
};
const disclaimer: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.35,
  textAlign: "center",
};
