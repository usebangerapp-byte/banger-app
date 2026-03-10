"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [soon, setSoon] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase!.auth.getSession();
        if (!mounted) return;
        if (data.session?.user?.email) {
          router.replace("/unlock");
        }
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function continueWithGoogle() {
    setBusy(true);
    setError("");
    setSoon("");

    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://banger-app-zeta.vercel.app";

      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || "Unable to start Google login.");
      setBusy(false);
    }
  }

  function comingSoon(provider: string) {
    setError("");
    setSoon(`${provider} login coming soon.`);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 460, display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 14 }}>
          <video
            src="/logobangeranim.mp4"
            autoPlay
            loop
            muted
            playsInline
            style={{ width: "min(220px, 60vw)", height: "auto", objectFit: "contain" }}
          />
          <div style={{ fontSize: 14, opacity: 0.74, textAlign: "center" }}>
            Log with
          </div>
        </div>

        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={busy}
          style={{
            padding: "16px 18px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#fff",
            color: "#000",
            fontWeight: 800,
            fontSize: 17,
          }}
        >
          {busy ? "Connecting..." : "Continue with Google"}
        </button>

        <button
          type="button"
          onClick={() => comingSoon("Apple")}
          style={{
            padding: "15px 18px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Continue with Apple
        </button>

        <button
          type="button"
          onClick={() => comingSoon("Instagram")}
          style={{
            padding: "15px 18px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Continue with Instagram
        </button>

        {error ? (
          <div style={{ color: "#ffb7b7", fontSize: 14, textAlign: "center" }}>
            {error}
          </div>
        ) : null}

        {soon ? (
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 14, textAlign: "center" }}>
            {soon}
          </div>
        ) : null}

        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.78, marginTop: 4 }}>
          <Link href="/privacy" style={{ color: "#fff", textDecoration: "none" }}>
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" style={{ color: "#fff", textDecoration: "none" }}>
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
