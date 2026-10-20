"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { startOAuth } from "@/lib/oauth";

export default function LandingPage() {
  const [busy, setBusy] = useState<"" | "google" | "apple">("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [word, setWord] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setWord((w) => (w + 1) % ROTATING.length), 2400);
    return () => window.clearInterval(t);
  }, []);
  const router = useRouter();

  // Already signed in → straight into the app (no need to log in again).
  useEffect(() => {
    const sb = createSupabaseBrowser();
    if (!sb) { setChecking(false); return; }
    sb.auth.getSession().then(({ data }) => {
      if (data?.session) router.replace("/home");
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);

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

  if (checking) return <main style={{ ...page, minHeight: "100vh" }} />;

  return (
    <main style={page}>
      <style>{`
        @keyframes sonar { 0% { transform: scale(.55); opacity: .7; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes wordIn { from { opacity: 0; transform: translateY(10px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
        @keyframes bFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>
      <div style={shell}>

        {/* Wordmark */}
        <div style={logoMark}>BANGER</div>

        {/* Glowing B with a gold sonar — it "listens" */}
        <div style={logoBlock}>
          <div style={{ position: "relative", width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} aria-hidden style={{
                position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(245,207,104,0.55)",
                animation: `sonar 3.6s ease-out ${i * 1.2}s infinite`,
              }} />
            ))}
            <img src="/B-glow.png" alt="BANGER" width={120} height={144} style={{ width: 120, height: "auto", position: "relative", animation: "bFloat 4s ease-in-out infinite" }} />
          </div>

          <h1 style={tagline}>
            Name any track.<br />
            <span key={word} style={{ display: "inline-block", color: "#f5cf68", animation: "wordIn .5s ease-out" }}>{ROTATING[word]}</span>
          </h1>
          <p style={sub}>Hold your phone up in the club. BANGER finds the ID and tells you the day it drops.</p>

          <div style={chips}>
            {["Scan in 10s", "Unreleased IDs", "Drop alerts"].map((c) => (
              <span key={c} style={chip}><span style={dot} />{c}</span>
            ))}
          </div>
        </div>

        {/* Auth */}
        <div style={authBlock}>
          <button onClick={() => continueWith("google")} disabled={busy !== ""} style={googleBtn}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><GoogleIcon /></span>
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

const ROTATING = ["Even unreleased.", "Even the bootleg.", "Even the edit.", "Before it drops."];

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
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
  padding: "0 24px", fontFamily: "var(--font-ui)",
};
const shell: React.CSSProperties = {
  width: "100%", maxWidth: 360,
  display: "flex", flexDirection: "column", gap: 34, padding: "40px 0 32px",
};
const logoBlock: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  gap: 0,
};
const logoInner: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20,
};
const logoMark: React.CSSProperties = {
  textAlign: "center", fontSize: 20, fontWeight: 700, letterSpacing: "0.42em",
  paddingLeft: "0.42em", // optically re-center the letter-spaced word
  color: "#fff",
  textShadow: "0 0 10px rgba(255,255,255,0.45), 0 0 28px rgba(255,255,255,0.18)",
};
const tagline: React.CSSProperties = {
  margin: "6px 0 0", fontSize: "clamp(30px,9vw,38px)", fontWeight: 800,
  letterSpacing: "-0.035em", lineHeight: 1.1, color: "#fff", minHeight: "2.2em",
};
const sub: React.CSSProperties = {
  margin: "12px 0 0", maxWidth: 320, fontSize: 15, lineHeight: 1.5, color: "rgba(255,255,255,0.6)",
};
const chips: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 18 };
const chip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
  color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
};
const dot: React.CSSProperties = { width: 6, height: 6, borderRadius: "50%", background: "#f5cf68", boxShadow: "0 0 8px #f5cf68" };
const authBlock: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 10,
};
const googleBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "16px 18px", borderRadius: 999, width: "100%",
  background: "linear-gradient(180deg, #f8d77a 0%, #d9a227 100%)", color: "#1a1000", fontWeight: 700, fontSize: 16,
  border: "none", cursor: "pointer", fontFamily: "inherit",
  boxShadow: "0 10px 30px rgba(232,170,40,0.38), inset 0 1px 0 rgba(255,255,255,0.5)",
};
const appleBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "16px 18px", borderRadius: 999, width: "100%",
  background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 600, fontSize: 16,
  border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer", fontFamily: "inherit",
  backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
};
const errorStyle: React.CSSProperties = {
  color: "#ffb7b7", fontSize: 13, textAlign: "center",
};
const note: React.CSSProperties = {
  textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.45)",
  fontWeight: 500, paddingTop: 4,
};
