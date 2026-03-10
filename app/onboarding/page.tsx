"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const slides = [
  {
    title: "Identify any track",
    text: "Scan music around you and instantly discover the track.",
    icon: "scan",
  },
  {
    title: "Discover unreleased music",
    text: "Find hidden IDs, unreleased tracks and underground music.",
    icon: "radar",
  },
  {
    title: "Follow the music scene",
    text: "Track trending IDs, follow tracks and discover what DJs are playing.",
    icon: "scene",
  },
];

function SlideArt({ type }: { type: string }) {
  if (type === "scan") {
    return (
      <div style={{ width: 180, height: 180, borderRadius: 999, border: "1px solid rgba(0,229,255,0.35)", display: "grid", placeItems: "center", boxShadow: "0 0 40px rgba(0,229,255,0.12) inset" }}>
        <div style={{ width: 112, height: 112, borderRadius: 999, border: "1px solid rgba(0,229,255,0.55)" }} />
      </div>
    );
  }

  if (type === "radar") {
    return (
      <div style={{ width: 180, height: 180, borderRadius: 22, border: "1px solid rgba(0,229,255,0.18)", padding: 16, display: "grid", placeItems: "center" }}>
        <div style={{ width: 120, height: 120, borderRadius: 999, border: "1px solid rgba(0,229,255,0.35)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 18, borderRadius: 999, border: "1px solid rgba(0,229,255,0.28)" }} />
          <div style={{ position: "absolute", left: 58, top: 10, width: 4, height: 40, background: "rgba(0,229,255,0.65)", transformOrigin: "bottom center", transform: "rotate(28deg)" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 180, height: 180, borderRadius: 22, border: "1px solid rgba(0,229,255,0.18)", padding: 18, display: "grid", gap: 10 }}>
      <div style={{ height: 20, borderRadius: 10, background: "rgba(0,229,255,0.18)" }} />
      <div style={{ height: 20, width: "75%", borderRadius: 10, background: "rgba(255,255,255,0.10)" }} />
      <div style={{ marginTop: 10, height: 64, borderRadius: 16, background: "rgba(255,255,255,0.05)" }} />
      <div style={{ height: 20, width: "60%", borderRadius: 10, background: "rgba(0,229,255,0.18)" }} />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("banger_onboarding_done") === "1") {
      router.replace("/");
    }
  }, [router]);

  function finish() {
    if (typeof window !== "undefined") {
      localStorage.setItem("banger_onboarding_done", "1");
    }
    router.replace("/");
  }

  function next() {
    if (index >= slides.length - 1) {
      finish();
      return;
    }
    setIndex(index + 1);
  }

  function prev() {
    if (index <= 0) return;
    setIndex(index - 1);
  }

  const current = slides[index];

  return (
    <main
      onTouchStart={(e) => setTouchStart(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX ?? null;
        if (touchStart === null || end === null) return;
        const diff = touchStart - end;
        if (diff > 40) next();
        if (diff < -40) prev();
        setTouchStart(null);
      }}
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 24,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, display: "grid", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {slides.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === index ? 28 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: i === index ? "#00E5FF" : "rgba(255,255,255,0.18)",
                  transition: "all 180ms ease",
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={finish}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.72)",
              fontSize: 14,
            }}
          >
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
            <SlideArt type={current.icon} />

            <div style={{ display: "grid", gap: 12 }}>
              <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: 0 }}>
                {current.title}
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.5, opacity: 0.78, margin: 0 }}>
                {current.text}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <button
              type="button"
              onClick={index === slides.length - 1 ? finish : next}
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
