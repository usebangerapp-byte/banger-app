"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Provider = "google" | "apple" | "instagram";

const BG =
  "radial-gradient(900px 700px at 50% 18%, rgba(18,18,18,1) 0%, rgba(8,8,8,1) 45%, rgba(3,3,3,1) 100%)";

function ProviderIcon({ p }: { p: Provider }) {
  const common: React.CSSProperties = { width: 18, height: 18, opacity: 0.9, flexShrink: 0 };
  if (p === "google") {
    return (
      <svg viewBox="0 0 24 24" style={common} aria-hidden="true">
        <path
          fill="currentColor"
          d="M21.35 11.1H12v2.95h5.35c-.25 1.55-1.82 4.55-5.35 4.55-3.22 0-5.85-2.66-5.85-5.95S8.78 6.7 12 6.7c1.84 0 3.08.78 3.78 1.46l2.58-2.48C16.78 4.2 14.6 3.2 12 3.2 6.99 3.2 2.9 7.28 2.9 12.6S6.99 22 12 22c6.06 0 9.1-4.25 9.1-8.05 0-.55-.06-.96-.15-1.35Z"
        />
      </svg>
    );
  }
  if (p === "apple") {
    return (
      <svg viewBox="0 0 24 24" style={common} aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.6 13.2c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.6-1.6-3.1-1.6-1.3-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.8-.4 6.8 1.1 9.1.7 1.1 1.6 2.4 2.7 2.3 1.1 0 1.5-.7 2.9-.7 1.4 0 1.7.7 2.9.7 1.2 0 2-.1 3.2-2.2.8-1.2 1.1-2.3 1.1-2.4-.1 0-2.6-1-2.6-3.9ZM14.4 6.8c.6-.8 1.1-1.9 1-3-1 .1-2.2.7-2.9 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4Z"
        />
      </svg>
    );
  }
  // instagram (simple glyph)
  return (
    <svg viewBox="0 0 24 24" style={common} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.5 2.9h9c2.5 0 4.6 2.1 4.6 4.6v9c0 2.5-2.1 4.6-4.6 4.6h-9c-2.5 0-4.6-2.1-4.6-4.6v-9c0-2.5 2.1-4.6 4.6-4.6Zm9 2.2h-9c-1.3 0-2.4 1.1-2.4 2.4v9c0 1.3 1.1 2.4 2.4 2.4h9c1.3 0 2.4-1.1 2.4-2.4v-9c0-1.3-1.1-2.4-2.4-2.4Zm-4.5 3.6a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.6-2.4a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z"
      />
    </svg>
  );
}

function useParticlesCanvas(enabled: boolean) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    const particles = Array.from({ length: 140 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.4,
      a: 0.06 + Math.random() * 0.16,
      s: 0.0004 + Math.random() * 0.0011, // speed
      drift: (Math.random() - 0.5) * 0.0004,
      tw: Math.random() * Math.PI * 2,
    }));

    function resize() {
      w = Math.max(1, canvas.clientWidth);
      h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    let raf = 0;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h);

      // subtle "mist"
      ctx.fillStyle = "rgba(255,255,255,0.015)";
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.y += p.s;
        p.x += p.drift;
        p.tw += 0.02;

        if (p.y > 1.05) p.y = -0.05;
        if (p.x > 1.05) p.x = -0.05;
        if (p.x < -0.05) p.x = 1.05;

        const px = p.x * w;
        const py = p.y * h;

        const twinkle = 0.55 + 0.45 * Math.sin(p.tw);
        const alpha = p.a * twinkle;

        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(4)})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    const onResize = () => resize();
    resize();
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return ref;
}

export default function LoginScreen() {
  const supabase = createSupabaseBrowser();

  const [reveal, setReveal] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const canClick = reveal && !loadingProvider;

  const particlesRef = useParticlesCanvas(true);

  useEffect(() => {
    const t = window.setTimeout(() => setReveal(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  async function signIn(p: Provider) {
    if (!reveal) return;
    setLoadingProvider(p);
    try {
      await supabase.auth.signInWithOAuth({
        // NOTE: supabase providers are lowercase strings
        provider: p as any,
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
    } finally {
      setLoadingProvider(null);
    }
  }

  const btnBase: React.CSSProperties = useMemo(
    () => ({
      width: "100%",
      padding: "14px 14px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
      cursor: canClick ? "pointer" : "not-allowed",
      opacity: canClick ? 1 : 0.55,
      fontWeight: 800,
      letterSpacing: "0.04em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      position: "relative",
      overflow: "hidden",
      userSelect: "none",
    }),
    [canClick]
  );

  function Btn({ p, label }: { p: Provider; label: string }) {
    const busy = loadingProvider === p;
    return (
      <button
        type="button"
        onClick={() => signIn(p)}
        disabled={!canClick || busy}
        style={{
          ...btnBase,
          background: busy ? "rgba(255,255,255,0.10)" : btnBase.background,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            transform: "translateX(-120%)",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.10), rgba(255,255,255,0.00))",
            transition: "transform 650ms ease",
          }}
          className="sheen"
        />
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ opacity: 0.92, display: "inline-flex", alignItems: "center" }}>
            <ProviderIcon p={p} />
          </span>
          <span>{busy ? "Authenticating…" : label}</span>
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      {/* soft halo */}
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          background:
            "radial-gradient(500px 380px at 50% 22%, rgba(255,255,255,0.08), rgba(255,255,255,0.00) 70%)",
          filter: "blur(0px)",
          pointerEvents: "none",
        }}
      />

      {/* logo video layer */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: 0,
          transform: "translateY(6px) scale(1.02)",
          animation: "logoIn 650ms ease forwards",
        }}
      >
    <video
     autoPlay
     loop
     muted
     playsInline
     style={{
        width: 340,
        maxWidth: "82vw",
        height: "auto",
        objectFit: "contain",
        pointerEvents: "none",
        filter: "contrast(1.12) brightness(1.05)",
      }}
    >
      <source src="/Bangervidlogo.transparent.webm" type="video/webm"  />
    </video>      
</div>

      {/* particles ABOVE logo */}
      <canvas
        ref={particlesRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: 0.9,
          filter: "blur(0.15px)",
        }}
      />

      {/* auth panel */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          zIndex: 2,
          marginTop: 180,
          opacity: reveal ? 1 : 0,
          transform: reveal ? "translateY(0px)" : "translateY(10px)",
          transition: "opacity 550ms ease, transform 550ms ease",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Btn p="google" label="Continue with Google" />
          <Btn p="apple" label="Continue with Apple" />
          <Btn p="instagram" label="Continue with Instagram" />
        </div>

        <div style={{ height: 14 }} />

        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.62 }}>
          By continuing you agree to the{" "}
          <a href="/terms" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>
            Privacy Policy
          </a>
          .
        </div>
      </div>

      {/* footer */}
      <div
        style={{
          position: "absolute",
          bottom: 22,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 11,
          opacity: 0.45,
          zIndex: 2,
        }}
      >
        <a href="/terms" style={{ color: "rgba(255,255,255,0.80)", textDecoration: "none" }}>
          Terms
        </a>
        {" · "}
        <a href="/privacy" style={{ color: "rgba(255,255,255,0.80)", textDecoration: "none" }}>
          Privacy
        </a>
        {" · "}
        <a href="/contact" style={{ color: "rgba(255,255,255,0.80)", textDecoration: "none" }}>
          Contact
        </a>
      </div>

      <style>{`
        @keyframes logoIn {
          from { opacity: 0; transform: translateY(8px) scale(1.02); }
          to   { opacity: 1; transform: translateY(0px) scale(1); }
        }
        button:hover .sheen {
          transform: translateX(120%);
        }
        a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
