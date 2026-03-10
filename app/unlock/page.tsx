"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

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
        const user = data.session?.user;
        if (!mounted) return;

        if (!user?.email) {
          router.replace("/login");
          return;
        }

        setEmail(user.email);
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
        const r = await fetch(
          `/api/bpro/unlock-status?email=${encodeURIComponent(email)}`,
          { cache: "no-store" }
        );
        const j = await r.json().catch(() => null);
        if (!mounted) return;

        const nextCount = Number(j?.count || 0);
        setCount(nextCount);

        if (j?.unlocked) {
          router.replace("/");
        }
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [email, router]);

  if (sessionLoading || checking) {
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
        <div style={{ opacity: 0.8 }}>Loading unlock status...</div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "grid",
          gap: 18,
          paddingBottom: 80,
        }}
      >
        <div style={{ display: "grid", placeItems: "center", gap: 10, marginTop: 8 }}>
          <Image
            src="/b-logo.png"
            alt="Banger"
            width={104}
            height={104}
            style={{ width: 104, height: 104 }}
            priority
          />
          <h1 style={{ fontSize: 30, margin: 0 }}>Unlock Banger</h1>
          <div style={{ opacity: 0.78, fontSize: 15, textAlign: "center" }}>
            Upload 1 unreleased track to unlock the full app.
          </div>
        </div>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {count} / 1 track uploaded
          </div>
          <div style={{ opacity: 0.78, fontSize: 14 }}>
            Full tracks are not stored for access unlock.
          </div>
          <div style={{ opacity: 0.78, fontSize: 14 }}>
            Banger keeps only an audio fingerprint for recognition, so there is no risk of leak.
          </div>
          <div style={{ opacity: 0.78, fontSize: 14 }}>
            Released tracks do not count for unlock.
          </div>
          <div style={{ opacity: 0.78, fontSize: 14 }}>
            Upload only tracks you own or have permission to use.
          </div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>
            {remaining > 0 ? "Upload 1 accepted unreleased track to unlock Banger." : "Banger unlocked."}
          </div>
        </section>

        <Link
          href="/bpro?unlock=1"
          style={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "15px 16px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#fff",
            color: "#000",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Upload 1 Unreleased Track
        </Link>

        <button
          type="button"
          onClick={() => location.reload()}
          style={{
            padding: "13px 16px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          Refresh status
        </button>
      </div>
    </main>
  );
}
