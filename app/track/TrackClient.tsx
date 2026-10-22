"use client";
import { openPro } from "@/components/ProSheet";
import { fmtTime } from "@/lib/setlists";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { authFetch } from "@/lib/authFetch";
import { ui, C, glass, tag, TAG_TEXT } from "@/lib/ui";
import { PreviewButton, trackKey } from "@/lib/preview";
import PageHeader from "@/components/PageHeader";
import MarqueeText from "@/components/MarqueeText";
import { Bell, showToast } from "@/components/TrackRow";

function SpotifyLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
function BeatportLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M7 2.5v11.5" /><circle cx="12.5" cy="15.5" r="6" />
    </svg>
  );
}

function TrackView() {
  const params = useSearchParams();
  const router = useRouter();
  const title = (params.get("t") || "").trim();
  const artistParam = (params.get("a") || "").trim();
  const [info, setInfo] = useState<{ artist: string; snippet: string | null; released: boolean | null; beatport: string | null; spotify: string | null; releaseDate?: string | null; label?: string | null } | null>(null);
  const [userId, setUserId] = useState("");
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playedIn, setPlayedIn] = useState<{ id: string; title: string; venue: string | null; at: number | null }[]>([]);
  useEffect(() => {
    if (!title) return;
    fetch(`/api/setlists?track=${encodeURIComponent(title)}`).then((r) => r.json()).then((j) => setPlayedIn(j?.sets || [])).catch(() => {});
  }, [title]);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    if (!sb || !title) { setInfo({ artist: artistParam, snippet: null, released: null, beatport: null, spotify: null }); return; }
    (async () => {
      const { data: rows } = await sb.from("bpro_tracks")
        .select("title,artist,snippet_path,allow_preview,is_released,release_status,release_url,release_date").ilike("title", title).limit(5);
      const key = trackKey(title);
      const row: any = (rows || []).find((r: any) => trackKey(r.title || "") === key) || (rows || [])[0];
      setInfo({
        artist: artistParam || row?.artist || "",
        snippet: row && row.allow_preview !== false ? row.snippet_path || null : null,
        released: row ? (!!row.is_released || row.release_status === "released") : null,
        beatport: row?.release_url || null,
        spotify: null,
        releaseDate: row?.release_date || null,
      });
      // Real release date + label from public catalogues (released tracks, or tracks we don't host).
      const artistQ = artistParam || row?.artist || "";
      if (artistQ && (!row || row.is_released)) {
        fetch(`/api/track-info?t=${encodeURIComponent(title)}&a=${encodeURIComponent(artistQ)}`)
          .then((r) => r.json()).then((x) => {
            if (!x?.found) return;
            setInfo((cur) => cur && ({ ...cur, released: true, releaseDate: x.releaseDate || cur.releaseDate, label: x.label || null }));
          }).catch(() => {});
      }
      const { data } = await sb.auth.getSession();
      const uid = data?.session?.user?.id || "";
      setUserId(uid);
      if (uid) {
        const r = await authFetch(`/api/follow-track?user_id=${uid}`).catch(() => null);
        const j = await r?.json().catch(() => null);
        setFollowing((j?.followed || []).some((f: any) => trackKey(f.track_title || "") === key));
      }
    })();
  }, [title, artistParam]);

  async function toggleFollow() {
    if (!userId) { router.push("/"); return; }
    setBusy(true);
    const res = await authFetch("/api/follow-track", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: following ? "unfollow" : "follow", user_id: userId, track_title: title, track_subtitle: info?.artist || null }),
    }).catch(() => null);
    if (res?.status === 402) { setBusy(false); openPro("follow"); return; }
    if (res?.ok) { if (!following) showToast("We'll notify you the day it drops"); setFollowing((v) => !v); }
    setBusy(false);
  }

  if (!title) return <div style={ui.empty}>Track not found.</div>;
  const q = encodeURIComponent(`${info?.artist || ""} ${title}`.trim());

  return (
    <section style={{ ...glass, borderRadius: 24, padding: "22px 18px", display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <MarqueeText text={title} style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }} />
        {info?.artist && <div style={{ fontSize: 15, color: C.text2 }}>{info.artist}</div>}
      </div>
      {info && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {info.released !== null && <span style={tag(info.released ? "rel" : "unrel")}>{info.released ? TAG_TEXT.rel : TAG_TEXT.unrel}</span>}
          {info.releaseDate && !Number.isNaN(new Date(info.releaseDate).getTime()) && (
            <span style={{ ...tag("neutral"), display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" />
              </svg>
              {new Date(info.releaseDate).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {info.label && (
            <span style={{ ...tag("neutral"), display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></svg>
              {info.label}
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {info?.snippet && <PreviewButton id={`track-${title}`} snippetPath={info.snippet} />}
        {/* An unreleased ID isn't on Spotify / Beatport yet — no store links until it's out */}
        {info?.released !== false && (<>
        <a href={info?.spotify || `https://open.spotify.com/search/${q}`} target="_blank" rel="noreferrer" style={ui.pillSmall}><SpotifyLogo /> Spotify</a>
        <a href={beatportHref(info?.beatport, info?.artist || "", title)} target="_blank" rel="noreferrer" style={ui.pillSmall}><BeatportLogo /> Beatport</a>
        </>)}
{info?.released === false && (
        <button onClick={toggleFollow} disabled={busy}
          style={following ? { ...ui.pillSmall, color: C.text3 } : { ...ui.pillSmall, color: C.gold, background: "rgba(245,207,104,0.12)", borderColor: "rgba(245,207,104,0.30)" }}>
          <Bell filled={following} />{following ? "Following" : "Follow"}
        </button>
        )}
      </div>
      {playedIn.length > 0 && (
        <div style={{ display: "grid", gap: 8, borderTop: `1px solid ${C.lineSoft}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: C.text3 }}>PLAYED IN</div>
          {playedIn.map((p) => (
            <a key={p.id + String(p.at)} href={`/sets/${p.id}${p.at ? `?t=${p.at}` : ""}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", textDecoration: "none", fontSize: 14 }}>
              <span style={{ color: C.gold }}>▶</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.venue ? `${p.title} · ${p.venue}` : p.title}</span>
              {p.at != null && <span style={{ color: C.text3, fontVariantNumeric: "tabular-nums" }}>{fmtTime(p.at)}</span>}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export default function TrackClient() {
  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader back title="Track" />
        <Suspense fallback={<div style={ui.empty}>Loading…</div>}>
          <TrackView />
        </Suspense>
      </div>
    </main>
  );
}

/** Beatport opens on the TRACKS results (each row has its price / buy button), not the global search. */
function beatportHref(saved: string | null | undefined, artist: string, title: string) {
  if (saved && /beatport\.com\/(track|release)\//.test(saved)) return saved;        // a real track page: use it
  const t = title.replace(/\s*\((original mix|extended mix|original)\)\s*/gi, " ").trim();
  const q = encodeURIComponent(`${artist.split(/,|&| feat\.? | x /i)[0].trim()} ${t}`.trim());
  return `https://www.beatport.com/search/tracks?q=${q}`;
}
