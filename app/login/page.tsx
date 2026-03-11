"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function keyFor(email: string) {
  return `banger_onboarding_done:${email.toLowerCase()}`;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase!.auth.getSession();
        const email = data.session?.user?.email?.toLowerCase();
        if (!mounted || !email) return;

        const r = await fetch(`/api/bpro/unlock-status?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => null);

        if (!mounted) return;

        if (!j?.unlocked) {
          router.replace("/unlock");
          return;
        }

        if (typeof window !== "undefined" && localStorage.getItem(keyFor(email)) !== "1") {
          router.replace("/onboarding");
          return;
        }

        router.replace("/");
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function continueWithGoogle() {
    setBusy(true);
    setError("");

    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://banger-app-zeta.vercel.app";

      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      });

      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Unable to start Google login.");
      setBusy(false);
    }
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
      <div style={{ width: "100%", maxWidth: 420, display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 14 }}>
          <Image
            src="/B-logo.png"
            alt="Banger"
            width={120}
            height={120}
            style={{ width: 120, height: 120, objectFit: "contain" }}
            priority
          />
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em" }}>BANGER</div>
          <div style={{ opacity: 0.74, textAlign: "center" }}>Log in to access Banger.</div>
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
            cursor: "pointer",
          }}
        >
          {busy ? "Connecting..." : "Continue with Google"}
        </button>

        <button
          type="button"
          disabled
          style={{
            padding: "15px 18px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.55)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Apple — Coming soon
        </button>

        <button
          type="button"
          disabled
          style={{
            padding: "15px 18px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.55)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Instagram — Coming soon
        </button>

        {error ? <div style={{ color: "#ffb7b7", textAlign: "center" }}>{error}</div> : null}

        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.78 }}>
          <Link href="/privacy" style={{ color: "#fff", textDecoration: "none" }}>Privacy Policy</Link>
          {" · "}
          <Link href="/terms" style={{ color: "#fff", textDecoration: "none" }}>Terms of Service</Link>
        </div>
      </div>
    </main>
  );
}
