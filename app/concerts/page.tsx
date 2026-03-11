"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import AppGate from "@/components/AppGate";
import FollowTrackButton from "@/components/FollowTrackButton";

type TrackRow = {
  id: string;
  title: string | null;
  artist: string | null;
  scan_count: number | null;
  release_date?: string | null;
};

type UploadRow = {
  title: string | null;
  snippet_path: string | null;
  allow_preview: boolean | null;
  release_date: string | null;
};

export default function ChartsPage() {
  const supabase = createSupabaseBrowser();
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [{ data: chartRows, error: chartError }, { data: uploadRows, error: uploadError }] = await Promise.all([
          supabase!
            .from("unreleased_tracks")
            .select("id,title,artist,scan_count,release_date")
            .order("scan_count", { ascending: false })
            .limit(10),
          supabase!
            .from("bpro_uploads")
            .select("title,snippet_path,allow_preview,release_date")
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

        if (!mounted) return;
        if (chartError) throw chartError;
        if (uploadError) throw uploadError;

        const map: Record<string, UploadRow> = {};
        for (const row of (uploadRows || []) as UploadRow[]) {
          const key = String(row.title || "").trim().toLowerCase();
          if (key && !map[key]) map[key] = row;
        }

        setUploads(map);
        setTracks((chartRows || []) as TrackRow[]);
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

  const rows = useMemo(() => {
    return tracks.map((track) => {
      const key = String(track.title || "").trim().toLowerCase();
      const upload = uploads[key];
      return {
        ...track,
        previewAllowed: !!upload?.allow_preview && !!upload?.snippet_path,
        snippetPath: upload?.snippet_path || null,
        releaseDate: track.release_date || upload?.release_date || null,
      };
    });
  }, [tracks, uploads]);

  function previewUrl(path: string) {
    const { data } = supabase!.storage.from("bpro_uploads").getPublicUrl(path);
    return data.publicUrl;
  }

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
          <Image
            src="/B-logo.png"
            alt="Banger"
            width={70}
            height={70}
            style={{ width: 70, height: 70 }}
            priority
          />
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>Charts</div>
          <div style={{ opacity: 0.72, textAlign: "center", maxWidth: 560 }}>
            Top unreleased tracks by total scans on BANGER.
          </div>
        </div>

        {loading ? (
          <div style={cardStyle}>Loading charts...</div>
        ) : error ? (
          <div style={cardStyle}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={cardStyle}>No chart data yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((track, index) => {
              const scans = track.scan_count || 0;
              const releaseDate = track.releaseDate || "Unknown";
              const canPreview = !!track.previewAllowed && !!track.snippetPath;
              const isPlaying = playing === track.id;

              return (
                <div key={track.id} style={rowStyle}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start" }}>
                    <div style={rankStyle}>{index + 1}</div>

                    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>
                        {track.title || "Untitled"}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, opacity: 0.76, fontSize: 14 }}>
                        <span>{scans} scans</span>
                        <span>•</span>
                        <span>Release date — {releaseDate}</span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
                        <FollowTrackButton
                          trackTitle={track.title || "Untitled"}
                          trackSubtitle={track.artist || "unknown"}
                        />

                        {canPreview ? (
                          <button
                            type="button"
                            onClick={() => {
                              const id = `preview-${track.id}`;
                              const audio = document.getElementById(id) as HTMLAudioElement | null;
                              if (!audio) return;

                              document.querySelectorAll("audio[data-chart-preview='1']").forEach((node) => {
                                const a = node as HTMLAudioElement;
                                if (a !== audio) a.pause();
                              });

                              if (audio.paused) {
                                audio.play();
                                setPlaying(track.id);
                              } else {
                                audio.pause();
                                setPlaying(null);
                              }
                            }}
                            style={secondaryBtn}
                          >
                            {isPlaying ? "Pause preview" : "Listen preview"}
                          </button>
                        ) : null}
                      </div>

                      {canPreview ? (
                        <audio
                          id={`preview-${track.id}`}
                          data-chart-preview="1"
                          src={previewUrl(track.snippetPath!)}
                          onEnded={() => setPlaying((current) => (current === track.id ? null : current))}
                          style={{ display: "none" }}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 22,
  padding: 18,
};

const rowStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 22,
  padding: 16,
};

const rankStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontWeight: 900,
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
