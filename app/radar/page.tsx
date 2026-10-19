"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/PageHeader"

type RadarTrack = {
  track_title: string
  track_subtitle?: string
  scans: number
}

type WantedTrack = {
  track_title: string
  track_subtitle?: string
  followers: number
}

type RadarData = {
  hot: RadarTrack | null
  trending: RadarTrack[]
  mostWanted: WantedTrack[]
}

const empty: RadarData = { hot: null, trending: [], mostWanted: [] }

export default function RadarPage() {
  const [data, setData] = useState<RadarData>(empty)
  const [loading, setLoading] = useState(true)
  const [showMoreTrending, setShowMoreTrending] = useState(false)
  const [showMoreWanted, setShowMoreWanted] = useState(false)

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then((json) => {
        const trending: RadarTrack[] = Array.isArray(json.trending)
          ? json.trending.map((t: any) => ({
              track_title: t.track_title || "Unknown",
              track_subtitle: t.track_subtitle || "",
              scans: t.scans || 0,
            }))
          : []

        const wanted: WantedTrack[] = Array.isArray(json.mostWanted)
          ? json.mostWanted.map((t: any) => ({
              track_title: t.track_title || "Unknown",
              track_subtitle: t.track_subtitle || "",
              followers: t.scans || 0,
            }))
          : []

        setData({
          hot: trending[0] || null,
          trending: trending.slice(1, 10),
          mostWanted: wanted.slice(0, 10),
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <main style={page}>
      <div style={shell}>
        <PageHeader title="RADAR" sub="What the scene is scanning right now" />

        {loading ? (
          <div style={empty_}>LOADING…</div>
        ) : (<>

          {/* 1 — HOT RIGHT NOW */}
          <section style={heroCard}>
            <Label>HOT RIGHT NOW</Label>
            {data.hot ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>
                  {data.hot.track_title}
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.58)", marginTop: 5 }}>
                  {data.hot.track_subtitle || "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 8 }}>
                  {data.hot.scans} scans
                </div>
              </>
            ) : (
              <div style={empty_}>Nothing yet. Be the first to scan.</div>
            )}
          </section>

          {/* 2 — TRENDING THIS WEEK */}
          <section style={card}>
            <Label>TRENDING THIS WEEK</Label>
            {data.trending.length === 0 ? (
              <div style={empty_}>Nothing yet.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                  {(showMoreTrending ? data.trending : data.trending.slice(0, 3)).map((t, i) => (
                    <div key={i} style={row}>
                      <div style={rank}>{i + 2}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{t.track_title}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>
                          {t.track_subtitle || "Unknown"}{t.scans > 0 ? ` · ${t.scans} scans` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {data.trending.length > 3 && (
                  <button onClick={() => setShowMoreTrending(v => !v)} style={showMoreBtn}>
                    {showMoreTrending ? "Show less ↑" : `Show more ↓`}
                  </button>
                )}
              </>
            )}
          </section>

          {/* 3 — MOST WANTED */}
          <section style={card}>
            <Label>MOST WANTED</Label>
            {data.mostWanted.length === 0 ? (
              <div style={empty_}>No one's chasing these yet.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                  {(showMoreWanted ? data.mostWanted : data.mostWanted.slice(0, 3)).map((t, i) => (
                    <div key={i} style={row}>
                      <div style={{ ...rank, color: "rgba(255,255,255,0.4)" }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{t.track_title}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>
                          {t.track_subtitle || "Unknown"} · {t.followers} following
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {data.mostWanted.length > 3 && (
                  <button onClick={() => setShowMoreWanted(v => !v)} style={showMoreBtn}>
                    {showMoreWanted ? "Show less ↑" : `Show more ↓`}
                  </button>
                )}
              </>
            )}
          </section>

        </>)}
      </div>
    </main>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
      {children}
    </div>
  )
}

const page: React.CSSProperties = { minHeight: "100vh", background: "#000", color: "#fff", padding: "0 0 120px" }
const shell: React.CSSProperties = { maxWidth: 680, margin: "0 auto", padding: "16px 16px 0" }
const heroCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
  borderRadius: 20, padding: 18, marginBottom: 12,
}
const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 18, padding: 14, marginBottom: 12,
}
const row: React.CSSProperties = {
  display: "flex", gap: 12, alignItems: "flex-start",
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.015)",
  borderRadius: 14,
}
const rank: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8,
  display: "grid", placeItems: "center",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  fontSize: 12, fontWeight: 900, flexShrink: 0,
}
const empty_: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.42)", padding: "4px 0" }
const showMoreBtn: React.CSSProperties = {
  marginTop: 10, width: "100%", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
  color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700,
  letterSpacing: "0.05em", padding: "8px 0", cursor: "pointer",
}
