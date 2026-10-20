"use client";

import { authFetch } from "@/lib/authFetch";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { ui, C, glass } from "@/lib/ui";
import Link from "next/link";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";

// Free users only see the top N of the unreleased chart
const FREE_UNRELEASED_LIMIT = 3;

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

function trackKey(title: string): string {
  return normalize(title)
    .replace(/\s*\(\s*(original|extended|club|radio|vocal|instrumental|dub|remaster|reprise)(\s+(mix|version|edit|cut))?\s*\)/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, 60);
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
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<"unreleased" | "released">("unreleased");
  const [visibleCount, setVisibleCount] = useState(10);
  const [search, setSearch] = useState("");
  const [followedTitles, setFollowedTitles] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // null = role still loading (treated as free until known)
  const [isPro, setIsPro] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    getBrowserRole().then((r) => { if (alive) setIsPro(r === "pro"); });
    return () => { alive = false; };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Charger userId + follows indépendamment des charts
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data?.session?.user?.id || null;
      setUserId(uid);
      if (!uid) return;
      authFetch(`/api/follow-track?user_id=${uid}`, { cache: "no-store" })
        .then(r => r.json())
        .then(json => {
          const followed = Array.isArray(json?.followed) ? json.followed : [];
          setFollowedTitles(new Set(followed.map((f: any) => trackKey(String(f.track_title || "")))));
        })
        .catch(() => {});
    });
  }, [supabase]);

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
          const key = trackKey(String(t.title || ""));
          if (key) bproIndex.set(key, t);
        }

        // Convertir chaque scan en TrackRow directement
        // Agréger par titre normalisé pour éviter les doublons unreleased+world
        const mergeMap = new Map<string, TrackRow>();

        for (const s of scanList) {
          if (!s.track_title || String(s.track_title).trim().toLowerCase() === "unknown") continue;

          const title  = String(s.track_title  || "").trim();
          const artist = String(s.track_subtitle || "").trim();
          const key    = trackKey(title);

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

        // (follows are loaded once by the effect above — no second request here)
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

  const unreleasedLocked = activeChart === "unreleased" && isPro !== true;
  const lockedCount = unreleasedLocked ? Math.max(0, unreleasedBase.length - FREE_UNRELEASED_LIMIT) : 0;

  const activeBase = activeChart === "unreleased"
    ? (unreleasedLocked ? unreleasedBase.slice(0, FREE_UNRELEASED_LIMIT) : unreleasedBase)
    : releasedBase;
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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
        {list.map((track, index) => {
          const canPreview =
            kind === "released"
              ? !!track.snippet_path
              : !!track.previewAllowed && !!track.snippet_path;
          const isPlaying = playing === track.id;
          const artistText = String(track.artist || "").trim();
          const titleText = String(track.title || "").trim();
          const lowerArtist = artistText.toLowerCase();
          const lowerTitle = titleText.toLowerCase();
          // Title on its own line (full, wraps — remix included), artist underneath.
          const mainTitle = (artistText && lowerTitle.startsWith(lowerArtist + " - "))
            ? titleText.slice(artistText.length + 3).trim()
            : (titleText || artistText || "Untitled");
          const subLine = titleText ? artistText : "";

          return (
            <div key={track.id} style={rowStyle}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ ...ui.rank, paddingTop: 1 }}>{index + 1}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Full title (wraps, remix visible) + artist */}
                  <div style={titleWrap}>{mainTitle}</div>
                  {subLine && <div style={{ ...ui.rowSub, marginTop: 3 }}>{subLine}</div>}

                  {/* Meta line */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {canPreview && (
                      <button type="button" onClick={() => {
                        let audio = (window as any)._bangerAudio as HTMLAudioElement | undefined;
                        if (!audio) { audio = new Audio(); audio.preload = "none"; (window as any)._bangerAudio = audio; }
                        if (!audio) return;
                        const nextSrc = previewUrl(track.snippet_path!);
                        const currentTrackId = (window as any)._bangerAudioTrackId || null;
                        if (currentTrackId !== track.id) {
                          audio.pause(); audio.currentTime = 0; audio.src = nextSrc;
                          (window as any)._bangerAudioTrackId = track.id;
                          audio.onplay = () => setPlaying(track.id);
                          audio.onpause = () => setPlaying((c) => c === track.id ? null : c);
                          audio.onended = () => setPlaying((c) => c === track.id ? null : c);
                        }
                        if (audio.paused) { audio.play().then(() => setPlaying(track.id)).catch(() => {}); }
                        else { audio.pause(); setPlaying(null); }
                      }} style={previewInlineBtn}>
                        {isPlaying ? "❚❚" : "▶"} {isPlaying ? "Stop" : "Preview"}
                      </button>
                    )}

                    {kind === "released" && (() => {
                      const q = encodeURIComponent(`${track.artist || ""} ${track.title || ""}`.trim());
                      return <>
                        <a href={track.spotify_url || `https://open.spotify.com/search/${q}`} target="_blank" rel="noreferrer" style={ui.pillSmall}>
                          <SpotifyLogo /> Spotify
                        </a>
                        <a href={track.beatport_url || `https://www.beatport.com/search?q=${q}`} target="_blank" rel="noreferrer" style={ui.pillSmall}>
                          <BeatportLogo /> Beatport
                        </a>
                      </>;
                    })()}

                    {kind === "unreleased" && (() => {
                      const titleKey = trackKey(track.title || "");
                      const isFollowing = followedTitles.has(titleKey);
                      return (
                        <button type="button" disabled={!userId}
                          onClick={async () => {
                            if (!userId) { showToast("Sign in to follow tracks"); return; }
                            const action = isFollowing ? "unfollow" : "follow";
                            const res = await authFetch("/api/follow-track", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action, user_id: userId, track_title: track.title || "", track_subtitle: (track.artist || "").trim() || null }),
                            });
                            const json = await res.json().catch(() => null);
                            if (json?.ok) {
                              setFollowedTitles(prev => { const next = new Set(prev); if (action === "follow") next.add(titleKey); else next.delete(titleKey); return next; });
                              if (action === "follow") showToast("Following! You'll be notified when it drops 🔔");
                            }
                          }}
                          style={isFollowing ? { ...ui.pillSmall, color: C.text3 } : { ...ui.pillSmall, color: C.gold, background: "rgba(245,207,104,0.12)", borderColor: "rgba(245,207,104,0.30)" }}>
                          {isFollowing ? "Following ✓" : "+ Follow"}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <main style={ui.page}>
      {toast && <div style={ui.toast}>{toast}</div>}
      <style>{`
        @keyframes banger-marquee {
          0% { transform: translateX(0); }
          10% { transform: translateX(0); }
          90% { transform: translateX(calc(-100% + 220px)); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div style={ui.shell}>
        <PageHeader title="Charts" sub="What the scene is playing right now." code="Top 100" />

        {loading ? (
          <div style={cardStyle}>Loading…</div>
        ) : error ? (
          <div style={cardStyle}>{error}</div>
        ) : (
          <section style={cardStyle}>
            <div style={{ position: "sticky", top: "calc(56px + env(safe-area-inset-top))", zIndex: 5, padding: "8px 0", margin: "0 -4px", paddingLeft: 4, paddingRight: 4, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 18 }}>
              <div style={segment}>
                <button
                  type="button"
                  onClick={() => switchChart("unreleased")}
                  style={activeChart === "unreleased" ? activeTabBtn : tabBtn}
                >
                  Unreleased
                </button>

                <button
                  type="button"
                  onClick={() => switchChart("released")}
                  style={activeChart === "released" ? activeTabBtn : tabBtn}
                >
                  Released
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

            <div style={listCard}>
              {filteredRows.length === 0 ? (
                <div style={ui.empty}>
                  {activeChart === "unreleased" ? "No unreleased IDs charting yet. Be the first to scan." : "No released tracks charting yet."}
                </div>
              ) : (
                <>
                  {renderTrackList(visibleRows, activeChart)}

                  {unreleasedLocked && lockedCount > 0 && (
                    <div style={lockedBox}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {lockedCount} more unreleased ID{lockedCount > 1 ? "s" : ""} waiting
                      </div>
                      <div style={{ fontSize: 13, color: C.text2 }}>
                        The full chart is for Pro members.
                      </div>
                      <Link href="/upgrade" style={unlockBtn}>Go Pro</Link>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 16 }}>
                    {!unreleasedLocked && visibleCount < filteredRows.length && visibleCount < 100 ? (
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

const cardStyle: React.CSSProperties = { display: "grid", gap: 12, minWidth: 0 };

const listCard: React.CSSProperties = { minWidth: 0 };

const titleWrap: React.CSSProperties = {
  fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3,
  whiteSpace: "normal", overflowWrap: "anywhere",
};

const segment: React.CSSProperties = {
  ...glass, display: "grid", gridTemplateColumns: "1fr 1fr", padding: 4, borderRadius: 999, marginBottom: 10,
};

const lockedBox: React.CSSProperties = {
  margin: "10px 0 0", padding: "18px 16px", borderRadius: 18, display: "grid", gap: 6, justifyItems: "center", textAlign: "center",
  background: "linear-gradient(160deg, rgba(245,207,104,0.16), rgba(245,207,104,0.04))", border: "1px solid rgba(245,207,104,0.25)",
};

const unlockBtn: React.CSSProperties = { ...ui.pillSolid, marginTop: 8, padding: "11px 26px", fontSize: 14 };

const rowStyle: React.CSSProperties = { ...glass, borderRadius: 20, padding: "14px 16px", minWidth: 0 };

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

const showMoreBtn: React.CSSProperties = { ...ui.more };

const showLessBtn: React.CSSProperties = { ...ui.more };

const searchInputStyle: React.CSSProperties = { ...ui.input };

const tabBtn: React.CSSProperties = { padding: "9px 0", borderRadius: 999, border: "none", background: "transparent", color: C.text3, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };

const activeTabBtn: React.CSSProperties = { ...tabBtn, background: "rgba(255,255,255,0.16)", color: "#fff", fontWeight: 600, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" };

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
};

const previewInlineBtn: React.CSSProperties = { ...ui.pillSmall };

const inlineLink: React.CSSProperties = {
  color: "rgba(29,185,84,0.9)",
  fontWeight: 700,
  fontSize: 11,
  textDecoration: "none",
};

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
  background: "rgba(245,207,104,0.08)",
  border: "1px solid rgba(245,207,104,0.28)",
  color: "#f5cf68",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
  textAlign: "center",
  letterSpacing: "0.04em",
};


function SpotifyLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function BeatportLogo() {
  // Simplified Beatport mark (stem + round bowl)
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M7 2.5v11.5" />
      <circle cx="12.5" cy="15.5" r="6" />
    </svg>
  );
}
