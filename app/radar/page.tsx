"use client"

import { authFetch } from "@/lib/authFetch";
import { useEffect, useState, useCallback } from "react"
import { createSupabaseBrowser } from "@/lib/supabase/client"
import PageHeader from "@/components/PageHeader"
import MarqueeText from "@/components/MarqueeText"
import SharedTrackRow from "@/components/TrackRow"
import Link from "next/link"
import { usePreviewIndex, PreviewButton, trackKey, trackHref } from "@/lib/preview"
import { ui, C } from "@/lib/ui"
import { LockedRow, openPro } from "@/components/ProSheet"

type RadarTrack = { track_title: string; track_subtitle?: string; scans: number; locked?: boolean }
type WantedTrack = { track_title: string; track_subtitle?: string; followers: number; locked?: boolean }
type RadarData = { hot: RadarTrack | null; trending: RadarTrack[]; mostWanted: WantedTrack[] }
const empty: RadarData = { hot: null, trending: [], mostWanted: [] }

export default function RadarPage() {
  const [data, setData] = useState<RadarData>(empty)
  const [loading, setLoading] = useState(true)
  const [showMoreTrending, setShowMoreTrending] = useState(false)
  const [showMoreWanted, setShowMoreWanted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const previews = usePreviewIndex()
  const locked = data.trending.some((t) => t.locked) || data.mostWanted.some((t) => t.locked)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    if (!sb) return
    sb.auth.getSession().then(({ data: d }) => {
      const uid = d.session?.user?.id || null
      setUserId(uid)
      if (uid) {
        authFetch(`/api/follow-track?user_id=${uid}`)
          .then(r => r.json())
          .then(j => {
            const set = new Set<string>((j.followed || []).map((f: any) => (f.track_title || "").toLowerCase().trim()))
            setFollowed(set)
          })
      }
    })
  }, [])

  useEffect(() => {
    authFetch("/api/radar", { cache: "no-store" })
      .then(r => r.json())
      .then(json => setData({
        hot: json.hot || null,
        trending: Array.isArray(json.trending) ? json.trending : [],
        mostWanted: Array.isArray(json.mostWanted) ? json.mostWanted : [],
      }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const toggleFollow = useCallback(async (track_title: string, track_subtitle: string) => {
    if (!userId) { showToast("Sign in to follow tracks"); return }
    const key = track_title.toLowerCase().trim()
    const isFollowing = followed.has(key)
    setFollowLoading(prev => new Set(prev).add(key))
    try {
      const res = await authFetch("/api/follow-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, track_title, track_subtitle, action: isFollowing ? "unfollow" : "follow" }),
      })
      if (res.ok) {
        setFollowed(prev => {
          const next = new Set(prev)
          isFollowing ? next.delete(key) : next.add(key)
          return next
        })
        if (!isFollowing) showToast("Following! You'll be notified when it drops 🔔")
      }
    } finally {
      setFollowLoading(prev => { const next = new Set(prev); next.delete(key); return next })
    }
  }, [userId, followed])

  return (
    <main style={ui.page}>
      {toast && <div style={ui.toast}>{toast}</div>}

      <div style={ui.shell}>
        <PageHeader title="Radar" sub="What the scene is scanning right now." />
        <Link href="/charts" style={{ ...ui.section, display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#fff", padding: "14px 18px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>Charts</span>
          <span style={{ fontSize: 13, color: C.text3 }}>Top 100</span>
          <span style={{ color: C.text4 }}>›</span>
        </Link>

        {loading ? (
          <div style={ui.empty}>Loading…</div>
        ) : (<>

          {/* 1 — HOT RIGHT NOW */}
          <section style={ui.section}>
            <div style={ui.label}>Hot right now</div>
            {data.hot ? (
              <SharedTrackRow rank={1} title={data.hot.track_title} artist={data.hot.track_subtitle || ""}
                meta={`${data.hot.scans} scan${data.hot.scans === 1 ? "" : "s"}`} last />
            ) : (
              <div style={ui.empty}>Nothing scanned this week yet. Be first.</div>
            )}
          </section>

          {/* 2 — TRENDING THIS WEEK */}
          <section style={ui.section}>
            <div style={ui.label}>Trending this week</div>
            {data.trending.length === 0 ? (
              <div style={ui.empty}>Nothing yet.</div>
            ) : (<>
              {(locked ? data.trending.slice(0, 5) : showMoreTrending ? data.trending : data.trending.slice(0, 3)).map((t, i, arr) => t.locked
                ? <LockedRow key={i} rank={i + 2} kind="radar" last={i === arr.length - 1} />
                : <SharedTrackRow key={i} rank={i + 2} title={t.track_title} artist={t.track_subtitle || ""}
                  meta={`${t.scans} scan${t.scans === 1 ? "" : "s"}`} last={!(data.trending.length > 3) && i === Math.min(3, data.trending.length) - 1} />
              )}
              {locked && data.trending.length > 5 && (
                <button onClick={() => openPro("radar")} style={{ ...ui.more, color: C.gold }}>{`+${data.trending.length - 5} more with Pro`}</button>
              )}
              {!locked && data.trending.length > 3 && (
                <button onClick={() => setShowMoreTrending(v => !v)} style={ui.more}>
                  {showMoreTrending ? "Show less" : `Show ${data.trending.length - 3} more`}
                </button>
              )}
            </>)}
          </section>

          {/* 3 — MOST WANTED */}
          <section style={ui.section}>
            <div style={ui.label}>Most wanted</div>
            {data.mostWanted.length === 0 ? (
              <div style={ui.empty}>No followers yet — be the first to follow a track.</div>
            ) : (<>
              {locked ? data.mostWanted.slice(0, 3).map((_, i, arr) => <LockedRow key={i} rank={i + 1} kind="radar" last={i === arr.length - 1} />)
              : (showMoreWanted ? data.mostWanted : data.mostWanted.slice(0, 3)).map((t, i) => (
                <SharedTrackRow key={i} rank={i + 1} title={t.track_title} artist={t.track_subtitle || ""}
                  meta={`${t.followers} following`} last={!(data.mostWanted.length > 3) && i === Math.min(3, data.mostWanted.length) - 1}
                  onFollowChange={(on) => setData((d) => ({ ...d, mostWanted: d.mostWanted.map((w) =>
                    w.track_title === t.track_title ? { ...w, followers: Math.max(0, w.followers + (on ? 1 : -1)) } : w) }))} />
              ))}
              {!locked && data.mostWanted.length > 3 && (
                <button onClick={() => setShowMoreWanted(v => !v)} style={ui.more}>
                  {showMoreWanted ? "Show less" : `Show ${data.mostWanted.length - 3} more`}
                </button>
              )}
            </>)}
          </section>

        </>)}
      </div>
    </main>
  )
}

function FollowBtn({ title, subtitle, followed, loading, onToggle }: {
  title: string; subtitle: string
  followed: Set<string>; loading: Set<string>; onToggle: (t: string, s: string) => void
}) {
  const key = title.toLowerCase().trim()
  const isFollowing = followed.has(key)
  const isBusy = loading.has(key)
  return (
    <button onClick={() => onToggle(title, subtitle)} disabled={isBusy}
      style={isFollowing ? { ...ui.pillSmall, color: C.text3 } : { ...ui.pillSmall, color: C.gold, background: "rgba(245,207,104,0.12)", borderColor: "rgba(245,207,104,0.30)" }}>
      {isBusy ? "…" : isFollowing ? "Following ✓" : "+ Follow"}
    </button>
  )
}
