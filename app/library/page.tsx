"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import FollowTrackButton from "@/components/FollowTrackButton";

type RadarItem = {
  id?: string;
  title?: string;
  artist?: string;
  scan_count?: number;
};

export default function Library() {
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch("/api/bpro/recent", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        setItems(Array.isArray(json?.items) ? json.items : []);
      } catch {
        if (!mounted) return;
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "24px 16px 120px",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image
            src="/b-logo.png"
            alt="Banger"
            width={72}
            height={72}
            style={{ width: 72, height: 72 }}
            priority
          />
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Radar</div>
          <div style={{ opacity: 0.72, textAlign: "center", maxWidth: 560 }}>
            Fresh tracks, recent IDs and new movement across BANGER.
          </div>
        </div>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "linear-gradient(180deg, rgba(12,12,12,0.96) 0%, rgba(5,5,5,0.96) 100%)",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {loading ? (
              <div style={{ opacity: 0.7 }}>Loading radar...</div>
            ) : items.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No signal yet.</div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id || `${item.title}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 14,
                    alignItems: "center",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 20,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.12 }}>
                      {item.title || "Untitled track"}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: 15 }}>
                      {item.artist || "unknown"}
                    </div>
                  </div>
                  <FollowTrackButton
                    trackTitle={item.title || "Untitled track"}
                    trackSubtitle={item.artist || "unknown"}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        <section
          style={{
            border: "1px solid rgba(0,229,255,0.14)",
            borderRadius: 24,
            padding: 18,
            background: "radial-gradient(circle at top right, rgba(0,229,255,0.10), transparent 38%), rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Most Wanted</div>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#7ef2ff",
                boxShadow: "0 0 18px rgba(126,242,255,0.95)",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              padding: 16,
              opacity: 0.78,
            }}
          >
            No signal yet
          </div>
        </section>
      </div>
    </main>
  );
}
