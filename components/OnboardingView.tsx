"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ui, C, MONO } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";

type Plan = "public" | "pro";

// --- À ajuster facilement ---
const CONTACT_EMAIL = "contact@usebanger.com";
const PRO_PRICE = "€9.99 / mo"; // placeholder
// ----------------------------

const plans: {
  key: Plan;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
}[] = [
  {
    key: "public",
    name: "PUBLIC",
    price: "Free",
    description: "Scan tracks, follow the underground, and never lose an ID again.",
    features: [
      "Unlimited scans",
      "Live radar & trends",
      "Top 3 unreleased charts",
      "Full released charts",
      "Events & DJs near you",
      "Your profile",
    ],
    cta: "Start for Free",
  },
  {
    key: "pro",
    name: "PRO",
    price: PRO_PRICE,
    description: "Upload and test your unreleased tracks, get seen at events, and see exactly how your music moves.",
    features: [
      "Everything in Public, plus:",
      "Full unreleased charts",
      "Upload your unreleased tracks",
      "Share & test with the scene",
      "Get seen at events",
      "Track scans & performance",
      "City & event trends",
      "Global scan data",
      "Track-potential predictions",
      "Early trend detection",
      "Best release-timing insights",
    ],
    cta: "Go Pro",
  },
];

export default function OnboardingView() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function choosePlan(plan: Plan) {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      if (!supabase) { router.replace("/home"); return; }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { router.replace("/home"); return; }

      // Free plan → just set role and go
      if (plan === "public") {
        await supabase.from("profiles").upsert(
          { id: user.id, email: user.email || null, role: "public", plan_selected_at: new Date().toISOString() },
          { onConflict: "id" }
        );
        // One-time welcome notification (server side)
        const { data: s } = await supabase.auth.getSession();
        if (s?.session?.access_token) {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session.access_token}` },
            body: JSON.stringify({ action: "welcome" }),
          }).catch(() => {});
        }
        router.replace("/home");
        return;
      }

      // PRO → redirect to Stripe Checkout
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { router.replace("/home"); return; }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        console.error("Stripe error:", json.error);
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  return (
    <main style={ui.page}>
      <div style={{ ...ui.shell, gap: 44 }}>
        <header>
          <PageHeader title="Pick your plan" sub="Find the IDs, follow the DJs, stay ahead of every drop." code="STEP 01" />
          <h1 style={{ ...ui.title, fontSize: "clamp(28px, 8vw, 40px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.98 }}>
            HOW DO YOU<br /><span style={{ color: "transparent", WebkitTextStroke: "1.5px rgba(255,255,255,0.85)" }}>WANT TO</span><br />PLAY.
          </h1>
        </header>

        {plans.map((plan) => (
          <section key={plan.key} style={ui.section}>
            <div style={{ ...ui.label, display: "flex", justifyContent: "space-between", color: plan.key === "pro" ? C.gold : C.text3 }}>
              <span>{plan.key === "pro" ? "✦ PRO" : "FREE"}</span>
              <span>{plan.price}</span>
            </div>
            <p style={{ margin: "18px 0 6px", fontSize: 13, lineHeight: 1.6, color: C.text2 }}>{plan.description}</p>
            {plan.features.map((feature) => (
              <div key={feature} style={{ ...ui.row, padding: "12px 0" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.text4 }}>—</span>
                <span style={{ fontSize: 13 }}>{feature}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => choosePlan(plan.key)}
              disabled={loading}
              style={plan.key === "pro"
                ? { ...ui.cta, marginTop: 20, opacity: loading ? 0.6 : 1 }
                : { ...ui.pill, marginTop: 20, width: "100%", padding: "14px" }}
            >
              {loading && plan.key === "pro" ? "REDIRECTING…" : plan.key === "pro" ? "GO PRO  →" : plan.cta}
            </button>
          </section>
        ))}

        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: C.text4 }}>
          By continuing, you agree to our{" "}
          <a href="/terms" style={{ color: C.text3 }}>Terms</a> &amp;{" "}
          <a href="/privacy" style={{ color: C.text3 }}>Privacy</a>, and to receive
          event updates by email. Opt out anytime.
        </p>
      </div>
    </main>
  );
}
