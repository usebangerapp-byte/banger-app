"use client"

import { useEffect, useState } from "react"
import ShowMoreToggle from "@/components/ShowMoreToggle"

type RadarTrack = {
  track_title: string
  track_subtitle?: string
  scans: number
  latest_created_at?: string | null
}

type RegionBlock = {
  region: string
  total_scans: number
  tracks: RadarTrack[]
}

type WantedTrack = {
  track_title: string
  track_subtitle?: string
  followers: number
}

type RadarData = {
  rising24h: RadarTrack | null
  weekTop: RadarTrack[]
  weekMore: RadarTrack[]
  latestTop: RadarTrack[]
  latestMore: RadarTrack[]
  mostTop: RadarTrack[]
  mostMore: RadarTrack[]
  trendingRegions: RegionBlock[]
  mostWanted: WantedTrack[]
}

const empty: RadarData = {
  rising24h: null,
  weekTop: [],
  weekMore: [],
  latestTop: [],
  latestMore: [],
  mostTop: [],
  mostMore: [],
  trendingRegions: [],
  mostWanted: [],
}

export default function RadarPage() {
  const [data, setData] = useState<RadarData>(empty)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then((json) => {
        // /api/radar returns: trending, mostWanted, recentlyAdded, topReleased, topUnreleased
        // Map to the shape this page expects
        const trending: RadarTrack[] = Array.isArray(json.trending) ? json.trending.map((t: any) => ({
          track_title: t.track_title || "Unknown",
          track_subtitle: t.track_subtitle || "",
          scans: t.scans || 0,
          latest_created_at: t.latest_created_at || null,
        })) : []

        const wanted: WantedTrack[] = Array.isArray(json.mostWanted) ? json.mostWanted.map((t: any) => ({
          track_title: t.track_title || "Unknown",
          track_subtitle: t.track_subtitle || "",
          followers: t.scans || 0,
        })) : []

        setData({
          rising24h: trending[0] || null,
          weekTop: trending.slice(0, 3),
          weekMore: trending.slice(3, 10),
          latestTop: Array.isArray(json.recentlyAdded) ? json.recentlyAdded.slice(0, 3).map((t: any) => ({
            track_title: t.track_title || "Unknown",
            track_subtitle: t.track_subtitle || "",
            scans: 0,
            latest_created_at: t.created_at || null,
          })) : [],
          latestMore: [],
          mostTop: trending.slice(0, 3),
          mostMore: trending.slice(3, 10),
          trendingRegions: [],
          mostWanted: wanted,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const {
    rising24h,
    weekTop,
    weekMore,
    latestTop,
    mostTop,
    mostMore,
    mostWanted,
  } = data

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "20px 14px 120px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", placeItems: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 13, opacity: 0.5, letterSpacing: "0.14em" }}>LOADING…</div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "20px 14px 120px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 8, marginBottom: 2 }}>
          <div style={{ fontSize: 52, lineHeight: 1, opacity: 0.92 }}>B</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>RADAR</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", textAlign: "center", maxWidth: 520 }}>
            What the scene is scanning right now. Underground only.
          </div>
        </div>

        <section style={heroStyle}>
          <SectionTitle>HOT RIGHT NOW</SectionTitle>
          {rising24h ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05 }}>{rising24h.track_title}</div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.68)", marginTop: 6 }}>
                {rising24h.track_subtitle || "Unknown"}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.54)", marginTop: 12 }}>
                {rising24h.scans} scans
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}>Nothing yet. Be the first to scan.</div>
          )}
        </section>

        <section style={cardStyle}>
          <SectionTitle>BANGERS OF THE WEEK</SectionTitle>
          {weekTop.length === 0 ? (
            <MetaLine>Nothing yet. Be the first to scan.</MetaLine>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {weekTop.map((t, i) => <TrackRow key={`week-top-${i}`} t={t} />)}
              </div>
              <ShowMoreBlock
                items={weekMore}
                renderItem={(t, i) => <TrackRow key={`week-more-${i}`} t={t} />}
              />
            </>
          )}
        </section>

        {latestTop.length > 0 && (
          <section style={cardStyle}>
            <SectionTitle>FRESHEST IDS</SectionTitle>
            <div style={{ display: "grid", gap: 8 }}>
              {latestTop.map((t, i) => <TrackRow key={`latest-top-${i}`} t={t} />)}
            </div>
          </section>
        )}

        <section style={cardStyle}>
          <SectionTitle>MOST WANTED</SectionTitle>
          {mostWanted.length === 0 ? (
            <MetaLine>No one&apos;s chasing these yet.</MetaLine>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {mostWanted.map((t, i) => <WantedRow key={`wanted-${i}`} t={t} />)}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <SectionTitle>ALL TIME IDS</SectionTitle>
          {mostTop.length === 0 ? (
            <MetaLine>Nothing yet. Be the first to scan.</MetaLine>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {mostTop.map((t, i) => <TrackRow key={`most-top-${i}`} t={t} />)}
              </div>
              <ShowMoreBlock
                items={mostMore}
                renderItem={(t, i) => <TrackRow key={`most-more-${i}`} t={t} />}
              />
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function MetaLine({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>{children}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: "0.18em",
      color: "rgba(255,255,255,0.62)",
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function TrackRow({ t }: { t: RadarTrack }) {
  return (
    <div style={rowStyle}>
      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15 }}>{t.track_title}</div>
      <MetaLine>
        {t.track_subtitle || "Unknown"}{t.scans > 0 ? ` · ${t.scans} scans` : ""}
      </MetaLine>
    </div>
  )
}

function WantedRow({ t }: { t: WantedTrack }) {
  return (
    <div style={rowStyle}>
      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15 }}>{t.track_title}</div>
      <MetaLine>
        {t.track_subtitle || "Unknown"} · {t.followers} following
      </MetaLine>
    </div>
  )
}

function ShowMoreBlock<T>({
  items,
  renderItem,
}: {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
}) {
  if (items.length === 0) return null

  return (
    <details style={{ marginTop: 8 }}>
      <summary style={summaryStyle}>
        <span className="show-more-label">Show more</span>
        <span className="show-less-label">Show less</span>
      </summary>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </details>
  )
}

const heroStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 12px 28px rgba(0,0,0,0.34)",
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
}

const rowStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.018)",
  borderRadius: 14,
  padding: 10,
}

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  color: "rgba(255,255,255,0.62)",
  fontWeight: 700,
  listStyle: "none",
}
