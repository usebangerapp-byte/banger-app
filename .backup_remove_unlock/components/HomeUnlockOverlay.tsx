"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function HomeUnlockOverlay() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);

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

        const r = await fetch(`/api/bpro/unlock-status?email=${encodeURIComponent(userEmail)}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => null);

        if (!mounted) return;

        if (j?.unlocked) {
          setReady(true);
          return;
        }

        setTimeout(() => {
          if (mounted) {
            setReady(true);
            setShow(true);
          }
        }, 2500);
      } catch {
        if (!mounted) return;
        router.replace("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  if (!ready || !show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.72)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 24,
          background: "#070707",
          padding: 22,
          display: "grid",
          gap: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900 }}>Unlock full app</div>
        <div style={{ opacity: 0.78, lineHeight: 1.5 }}>
          Upload 1 unreleased track to unlock the full BANGER experience.
        </div>
        <div style={{ opacity: 0.68, fontSize: 14 }}>
          Full tracks are not stored. Banger keeps only an audio fingerprint for recognition.
        </div>
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
          Upload unreleased
        </Link>
      </div>
    </div>
  );
}
