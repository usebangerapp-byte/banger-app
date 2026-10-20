"use client"

import { authFetch } from "@/lib/authFetch";
import { useEffect, useState, useCallback } from "react"
import { createSupabaseBrowser } from "@/lib/supabase/client"
import PageHeader from "@/components/PageHeader"
import { ui, C, MONO } from "@/lib/ui"

type RadarTrack = { track_title: string; track_subtitle?: string; scans: number }
type WantedTrack = { track_title: string; track_subtitle?: string; followers: number }
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
    fetch("/api/radar")
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
        <PageHeader title="Radar" sub="What the scene is scanning right now." code="THIS WEEK" />

        {loading ? (
          <div style={ui.empty}>Loading…</div>
        ) : (<>

          {/* 1 — HOT RIGHT NOW */}
          <section style={ui.section}>
            <div style={ui.label}>Hot right now</div>
            {data.hot ? (
              <div style={{ padding: "22px 0 4px", display: "grid", gap: 8 }}>
                <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  {data.hot.track_title}
                </div>
                <div style={{ fontSize: 13, color: C.text2 }}>{data.hot.track_subtitle || "Unknown"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.22em", color: C.text3 }}>
                    {data.hot.scans} SCANS THIS WEEK
                  </span>
                  <FollowBtn title={data.hot.track_title} subtitle={data.hot.track_subtitle || ""}
                    followed={followed} loading={followLoading} onToggle={toggleFollow} />
                </div>
              </div>
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
              {(showMoreTrending ? data.trending : data.trending.slice(0, 3)).map((t, i) => (
                <TrackRow key={i} rank={i + 2} title={t.track_title} subtitle={t.track_subtitle || ""}
                  meta={`${t.scans} scans`} followed={followed} loading={followLoading} onToggle={toggleFollow} />
              ))}
              {data.trending.length > 3 && (
                <button onClick={() => setShowMoreTrending(v => !v)} style={ui.more}>
                  {showMoreTrending ? "SHOW LESS" : `+${data.trending.length - 3} MORE`}
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
              {(showMoreWanted ? data.mostWanted : data.mostWanted.slice(0, 3)).map((t, i) => (
                <TrackRow key={i} rank={i + 1} title={t.track_title} subtitle={t.track_subtitle || ""}
                  meta={`${t.followers} following`} followed={followed} loading={followLoading} onToggle={toggleFollow} />
              ))}
              {data.mostWanted.length > 3 && (
                <button onClick={() => setShowMoreWanted(v => !v)} style={ui.more}>
                  {showMoreWanted ? "SHOW LESS" : `+${data.mostWanted.length - 3} MORE`}
                </button>
              )}
            </>)}
          </section>

        </>)}
      </div>
    </main>
  )
}

function TrackRow({ rank, title, subtitle, meta, followed, loading, onToggle }: {
  rank: number; title: string; subtitle: string; meta: string
  followed: Set<string>; loading: Set<string>; onToggle: (t: string, s: string) => void
}) {
  return (
    <div style={ui.row}>
      <span style={ui.rank}>{String(rank).padStart(2, "0")}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={ui.rowTitle}>{title}</div>
        <div style={ui.rowSub}>{subtitle}{subtitle ? " · " : ""}{meta}</div>
      </div>
      <FollowBtn title={title} subtitle={subtitle} followed={followed} loading={loading} onToggle={onToggle} />
    </div>
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
      style={isFollowing ? { ...ui.pillSmall, color: C.text3 } : { ...ui.pillSmall, color: C.fg, borderColor: "rgba(255,255,255,0.3)" }}>
      {isBusy ? "…" : isFollowing ? "Following ✓" : "+ Follow"}
    </button>
  )
}
