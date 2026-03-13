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
  fontSize = 18,
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

function normalize(v: string | null | undefined) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function buildSuggestions(rows: any[]) {
  const set = new Set<string>();

  rows.forEach((track) => {
    const title = String(track.title || "").trim();
    const artist = String(track.artist || "").trim();
    if (title) set.add(title);
    if (artist) set.add(artist);
    if (title && artist) set.add(`${artist} - ${title}`);
  });

  return Array.from(set).slice(0, 40);
}

function matchesSearch(track: any, query: string) {
  const q = normalize(query);
  if (!q) return true;

  const title = normalize(track.title);
  const artist = normalize(track.artist);
  const combo = normalize(`${track.artist || ""} ${track.title || ""}`);

  return title.includes(q) || artist.includes(q) || combo.includes(q);
}

export default function ChartsPage() {
  const supabase = createSupabaseBrowser();
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [showAllUnreleased, setShowAllUnreleased] = useState(false);
  const [showAllReleased, setShowAllReleased] = useState(false);
  const [searchUnreleased, setSearchUnreleased] = useState("");
  const [searchReleased, setSearchReleased] = useState("");

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

  const unreleasedBase = useMemo(
    () => rows.filter((track: any) => !track.released).slice(0, 10),
    [rows]
  );

  const releasedBase = useMemo(
    () => rows.filter((track: any) => track.released).slice(0, 10),
    [rows]
  );

  const unreleasedRows = useMemo(
    () => unreleasedBase.filter((track: any) => matchesSearch(track, searchUnreleased)),
    [unreleasedBase, searchUnreleased]
  );

  const releasedRows = useMemo(
    () => releasedBase.filter((track: any) => matchesSearch(track, searchReleased)),
    [releasedBase, searchReleased]
  );

  const unreleasedSuggestions = useMemo(() => buildSuggestions(unreleasedBase), [unreleasedBase]);
  const releasedSuggestions = useMemo(() => buildSuggestions(releasedBase), [releasedBase]);

  function previewUrl(path: string) {
    const clean = path.startsWith("snippets/") ? path : `snippets/${path}`;
    const { data } = supabase!.storage.from("bpro_uploads").getPublicUrl(clean);
    return data.publicUrl;
  }

  function renderSearch(
    value: string,
    setValue: (v: string) => void,
    listId: string,
    suggestions: string[]
  ) {
    return (
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          list={listId}
          placeholder="Find your favourite DJ bangers"
          style={searchInputStyle}
        />
        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={`${listId}-${item}`} value={item} />
          ))}
        </datalist>
      </div>
    );
  }

  function renderTrackList(list: any[], kind: "unreleased" | "released", showAll: boolean) {
    const visible = showAll ? list : list.slice(0, 3);

    return (
      <>
        <div style={{ display: "grid", gap: 10 }}>
          {visible.map((track, index) => {
            const scans = track.scan_count || 0;
            const canPreview = !!track.previewAllowed && !!track.snippet_path;
            const isPlaying = playing === track.id;

            return (
              <div key={track.id} style={rowStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 12, alignItems: "start" }}>
                  <div style={rankStyle}>{index + 1}</div>

                  <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                    <MarqueeText text={track.title || "Untitled"} fontSize={17} fontWeight={800} />
                    <MarqueeText text={track.artist || "unknown"} fontSize={14} fontWeight={600} opacity={0.64} />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, opacity: 0.66, fontSize: 12 }}>
                      <span>{scans} scans</span>
                      <span>•</span>
                      <span>Release — {track.releaseDate}</span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
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
                          Spotify
                        </a>
                      ) : null}

                      {kind === "released" && track.beatport_url ? (
                        <a
                          href={track.beatport_url}
                          target="_blank"
                          rel="noreferrer"
                          style={secondaryBtn}
                        >
                          Beatport
                        </a>
                      ) : null}

                      {canPreview ? (
                        <button
                          type="button"
                          onClick={() => {
                            const id = `preview-${track.id}`;
                            let audio = (window as any)._bangerAudio;
if(!audio){audio = new Audio();(window as any)._bangerAudio = audio;}
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
                          {isPlaying ? "Pause" : "Preview"}
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
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "20px 14px 120px" }}>
      <style jsx global>{`
        @keyframes banger-marquee {
          0% { transform: translateX(0); }
          10% { transform: translateX(0); }
          90% { transform: translateX(calc(-100% + 220px)); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 8, marginBottom: 4 }}>
          <Image src="/B-logo.png" alt="Banger" width={62} height={62} style={{ width: 62, height: 62 }} priority />
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Charts</div>
          <div style={{ opacity: 0.62, textAlign: "center", maxWidth: 520, fontSize: 13 }}>
            Underground signals. Premium curation. BANGER scans only.
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
              <div style={{ marginTop: 12 }}>
                {renderSearch(
                  searchUnreleased,
                  setSearchUnreleased,
                  "unreleased-search-list",
                  unreleasedSuggestions
                )}

                {unreleasedRows.length === 0 ? (
                  <div style={{ opacity: 0.62, fontSize: 13 }}>No unreleased chart data yet.</div>
                ) : (
                  renderTrackList(unreleasedRows, "unreleased", showAllUnreleased)
                )}
              </div>
            </section>

            <section style={cardStyle}>
              <div style={sectionTitle}>TOP 10 BANGER RELEASED</div>
              <div style={{ marginTop: 12 }}>
                {renderSearch(
                  searchReleased,
                  setSearchReleased,
                  "released-search-list",
                  releasedSuggestions
                )}

                {releasedRows.length === 0 ? (
                  <div style={{ opacity: 0.62, fontSize: 13 }}>No released chart data yet.</div>
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
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
  backdropFilter: "blur(10px)",
};

const rowStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 16,
  padding: 12,
};

const rankStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.06)",
  fontWeight: 900,
  fontSize: 13,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.18em",
  opacity: 0.7,
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
};

const showMoreBtn: React.CSSProperties = {
  marginTop: 12,
  padding: "9px 12px",
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "#fff",
  borderRadius: 12,
  padding: "11px 12px",
  outline: "none",
  fontSize: 13,
};
