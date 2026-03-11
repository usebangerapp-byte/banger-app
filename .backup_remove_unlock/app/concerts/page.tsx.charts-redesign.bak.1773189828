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
        background: "#000",
        color: "#fff",
        padding: "24px 16px 120px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image
            src="/b-logo.png"
            alt="Banger"
            width={72}
            height={72}
            style={{ width: 72, height: 72 }}
            priority
          />
          <div style={{ fontSize: 28, fontWeight: 800 }}>Charts</div>
          <div style={{ opacity: 0.7, textAlign: "center" }}>
            Most scanned unreleased tracks on BANGER.
          </div>
        </div>

        {loading ? (
          <div style={cardStyle}>Loading charts...</div>
        ) : error ? (
          <div style={cardStyle}>{error}</div>
        ) : tracks.length === 0 ? (
          <div style={cardStyle}>No chart data yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {tracks.map((track, index) => (
              <div key={track.id} style={rowStyle}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontWeight: 800,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {track.title || "Untitled"}
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.68 }}>
                      {track.artist || "unknown"}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {track.scan_count || 0}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.62 }}>scans</div>
                </div>
              </div>
            ))}
          </div>
        )}
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 20,
  padding: 16,
};
