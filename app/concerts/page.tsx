"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type ChartTrack = {
  id: string;
  title: string;
  artist: string | null;
  label: string | null;
  scan_count: number | null;
};

export default function ChartsPage() {
  const supabase = createSupabaseBrowser();
  const [tracks, setTracks] = useState<ChartTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase!
          .from("unreleased_tracks")
          .select("id,title,artist,label,scan_count")
          .order("scan_count", { ascending: false })
          .limit(10);

        if (!mounted) return;
        if (error) throw error;

        setTracks((data || []) as ChartTrack[]);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Unable to load charts.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top center, rgba(0,229,255,0.08), transparent 28%), #000",
        color: "#fff",
        padding: "24px 16px 120px",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image
            src="/b-logo.png"
            alt="Banger"
            width={76}
            height={76}
            style={{ width: 76, height: 76 }}
            priority
          />
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em" }}>Charts</div>
          <div style={{ opacity: 0.72, textAlign: "center", maxWidth: 580, fontSize: 15 }}>
            Top unreleased tracks by total scans on BANGER.
          </div>
        </div>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 26,
            padding: 18,
            background: "linear-gradient(180deg, rgba(10,10,10,0.96) 0%, rgba(4,4,4,0.96) 100%)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.30)",
            display: "grid",
            gap: 14,
          }}
        >
          {loading ? (
            <div style={cardStyle}>Loading charts...</div>
          ) : error ? (
            <div style={cardStyle}>{error}</div>
          ) : tracks.length === 0 ? (
            <div style={cardStyle}>No chart data yet.</div>
          ) : (
            tracks.map((track, index) => {
              const top3 = index < 3;
              const scans = track.scan_count || 0;

              return (
                <div
                  key={track.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 16,
                    alignItems: "center",
                    border: top3
                      ? "1px solid rgba(126,242,255,0.24)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: top3
                      ? "linear-gradient(180deg, rgba(126,242,255,0.08), rgba(255,255,255,0.03))"
                      : "rgba(255,255,255,0.03)",
                    borderRadius: 22,
                    padding: 16,
                    boxShadow: top3 ? "0 0 30px rgba(126,242,255,0.06) inset" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      display: "grid",
                      placeItems: "center",
                      background: top3 ? "rgba(126,242,255,0.18)" : "rgba(255,255,255,0.05)",
                      border: top3
                        ? "1px solid rgba(126,242,255,0.28)"
                        : "1px solid rgba(255,255,255,0.08)",
                      fontWeight: 900,
                      fontSize: 18,
                      color: "#fff",
                    }}
                  >
                    {index + 1}
                  </div>

                  <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: top3 ? 25 : 22,
                        fontWeight: 900,
                        lineHeight: 1.08,
                        letterSpacing: "-0.02em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {track.title || "Untitled"}
                    </div>
                    <div style={{ opacity: 0.72, fontSize: 15 }}>
                      {track.artist || "unknown"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", minWidth: 86 }}>
                    <div
                      style={{
                        fontSize: top3 ? 30 : 26,
                        fontWeight: 900,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {scans}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.68,
                        textTransform: "uppercase",
                        letterSpacing: "0.10em",
                      }}
                    >
                      scans
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 20,
  padding: 18,
};
