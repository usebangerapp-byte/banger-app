"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import FollowTrackButton from "@/components/FollowTrackButton";

type TrackRow = {
  id: string;
  title: string | null;
  artist: string | null;
  scan_count: number | null;
  snippet_path: string | null;
  allow_preview?: boolean | null;
  release_date?: string | null;
  spotify_url?: string | null;
  beatport_url?: string | null;
};

function MarqueeText({
  text,
  fontSize = 20,
  fontWeight = 800,
  opacity = 1,
}: {
  text: string;
  fontSize?: number;
  fontWeight?: number;
  opacity?: number;
}) {
  const [active, setActive] = useState(false);

  return (
    <div
      onClick={() => setActive((v) => !v)}
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        cursor: "pointer",
        opacity,
      }}
      title="Click to scroll"
    >
      <div
        style={{
          display: "inline-block",
          minWidth: "100%",
          fontSize,
          fontWeight,
          animation: active ? "banger-marquee 8s linear infinite" : "none",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function isReleased(releaseDate?: string | null) {
  if (!releaseDate) return false;
  const parsed = new Date(releaseDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= Date.now();
}

export default function ChartsPage() {
  const supabase = createSupabaseBrowser();
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [showAllUnreleased, setShowAllUnreleased] = useState(false);
  const [showAllReleased, setShowAllReleased] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase!
          .from("unreleased_tracks")
          .select("id,title,artist,scan_count,snippet_path,allow_preview,release_date,spotify_url,beatport_url")
          .order("scan_count", { ascending: false })
          .limit(50);

        if (!mounted) return;
        if (error) throw error;
        setTracks((data || []) as TrackRow[]);
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
    return tracks.map((track) => ({
      ...track,
      previewAllowed:
        !!track.snippet_path &&
        (track.allow_preview === null || track.allow_preview === undefined || track.allow_preview === true),
      releaseDate: track.release_date || "Unknown",
      released: isReleased(track.release_date),
    }));
  }, [tracks]);

  const unreleasedRows = useMemo(
    () => rows.filter((track: any) => !track.released).slice(0, 10),
    [rows]
  );

  const releasedRows = useMemo(
    () => rows.filter((track: any) => track.released).slice(0, 10),
    [rows]
  );

  function previewUrl(path: string) {
    const clean = path.startsWith("snippets/") ? path : `snippets/${path}`;
    const { data } = supabase!.storage.from("bpro_uploads").getPublicUrl(clean);
    return data.publicUrl;
  }

  function renderTrackList(list: any[], kind: "unreleased" | "released", showAll: boolean) {
    const visible = showAll ? list : list.slice(0, 3);

    return (
      <>
        <div style={{ display: "grid", gap: 12 }}>
          {visible.map((track, index) => {
            const scans = track.scan_count || 0;
            const canPreview = !!track.previewAllowed && !!track.snippet_path;
            const isPlaying = playing === track.id;

            return (
              <div key={track.id} style={rowStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start" }}>
                  <div style={rankStyle}>{index + 1}</div>

                  <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                    <MarqueeText text={track.title || "Untitled"} fontSize={20} fontWeight={800} />
                    <MarqueeText text={track.artist || "unknown"} fontSize={16} fontWeight={600} opacity={0.72} />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, opacity: 0.76, fontSize: 14 }}>
                      <span>{scans} scans</span>
                      <span>•</span>
                      <span>Release date — {track.releaseDate}</span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
                      {kind === "unreleased" ? (
                        <>
                          <FollowTrackButton
                            trackTitle={track.title || "Untitled"}
                            trackSubtitle={track.artist || "unknown"}
                          />

                          <button
                            type="button"
                            onClick={() => alert("You will be notified when this track releases on Beatport")}
                            style={secondaryBtn}
                          >
                            Notify me
                          </button>
                        </>
                      ) : null}

                      {kind === "released" && track.spotify_url ? (
                        <a
                          href={track.spotify_url}
                          target="_blank"
                          rel="noreferrer"
                          style={secondaryBtn}
                        >
                          Listen on Spotify
                        </a>
                      ) : null}

                      {kind === "released" && track.beatport_url ? (
                        <a
                          href={track.beatport_url}
                          target="_blank"
                          rel="noreferrer"
                          style={secondaryBtn}
                        >
                          Buy on Beatport
                        </a>
                      ) : null}

                      {canPreview ? (
                        <button
                          type="button"
                          onClick={() => {
                            const id = `preview-${track.id}`;
                            const audio = document.getElementById(id) as HTMLAudioElement | null;
                            if (!audio) return;

                            document.querySelectorAll("audio[data-chart-preview='1']").forEach((node) => {
                              const a = node as HTMLAudioElement;
                              if (a !== audio) {
                                a.pause();
                                a.currentTime = 0;
                              }
                            });

                            if (audio.paused) {
                              audio.play().then(() => {
                                setPlaying(track.id);
                              }).catch(() => {});
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
                        preload="none"
                        src={previewUrl(track.snippet_path!)}
                        onPlay={() => setPlaying(track.id)}
                        onPause={() => setPlaying((current) => (current === track.id ? null : current))}
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

        {!showAll && list.length > 3 ? (
          <button
            type="button"
            onClick={() => {
              if (kind === "unreleased") setShowAllUnreleased(true);
              if (kind === "released") setShowAllReleased(true);
            }}
            style={showMoreBtn}
          >
            Show more
          </button>
        ) : null}
      </>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "24px 16px 120px" }}>
      <style jsx global>{`
        @keyframes banger-marquee {
          0% { transform: translateX(0); }
          10% { transform: translateX(0); }
          90% { transform: translateX(calc(-100% + 260px)); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image src="/B-logo.png" alt="Banger" width={70} height={70} style={{ width: 70, height: 70 }} priority />
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>Charts</div>
          <div style={{ opacity: 0.72, textAlign: "center", maxWidth: 560 }}>
            Top BANGER unreleased and released tracks by total scans.
          </div>
        </div>

        {loading ? (
          <div style={cardStyle}>Loading charts...</div>
        ) : error ? (
          <div style={cardStyle}>{error}</div>
        ) : (
          <>
            <section style={cardStyle}>
              <div style={sectionTitle}>TOP 10 BANGER UNRELEASED</div>
              <div style={{ marginTop: 14 }}>
                {unreleasedRows.length === 0 ? (
                  <div>No unreleased chart data yet.</div>
                ) : (
                  renderTrackList(unreleasedRows, "unreleased", showAllUnreleased)
                )}
              </div>
            </section>

            <section style={cardStyle}>
              <div style={sectionTitle}>TOP 10 BANGER RELEASED</div>
              <div style={{ marginTop: 14 }}>
                {releasedRows.length === 0 ? (
                  <div>No released chart data yet.</div>
                ) : (
                  renderTrackList(releasedRows, "released", showAllReleased)
                )}
              </div>
            </section>
          </>
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

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: "0.18em",
  opacity: 0.75,
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const showMoreBtn: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  background: "#111",
  border: "1px solid #333",
  borderRadius: 10,
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
