import { createClient } from "@supabase/supabase-js"

type ScanRow = {
  created_at?: string | null
  track_title?: string | null
  track_subtitle?: string | null
  result_type?: string | null
  region?: string | null
}

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

function keyOf(title: string, subtitle: string) {
  return `${title}|${subtitle}`
}

function groupTracks(rows: ScanRow[]) {
  const grouped = new Map<string, RadarTrack>()

  for (const e of rows) {
    const title = String(e.track_title || "").trim()
    const subtitle = String(e.track_subtitle || "").trim()

    if (!title || title.toLowerCase() === "unknown") continue

    const key = keyOf(title, subtitle)
    const current = grouped.get(key) || {
      track_title: title,
      track_subtitle: subtitle,
      scans: 0,
      latest_created_at: e.created_at || null,
    }

    current.scans += 1

    if (
      e.created_at &&
      (!current.latest_created_at || e.created_at > current.latest_created_at)
    ) {
      current.latest_created_at = e.created_at
    }

    grouped.set(key, current)
  }

  return Array.from(grouped.values())
}

async function getRadar() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return {
      rising24h: null as RadarTrack | null,
      weekTop: [] as RadarTrack[],
      weekMore: [] as RadarTrack[],
      latestTop: [] as RadarTrack[],
      latestMore: [] as RadarTrack[],
      mostTop: [] as RadarTrack[],
      mostMore: [] as RadarTrack[],
      trendingRegions: [] as RegionBlock[],
      mostWanted: [] as WantedTrack[],
    }
  }

  const supabase = createClient(url, key)

  const { data } = await supabase
    .from("scan_events")
    .select("created_at,track_title,track_subtitle,result_type,region")
    .in("result_type", ["recognized_unreleased", "recognized_world"])
    .order("created_at", { ascending: false })
    .limit(2000)

  const scans: ScanRow[] = Array.isArray(data) ? data : []

  const { data: followerRows } = await supabase
    .from("track_followers")
    .select("track_title,track_subtitle")
    .limit(2000)

  const now = Date.now()
  const h24 = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const scans24h = scans.filter((e) => String(e.created_at || "") >= h24)
  const scans7d = scans.filter((e) => String(e.created_at || "") >= d7)

  const grouped24h = groupTracks(scans24h)
  const grouped7d = groupTracks(scans7d)
  const groupedAll = groupTracks(scans)

  const rising24h =
    [...grouped24h]
      .filter((t) => t.scans >= 2)
      .sort((a, b) => {
        if (b.scans !== a.scans) return b.scans - a.scans
        return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
      })[0] || null

  const weekSorted = [...grouped7d]
    .filter((t) => t.scans >= 2)
    .sort((a, b) => {
      if (b.scans !== a.scans) return b.scans - a.scans
      return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
    })

  const weekTop = weekSorted.slice(0, 3)
  const weekMore = weekSorted.slice(3, 10)

  const latestSorted = [...groupedAll]
    .filter((t) => t.scans >= 2)
    .sort((a, b) => String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || "")))

  const latestTop = latestSorted.slice(0, 3)
  const latestMore = latestSorted.slice(3, 10)

  const mostSorted = [...groupedAll]
    .filter((t) => t.scans >= 2)
    .sort((a, b) => {
      if (b.scans !== a.scans) return b.scans - a.scans
      return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
    })

  const mostTop = mostSorted.slice(0, 3)
  const mostMore = mostSorted.slice(3, 10)

  const regionTotals = new Map<string, number>()
  for (const e of scans7d) {
    const region = String(e.region || "").trim()
    const title = String(e.track_title || "").trim().toLowerCase()
    if (!region || !title || title === "unknown") continue
    regionTotals.set(region, (regionTotals.get(region) || 0) + 1)
  }

  const topRegions = Array.from(regionTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([region]) => region)

  const trendingRegions: RegionBlock[] = topRegions
    .map((region) => {
      const rows = scans7d.filter((e) => String(e.region || "").trim() === region)
      const tracks = groupTracks(rows)
        .filter((t) => t.scans >= 2)
        .sort((a, b) => {
          if (b.scans !== a.scans) return b.scans - a.scans
          return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
        })
        .slice(0, 3)

      return {
        region,
        total_scans: regionTotals.get(region) || 0,
        tracks,
      }
    })
    .filter((b) => b.tracks.length > 0)

  const wantedMap = new Map<string, WantedTrack>()

  for (const row of Array.isArray(followerRows) ? followerRows : []) {
    const title = String(row?.track_title || "").trim()
    const subtitle = String(row?.track_subtitle || "").trim()
    if (!title || title.toLowerCase() === "unknown") continue

    const key = keyOf(title, subtitle)
    const current = wantedMap.get(key) || {
      track_title: title,
      track_subtitle: subtitle,
      followers: 0,
    }
    current.followers += 1
    wantedMap.set(key, current)
  }

  const mostWanted = Array.from(wantedMap.values())
    .filter((t) => t.followers >= 1)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 5)

  return {
    rising24h,
    weekTop,
    weekMore,
    latestTop,
    latestMore,
    mostTop,
    mostMore,
    trendingRegions,
    mostWanted,
  }
}

function MetaLine({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>{children}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.18em",
        color: "rgba(255,255,255,0.62)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function TrackRow({ t }: { t: RadarTrack }) {
  return (
    <div style={rowStyle}>
      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15 }}>{t.track_title}</div>
      <MetaLine>
        {t.track_subtitle || "Unknown"} · {t.scans} scans
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
      <summary style={summaryStyle}>Show more</summary>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </details>
  )
}

export default async function RadarPage() {
  const {
    rising24h,
    weekTop,
    weekMore,
    latestTop,
    latestMore,
    mostTop,
    mostMore,
    trendingRegions,
    mostWanted,
  } = await getRadar()

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
                {rising24h.scans} scans in the last 24h
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

        <section style={cardStyle}>
          <SectionTitle>FRESHEST IDS</SectionTitle>
          {latestTop.length === 0 ? (
            <MetaLine>Nothing yet. Be the first to scan.</MetaLine>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {latestTop.map((t, i) => <TrackRow key={`latest-top-${i}`} t={t} />)}
              </div>
              <ShowMoreBlock
                items={latestMore}
                renderItem={(t, i) => <TrackRow key={`latest-more-${i}`} t={t} />}
              />
            </>
          )}
        </section>

        <section style={cardStyle}>
          <SectionTitle>TRENDING IN</SectionTitle>
          {trendingRegions.length === 0 ? (
            <MetaLine>No regional signal yet</MetaLine>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {trendingRegions.map((block) => (
                <div key={block.region} style={regionCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{block.region}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.52)" }}>{block.total_scans} scans</div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {block.tracks.map((t, i) => (
                      <TrackRow key={`${block.region}-${i}`} t={t} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <SectionTitle>MOST WANTED</SectionTitle>
          {mostWanted.length === 0 ? (
            <MetaLine>No one's chasing these yet.</MetaLine>
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

const regionCardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.018)",
  borderRadius: 14,
  padding: 12,
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
