"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function keyFor(email: string) {
  return `banger_onboarding_done:${email.toLowerCase()}`;
}

export default function UnlockPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [count, setCount] = useState(0);
  const [checking, setChecking] = useState(true);

  const remaining = useMemo(() => Math.max(0, 1 - count), [count]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase!.auth.getSession();
        const userEmail = data.session?.user?.email?.toLowerCase();
        if (!mounted) return;

        if (!userEmail) {
          router.replace("/login");
          return;
        }

        setEmail(userEmail);
      } finally {
        if (mounted) setSessionLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!email) return;

    let mounted = true;
    (async () => {
      setChecking(true);
      try {
        const r = await fetch(`/api/bpro/unlock-status?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => null);
        if (!mounted) return;
        setCount(Number(j?.count || 0));
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [email]);

  if (sessionLoading || checking) {
    return (
      <main style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "grid", placeItems: "center" }}>
        Loading unlock status...
      </main>
    );
  }

  const nextHref =
    typeof window !== "undefined" && localStorage.getItem(keyFor(email)) === "1"
      ? "/"
      : "/onboarding";

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18, paddingBottom: 80 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image src="/B-logo.png" alt="Banger" width={104} height={104} style={{ width: 104, height: 104 }} priority />
          <div style={{ fontSize: 32, fontWeight: 900 }}>Unlock Banger</div>
          <div style={{ opacity: 0.78, textAlign: "center" }}>
            Upload 1 unreleased track to unlock the full app.
          </div>
        </div>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 22,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800 }}>{count} / 1 track uploaded</div>
          <div style={{ opacity: 0.78 }}>Full tracks are not stored for access unlock.</div>
          <div style={{ opacity: 0.78 }}>Banger keeps only an audio fingerprint for recognition.</div>
          <div style={{ opacity: 0.78 }}>Released tracks do not count for unlock.</div>
          <div style={{ opacity: 0.78 }}>
            {remaining > 0 ? "Upload 1 accepted unreleased track to continue." : "Banger unlocked."}
          </div>
        </section>

        {count >= 1 ? (
          <Link
            href={nextHref}
            style={{
              display: "inline-flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "16px 18px",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "#fff",
              color: "#000",
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            Access now
          </Link>
        ) : (
          <Link
            href="/bpro?unlock=1"
            style={{
              display: "inline-flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "16px 18px",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "#fff",
              color: "#000",
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            Upload 1 Unreleased Track
          </Link>
        )}

        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.78 }}>
          <Link href="/privacy" style={{ color: "#fff", textDecoration: "none" }}>Privacy Policy</Link>
          {" · "}
          <Link href="/terms" style={{ color: "#fff", textDecoration: "none" }}>Terms of Service</Link>
        </div>
      </div>
    </main>
  );
}
