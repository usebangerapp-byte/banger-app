"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { startOAuth } from "@/lib/oauth";

export default function LandingPage() {
  const [busy, setBusy] = useState<"" | "google" | "apple">("");
  const [error, setError] = useState("");

  async function continueWith(provider: "google" | "apple") {
    const supabase = createSupabaseBrowser();
    if (!supabase) { setError("Login unavailable. Try again later."); return; }
    setBusy(provider);
    setError("");
    try {
      await startOAuth(supabase, provider);
    } catch (e: any) {
      setError(e?.message || "Unable to start login.");
      setBusy("");
    }
  }

  return (
    <main style={page}>
      <div style={shell}>

        {/* Center logo */}
        <div style={logoBlock}>
          <div style={logoInner}>
            <img src="/B-logo-sm.png" alt="B" style={{
              width: 110, height: 110, objectFit: "contain",
              filter: "brightness(1.1) drop-shadow(0 0 22px rgba(255,255,255,0.20))",
            }} />
            <div style={logoMark}>BANGER</div>
          </div>
          <div style={tagline}>Identify any track.<br />Even unreleased.</div>
        </div>

        {/* Auth */}
        <div style={authBlock}>
          <button onClick={() => continueWith("google")} disabled={busy !== ""} style={googleBtn}>
            <GoogleIcon />
            {busy === "google" ? "Connecting…" : "Continue with Google"}
          </button>

          <button onClick={() => continueWith("apple")} disabled={busy !== ""} style={appleBtn}>
            <span style={{ fontSize: 17, lineHeight: 1 }}></span>
            {busy === "apple" ? "Connecting…" : "Continue with Apple"}
          </button>

          {error && <div style={errorStyle}>{error}</div>}
          <div style={note}>Free · No credit card required</div>
        </div>

      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh", background: "#000", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "0 24px",
};
const shell: React.CSSProperties = {
  width: "100%", maxWidth: 360,
  display: "flex", flexDirection: "column", gap: 52,
};
const logoBlock: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  gap: 0,
};
const logoInner: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 28,
};
const logoMark: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, letterSpacing: "0.36em",
  color: "rgba(255,255,255,0.70)",
};
const tagline: React.CSSProperties = {
  fontSize: "clamp(28px,8vw,38px)", fontWeight: 500,
  letterSpacing: "-0.02em", lineHeight: 1.18, color: "rgba(255,255,255,0.90)",
};
const authBlock: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 10,
};
const googleBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "15px 18px", borderRadius: 14, width: "100%",
  background: "#fff", color: "#000", fontWeight: 800, fontSize: 14,
  border: "none", cursor: "pointer", letterSpacing: "0.01em",
};
const appleBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "15px 18px", borderRadius: 14, width: "100%",
  background: "rgba(255,255,255,0.07)", color: "#fff", fontWeight: 800, fontSize: 14,
  border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", letterSpacing: "0.01em",
};
const errorStyle: React.CSSProperties = {
  color: "#ffb7b7", fontSize: 13, textAlign: "center",
};
const note: React.CSSProperties = {
  textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)",
  fontWeight: 600, letterSpacing: "0.06em", paddingTop: 2,
};
