"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ok = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!ok) return;
      if (data.session) router.replace("/");
    })();
    return () => {
      ok = false;
    };
  }, [router, supabase]);

  const onGoogle = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? window.location.origin + "/auth/callback"
            : undefined,
      },
    });
  };

  return (
    <main style={S.page}>
      <div style={S.box}>
        <div style={S.logoWrap}>
          <Image
            src="/B-logo.png"
            alt="BANGER"
            fill
            priority
            style={{ objectFit: "contain" }}
          />
        </div>

        <h1 style={S.h1}>BANGER</h1>
        <p style={S.p}>Connecte-toi pour continuer.</p>

        <button
          onClick={onGoogle}
          disabled={loading}
          style={{ ...S.btn, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Connexion…" : "Continuer avec Google"}
        </button>

        <style jsx global>{`
          @keyframes pulseLogo {
            0% { transform: scale(1); opacity: 0.92; }
            50% { transform: scale(1.04); opacity: 1; }
            100% { transform: scale(1); opacity: 0.92; }
          }
        `}</style>
      </div>
    </main>
  );
}

const S: any = {
  page: {
    minHeight: "100vh",
    background: "#0b0b0c",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  box: { textAlign: "center", width: "min(420px, 100%)" },
  logoWrap: {
    margin: "0 auto 18px",
    width: 120,
    height: 120,
    position: "relative",
    filter: "drop-shadow(0 0 18px rgba(255,255,255,0.18))",
    animation: "pulseLogo 2.2s ease-in-out infinite",
  },
  h1: { letterSpacing: 6, margin: "6px 0 10px" },
  p: { opacity: 0.8, margin: "0 0 22px" },
  btn: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
};
