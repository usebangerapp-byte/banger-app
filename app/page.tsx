"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LandingPage() {
  const [busy, setBusy] = useState<"" | "google" | "apple">("");
  const [error, setError] = useState("");

  async function continueWith(provider: "google" | "apple") {
    const supabase = createSupabaseBrowser();
    if (!supabase) { setError("Login unavailable. Try again later."); return; }
    setBusy(provider);
    setError("");
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://usebanger.com";
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Unable to start login.");
      setBusy("");
    }
  }

  return (
    <main style={page}>
      <div style={shell}>

        {/* Logo */}
        <div style={logoWrap}>
          <div style={logoB}>B</div>
          <div style={logoText}>BANGER</div>
        </div>

        {/* Hero */}
        <div style={heroBlock}>
          <h1 style={headline}>Identify any track.<br />Even unreleased ones.</h1>
          <p style={sub}>
            Scan what DJs play — before it drops.<br />
            Follow tracks & get notified the moment they release.
          </p>
        </div>

        {/* Features */}
        <div style={features}>
          <Feature icon="🎵" text="Scan any track in seconds" />
          <Feature icon="🔔" text="Follow unreleased IDs" />
          <Feature icon="📈" text="See what the scene is playing" />
        </div>

        {/* Auth */}
        <div style={authBlock}>
          <button onClick={() => continueWith("google")} disabled={busy !== ""} style={googleBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {busy === "google" ? "Connecting…" : "Continue with Google"}
          </button>

          <button onClick={() => continueWith("apple")} disabled={busy !== ""} style={appleBtn}>
            <span style={{ fontSize: 18, lineHeight: 1 }}></span>
            {busy === "apple" ? "Connecting…" : "Continue with Apple"}
          </button>

          {error && <div style={errorStyle}>{error}</div>}
          <div style={freeNote}>Free plan available · No credit card required</div>
        </div>

      </div>
    </main>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={featureRow}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{text}</span>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh", background: "#000", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "0 20px",
};
const shell: React.CSSProperties = {
  width: "100%", maxWidth: 400,
  display: "flex", flexDirection: "column", gap: 36,
  paddingTop: 40, paddingBottom: 48,
};
const logoWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
};
const logoB: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 14,
  background: "#fff", color: "#000",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 26, fontWeight: 900, letterSpacing: "-0.04em",
  flexShrink: 0,
};
const logoText: React.CSSProperties = {
  fontSize: 22, fontWeight: 900, letterSpacing: "0.14em",
};
const heroBlock: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const headline: React.CSSProperties = {
  margin: 0, fontSize: "clamp(30px,8vw,42px)", fontWeight: 900,
  letterSpacing: "-0.03em", lineHeight: 1.1,
};
const sub: React.CSSProperties = {
  margin: 0, fontSize: 15, lineHeight: 1.6,
  color: "rgba(255,255,255,0.55)", fontWeight: 500,
};
const features: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 12,
  padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const featureRow: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center" };
const authBlock: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const googleBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "15px 18px", borderRadius: 16, width: "100%",
  background: "#fff", color: "#000", fontWeight: 800, fontSize: 15,
  border: "none", cursor: "pointer",
};
const appleBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "15px 18px", borderRadius: 16, width: "100%",
  background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 15,
  border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer",
};
const errorStyle: React.CSSProperties = {
  color: "#ffb7b7", fontSize: 13, textAlign: "center", padding: "4px 0",
};
const freeNote: React.CSSProperties = {
  textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.35)",
  fontWeight: 600, letterSpacing: "0.04em", paddingTop: 4,
};
