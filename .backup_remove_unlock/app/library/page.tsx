"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import AppGate from "@/components/AppGate";
import FollowTrackButton from "@/components/FollowTrackButton";

type ScanRow = {
  id: number;
  track_title: string | null;
  track_subtitle: string | null;
  created_at: string;
};

type FollowRow = {
  id: number;
  track_title: string | null;
  track_subtitle: string | null;
};

export default function Library() {
  const supabase = createSupabaseBrowser();
  const [recent, setRecent] = useState<ScanRow[]>([]);
  const [followed, setFollowed] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ data: scans }, { data: follows }] = await Promise.all([
          supabase!
            .from("scan_events")
            .select("id,track_title,track_subtitle,created_at")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase!
            .from("track_followers")
            .select("id,track_title,track_subtitle")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (!mounted) return;
        setRecent((scans || []).filter((x: any) => x.track_title) as ScanRow[]);
        setFollowed((follows || []).filter((x: any) => x.track_title) as FollowRow[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const mostWanted = useMemo(() => {
    const map = new Map<string, { title: string; subtitle: string; count: number }>();
    for (const row of followed) {
      const title = row.track_title || "Untitled";
      const subtitle = row.track_subtitle || "unknown";
      const key = `${title}__${subtitle}`;
      const prev = map.get(key);
      map.set(key, {
        title,
        subtitle,
        count: (prev?.count || 0) + 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [followed]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "24px 16px 120px",
      }}
    >
      <AppGate />
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image src="/B-logo.png" alt="Banger" width={72} height={72} style={{ width: 72, height: 72 }} priority />
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Radar</div>
          <div style={{ opacity: 0.72, textAlign: "center", maxWidth: 560 }}>
            Fresh tracks, recent IDs and new movement across BANGER.
          </div>
        </div>

        <section style={boxStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Recent Signals</div>
          <div style={{ display: "grid", gap: 12 }}>
            {loading ? (
              <div style={innerStyle}>Loading radar...</div>
            ) : recent.length === 0 ? (
              <div style={innerStyle}>No signal yet.</div>
            ) : (
              recent.map((item) => (
                <div key={item.id} style={rowStyle}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>
                      {item.track_title || "Untitled track"}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: 15 }}>
                      {item.track_subtitle || "unknown"}
                    </div>
                  </div>
                  <FollowTrackButton
                    trackTitle={item.track_title || "Untitled track"}
                    trackSubtitle={item.track_subtitle || "unknown"}
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
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {mostWanted.length === 0 ? (
              <div style={innerStyle}>No signal yet.</div>
            ) : (
              mostWanted.map((item) => (
                <div key={`${item.title}-${item.subtitle}`} style={innerStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ opacity: 0.72 }}>{item.subtitle}</div>
                    </div>
                    <div style={{ fontWeight: 900 }}>{item.count}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const boxStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(12,12,12,0.96) 0%, rgba(5,5,5,0.96) 100%)",
  borderRadius: 24,
  padding: 18,
};

const innerStyle: React.CSSProperties = {
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  padding: 16,
  opacity: 0.9,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 20,
  padding: 16,
};
