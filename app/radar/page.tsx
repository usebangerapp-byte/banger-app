"use client"

import { useEffect, useState, useCallback } from "react"
import { createSupabaseBrowser } from "@/lib/supabase/client"
import PageHeader from "@/components/PageHeader"

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
    sb.auth.getUser().then(({ data: d }) => {
      const uid = d.user?.id || null
      setUserId(uid)
      if (uid) {
        fetch(`/api/follow-track?user_id=${uid}`)
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
      const res = await fetch("/api/follow-track", {
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
    <main style={page}>
      {/* Toast */}
      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}

      <div style={shell}>
        <PageHeader title="RADAR" sub="What the scene is scanning right now" />

        {loading ? (
          <div style={emptyStyle}>LOADING…</div>
        ) : (<>

          {/* 1 — HOT RIGHT NOW */}
          <section style={heroCard}>
            <Label>HOT RIGHT NOW · THIS WEEK</Label>
            {data.hot ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>
                  {data.hot.track_title}
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.58)", marginTop: 5 }}>
                  {data.hot.track_subtitle || "Unknown"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
                    {data.hot.scans} scans this week
                  </div>
                  <FollowBtn
                    title={data.hot.track_title}
                    subtitle={data.hot.track_subtitle || ""}
                    followed={followed}
                    loading={followLoading}
                    onToggle={toggleFollow}
                  />
                </div>
                {!followed.has(data.hot.track_title.toLowerCase().trim()) && (
                  <div style={nudge}>
                    🔔 Follow to get notified when this drops
                  </div>
                )}
              </>
            ) : (
              <div style={emptyStyle}>Nothing scanned this week yet. Be first.</div>
            )}
          </section>

          {/* 2 — TRENDING THIS WEEK */}
          <section style={card}>
            <Label>TRENDING THIS WEEK</Label>
            {data.trending.length === 0 ? (
              <div style={emptyStyle}>Nothing yet.</div>
            ) : (<>
              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                {(showMoreTrending ? data.trending : data.trending.slice(0, 3)).map((t, i) => (
                  <TrackRow key={i} rank={i + 2} title={t.track_title} subtitle={t.track_subtitle || ""}
                    meta={`${t.scans} scans`} followed={followed} loading={followLoading} onToggle={toggleFollow} />
                ))}
              </div>
              {data.trending.length > 3 && (
                <button onClick={() => setShowMoreTrending(v => !v)} style={showMoreBtn}>
                  {showMoreTrending ? "Show less ↑" : "Show more ↓"}
                </button>
              )}
            </>)}
          </section>

          {/* 3 — MOST WANTED */}
          <section style={card}>
            <Label>MOST WANTED</Label>
            {data.mostWanted.length === 0 ? (
              <div style={emptyStyle}>No followers yet — be the first to follow a track.</div>
            ) : (<>
              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                {(showMoreWanted ? data.mostWanted : data.mostWanted.slice(0, 3)).map((t, i) => (
                  <TrackRow key={i} rank={i + 1} title={t.track_title} subtitle={t.track_subtitle || ""}
                    meta={`${t.followers} following`} followed={followed} loading={followLoading} onToggle={toggleFollow} />
                ))}
              </div>
              {data.mostWanted.length > 3 && (
                <button onClick={() => setShowMoreWanted(v => !v)} style={showMoreBtn}>
                  {showMoreWanted ? "Show less ↑" : "Show more ↓"}
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
    <div style={row}>
      <div style={rankStyle}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, minWidth: 0, overflow: "hidden" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flexShrink: 1 }}>{subtitle}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", flexShrink: 0 }}>· {meta}</span>
          <FollowBtn title={title} subtitle={subtitle} followed={followed} loading={loading} onToggle={onToggle} />
        </div>
      </div>
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
      style={{
        flexShrink: 0, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        cursor: isBusy ? "default" : "pointer",
        background: isFollowing ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.10)",
        color: isFollowing ? "rgba(255,255,255,0.45)" : "#fff",
        border: isFollowing ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.30)",
        transition: "all 0.2s",
      }}>
      {isBusy ? "…" : isFollowing ? "✓" : "🔔 Follow"}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
      {children}
    </div>
  )
}

const page: React.CSSProperties = { minHeight: "100vh", background: "#000", color: "#fff", padding: "0 0 120px", overflowX: "hidden" }
const shell: React.CSSProperties = { maxWidth: 680, margin: "0 auto", padding: "16px 16px 0", overflowX: "hidden" }
const heroCard: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.10)", background: "linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))", borderRadius: 20, padding: 18, marginBottom: 12 }
const card: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", borderRadius: 18, padding: 14, marginBottom: 12 }
const row: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)", borderRadius: 14, minWidth: 0, overflow: "hidden" }
const rankStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900, flexShrink: 0 }
const emptyStyle: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.42)", padding: "4px 0" }
const nudge: React.CSSProperties = { marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 12px" }
const showMoreBtn: React.CSSProperties = { marginTop: 10, width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", padding: "8px 0", cursor: "pointer" }
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#fff", zIndex: 999, whiteSpace: "nowrap", backdropFilter: "blur(12px)" }
