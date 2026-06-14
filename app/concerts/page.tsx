"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

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
  result_type?: "recognized_unreleased" | "recognized_world" | "not_found" | null;
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

  return Array.from(set).slice(0, 100);
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
  const [activeChart, setActiveChart] = useState<"unreleased" | "released">("unreleased");
  const [visibleCount, setVisibleCount] = useState(10);
  const [search, setSearch] = useState("");
  const [followedTitles, setFollowedTitles] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) Charts toujours en premier (source principale)
        const chartsRes = await fetch("/api/charts").then(r => r.json()).catch(() => []);
        if (!mounted) return;

        const scanList = Array.isArray(chartsRes) ? chartsRes : [];

        // 2) bpro_tracks en enrichissement optionnel (ne bloque pas si ça plante)
        let bproList: any[] = [];
        if (supabase) {
          try {
            const bproRes = await supabase
              .from("bpro_tracks")
              .select("id,title,artist,snippet_path,allow_preview,release_url,is_released")
              .limit(500);
            bproList = (bproRes.data || []) as any[];
          } catch {}
        }

        if (!mounted) return;

        // Index bpro_tracks par titre normalisé pour enrichissement rapide
        const bproIndex = new Map<string, any>();
        for (const t of bproList) {
          const key = normalize(String(t.title || "")).slice(0, 60);
          if (key) bproIndex.set(key, t);
        }

        // Convertir chaque scan en TrackRow directement
        // Agréger par titre normalisé pour éviter les doublons unreleased+world
        const mergeMap = new Map<string, TrackRow>();

        for (const s of scanList) {
          if (!s.track_title || String(s.track_title).trim().toLowerCase() === "unknown") continue;

          const title  = String(s.track_title  || "").trim();
          const artist = String(s.track_subtitle || "").trim();
          const key    = normalize(title).slice(0, 60);

          const bpro    = bproIndex.get(key);
          const released = s.result_type === "recognized_world" || !!bpro?.is_released;

          const existing = mergeMap.get(key);
          if (existing) {
            // Additionner les scans des deux types (unreleased + world = même track)
            existing.scan_count = (existing.scan_count || 0) + (s.scans || 0);
            // Promouvoir en released si l'un des types l'est
            if (released) existing.result_type = "recognized_world";
            // Enrichir avec bpro si pas encore fait
            if (!existing.beatport_url && bpro?.beatport_url) existing.beatport_url = bpro.beatport_url || bpro.release_url;
            if (!existing.spotify_url  && bpro?.spotify_url)  existing.spotify_url  = bpro.spotify_url;
          } else {
            mergeMap.set(key, {
              id:            key,
              title:         title || null,
              artist:        artist || null,
              scan_count:    s.scans || 0,
              snippet_path:  bpro?.snippet_path || null,
              allow_preview: bpro?.allow_preview ?? null,
              release_date:  null,
              spotify_url:   bpro?.spotify_url || null,
              beatport_url:  bpro?.beatport_url || bpro?.release_url || null,
              result_type:   released ? "recognized_world" : "recognized_unreleased",
            } as TrackRow);
          }
        }

        const merged: TrackRow[] = Array.from(mergeMap.values())
          .filter(t => (t.scan_count || 0) > 0)
          .sort((a, b) => Number(b.scan_count || 0) - Number(a.scan_count || 0));

        setTracks(merged);

        // Charger tous les follows en une seule requête
        try {
          const { data: authData } = await supabase!.auth.getUser();
          const uid = authData?.user?.id || null;
          if (uid) {
            setUserId(uid);
            const res = await fetch(`/api/follow-track?user_id=${uid}`, { cache: "no-store" });
            const json = await res.json().catch(() => null);
            const followed = Array.isArray(json?.followed) ? json.followed : [];
            setFollowedTitles(new Set(followed.map((f: any) => String(f.track_title || "").trim().toLowerCase())));
          }
        } catch {}
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Unable to load charts.");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const rows = useMemo(() => {
    return tracks.map((track) => {
      const released = track.result_type === "recognized_world" || isReleased(track.release_date);

      return {
        ...track,
        previewAllowed:
          !!track.snippet_path &&
          (track.allow_preview === null || track.allow_preview === undefined || track.allow_preview === true),
        releaseDate: track.release_date || "Unknown",
        released,
      };
    });
  }, [tracks]);

  const unreleasedBase = useMemo(
    () => rows.filter((track: any) => !track.released).slice(0, 100),
    [rows]
  );

  const releasedBase = useMemo(
    () => rows.filter((track: any) => track.released).slice(0, 100),
    [rows]
  );

  const activeBase = activeChart === "unreleased" ? unreleasedBase : releasedBase;
  const suggestions = useMemo(() => buildSuggestions(activeBase), [activeBase]);

  const filteredRows = useMemo(
    () => activeBase.filter((track: any) => matchesSearch(track, search)),
    [activeBase, search]
  );

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  );

  function switchChart(next: "unreleased" | "released") {
    setActiveChart(next);
    setVisibleCount(10);
    setSearch("");
  }

  function previewUrl(path: string) {
    const clean = path.startsWith("snippets/") ? path : `snippets/${path}`;
    const { data } = supabase!.storage.from("bpro_uploads").getPublicUrl(clean);
    return data.publicUrl;
  }

  function renderTrackList(list: any[], kind: "unreleased" | "released") {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((track, index) => {
          const scans = track.scan_count || 0;
          const canPreview =
            kind === "released"
              ? !!track.snippet_path
              : !!track.previewAllowed && !!track.snippet_path;
          const isPlaying = playing === track.id;
          const artistText = String(track.artist || "").trim();
          const titleText = String(track.title || "").trim();
          const lowerArtist = artistText.toLowerCase();
          const lowerTitle = titleText.toLowerCase();
          const displayLine =
            artistText && titleText
              ? (lowerTitle.startsWith(lowerArtist + " - ")
                  ? titleText
                  : `${artistText} - ${titleText}`)
              : (titleText || artistText || "Untitled");

          return (
            <div key={track.id} style={rowStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 12, alignItems: "start" }}>
                <div style={rankStyle}>{index + 1}</div>

                <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", minWidth: 0 }}>
                    <MarqueeText text={displayLine} fontSize={17} fontWeight={800} />
                    <span style={{ fontSize: 12, opacity: 0.75 }}>• {scans} scans</span>
                    {canPreview ? (
                      <button
                        type="button"
                        onClick={() => {
                          let audio = (window as any)._bangerAudio as HTMLAudioElement | undefined;

                          if (!audio) {
                            audio = new Audio();
                            audio.preload = "none";
                            (window as any)._bangerAudio = audio;
                          }

                          if (!audio) return;

                          const nextSrc = previewUrl(track.snippet_path!);
                          const currentTrackId = (window as any)._bangerAudioTrackId || null;

                          if (currentTrackId !== track.id) {
                            audio.pause();
                            audio.currentTime = 0;
                            audio.src = nextSrc;
                            (window as any)._bangerAudioTrackId = track.id;

                            audio.onplay = () => setPlaying(track.id);
                            audio.onpause = () => setPlaying((current) => (current === track.id ? null : current));
                            audio.onended = () => setPlaying((current) => (current === track.id ? null : current));
                          }

                          if (audio.paused) {
                            audio.play().then(() => {
                              setPlaying(track.id);
                            }).catch(() => {});
                          } else {
                            audio.pause();
                            setPlaying(null);
                          }
                        }}
                        style={smallLinkBtn}
                      >
                        {isPlaying ? "❚❚" : "Preview ▶"}
                      </button>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 15, fontWeight: 700, opacity: 0.92 }}>
                    {kind === "unreleased" ? (() => {
                      const titleKey = (track.title || "").trim().toLowerCase();
                      const isFollowing = followedTitles.has(titleKey);
                      return (
                        <button
                          type="button"
                          disabled={!userId}
                          onClick={async () => {
                            if (!userId) return;
                            const action = isFollowing ? "unfollow" : "follow";
                            const res = await fetch("/api/follow-track", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action,
                                user_id: userId,
                                track_title: track.title || "",
                                track_subtitle: track.artist || null,
                              }),
                            });
                            const json = await res.json().catch(() => null);
                            if (json?.ok) {
                              setFollowedTitles(prev => {
                                const next = new Set(prev);
                                if (action === "follow") next.add(titleKey);
                                else next.delete(titleKey);
                                return next;
                              });
                            }
                          }}
                          style={{
                            padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                            border: isFollowing ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.12)",
                            background: isFollowing ? "rgba(255,255,255,0.10)" : "transparent",
                            color: isFollowing ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.62)",
                            cursor: !userId ? "default" : "pointer",
                          }}
                        >
                          {isFollowing ? "Following ✓" : "+ Follow"}
                        </button>
                      );
                    })() : null}
                  </div>

                  {kind === "released" ? (() => {
                    const q = encodeURIComponent(`${track.artist || ""} ${track.title || ""}`.trim());
                    const spotifyHref  = track.spotify_url  || `https://open.spotify.com/search/${q}`;
                    const beatportHref = track.beatport_url || `https://www.beatport.com/search?q=${q}`;
                    return (
                      <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                        <a href={spotifyHref} target="_blank" rel="noreferrer" style={spotifyBtn}>
                          ▶ Listen on Spotify
                        </a>
                        <a href={beatportHref} target="_blank" rel="noreferrer" style={beatportBtn}>
                          ⬇ Buy on Beatport
                        </a>
                      </div>
                    );
                  })() : null}
                  </div>
                </div>
              </div>
          );
        })}
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "20px 14px 120px" }}>
      <style>{`
        @keyframes banger-marquee {
          0% { transform: translateX(0); }
          10% { transform: translateX(0); }
          90% { transform: translateX(calc(-100% + 220px)); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>CHARTS</div>
        </div>

        {loading ? (
          <div style={cardStyle}>Loading…</div>
        ) : error ? (
          <div style={cardStyle}>{error}</div>
        ) : (
          <section style={cardStyle}>
            <div style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(0,0,0,0.96)", paddingBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => switchChart("unreleased")}
                  style={activeChart === "unreleased" ? activeTabBtn : tabBtn}
                >
                  UNRELEASED
                </button>

                <button
                  type="button"
                  onClick={() => switchChart("released")}
                  style={activeChart === "released" ? activeTabBtn : tabBtn}
                >
                  RELEASED
                </button>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisibleCount(10);
                  }}
                  list="charts-search-list"
                  placeholder="Search a track or artist…"
                  style={searchInputStyle}
                />
                <datalist id="charts-search-list">
                  {suggestions.map((item) => (
                    <option key={`charts-search-${item}`} value={item} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {filteredRows.length === 0 ? (
                <div style={{ opacity: 0.62, fontSize: 13 }}>
                  {activeChart === "unreleased" ? "No unreleased IDs charting yet. Be the first to scan." : "No released tracks charting yet."}
                </div>
              ) : (
                <>
                  {renderTrackList(visibleRows, activeChart)}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {visibleCount < filteredRows.length && visibleCount < 100 ? (
                      <button
                        type="button"
                        onClick={() => setVisibleCount((v) => Math.min(v + 10, 100, filteredRows.length))}
                        style={showMoreBtn}
                      >
                        + Show more
                      </button>
                    ) : null}

                    {visibleCount > 10 ? (
                      <button
                        type="button"
                        onClick={() => setVisibleCount(10)}
                        style={showLessBtn}
                      >
                        − Show less
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </section>
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
  padding: "9px 12px",
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
};

const showLessBtn: React.CSSProperties = {
  padding: "9px 12px",
  background: "rgba(255,255,255,0.03)",
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

const tabBtn: React.CSSProperties = {
  flex: 1,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 12,
  letterSpacing: "0.04em",
};

const activeTabBtn: React.CSSProperties = {
  ...tabBtn,
  background: "#fff",
  color: "#000",
};

const smallLink: React.CSSProperties = {
  color: "rgba(255,255,255,0.92)",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
};

const smallLinkBtn: React.CSSProperties = {
  color: "rgba(255,255,255,0.92)",
  background: "transparent",
  border: "none",
  padding: 0,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};;

const spotifyBtn: React.CSSProperties = {
  display: "block",
  padding: "10px 14px",
  borderRadius: 12,
  background: "rgba(29,185,84,0.12)",
  border: "1px solid rgba(29,185,84,0.35)",
  color: "#1db954",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
  textAlign: "center",
  letterSpacing: "0.04em",
};

const beatportBtn: React.CSSProperties = {
  display: "block",
  padding: "10px 14px",
  borderRadius: 12,
  background: "rgba(0,229,255,0.08)",
  border: "1px solid rgba(0,229,255,0.28)",
  color: "#00E5FF",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
  textAlign: "center",
  letterSpacing: "0.04em",
};
