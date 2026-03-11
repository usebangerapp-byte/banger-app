"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const slides = [
  {
    title: "Identify any track",
    text: "Scan music around you and instantly discover the track.",
  },
  {
    title: "Discover unreleased music",
    text: "Find hidden IDs, unreleased tracks and underground music.",
  },
  {
    title: "Follow the music scene",
    text: "Track trending IDs, follow tracks and discover what DJs are playing.",
  },
];

function keyFor(email: string) {
  return `banger_onboarding_done:${email.toLowerCase()}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState("");

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
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const force = params.get("force") === "1";
          if (!force && localStorage.getItem(keyFor(userEmail)) === "1") {
            router.replace("/");
          }
        }
      } catch {
        if (!mounted) return;
        router.replace("/login");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const slide = useMemo(() => slides[index], [index]);

  function finish() {
    if (typeof window !== "undefined" && email) {
      localStorage.setItem(keyFor(email), "1");
    }
    router.replace("/");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24, display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, display: "grid", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {slides.map((_, i) => (
              <div key={i} style={{ width: i === index ? 28 : 8, height: 8, borderRadius: 999, background: i === index ? "#67f2ff" : "rgba(255,255,255,0.18)" }} />
            ))}
          </div>
          <button type="button" onClick={finish} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.72)" }}>
            Skip
          </button>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 28,
            background: "linear-gradient(180deg, rgba(10,10,10,1) 0%, rgba(4,4,4,1) 100%)",
            padding: 28,
            minHeight: 560,
            display: "grid",
            alignContent: "space-between",
            boxShadow: "0 0 80px rgba(0,229,255,0.05) inset",
          }}
        >
          <div style={{ display: "grid", gap: 22, placeItems: "center", textAlign: "center" }}>
            <Image src="/B-logo.png" alt="Banger" width={128} height={128} style={{ width: 128, height: 128 }} priority />
            <div style={{ display: "grid", gap: 12 }}>
              <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: 0 }}>{slide.title}</h1>
              <p style={{ fontSize: 16, lineHeight: 1.5, opacity: 0.78, margin: 0 }}>{slide.text}</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <button
              type="button"
              onClick={() => (index === slides.length - 1 ? finish() : setIndex(index + 1))}
              style={{
                padding: "16px 18px",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.14)",
                background: index === slides.length - 1 ? "#fff" : "rgba(0,229,255,0.14)",
                color: index === slides.length - 1 ? "#000" : "#fff",
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              {index === slides.length - 1 ? "Enter BANGER" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
