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
    }
  }

  const supabase = createClient(url, key)

  const { data } = await supabase
    .from("scan_events")
    .select("created_at,track_title,track_subtitle,result_type,region")
    .eq("result_type", "recognized")
    .order("created_at", { ascending: false })
    .limit(2000)

  const scans: ScanRow[] = Array.isArray(data) ? data : []

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
      .sort((a, b) => {
        if (b.scans !== a.scans) return b.scans - a.scans
        return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
      })[0] || null

  const weekSorted = [...grouped7d].sort((a, b) => {
    if (b.scans !== a.scans) return b.scans - a.scans
    return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
  })

  const weekTop = weekSorted.slice(0, 3)
  const weekMore = weekSorted.slice(3, 10)

  const allCounts = new Map<string, number>()
  for (const t of groupedAll) {
    allCounts.set(keyOf(t.track_title, t.track_subtitle || ""), t.scans)
  }

  const latestSorted = [...groupedAll]
    .filter((t) => (allCounts.get(keyOf(t.track_title, t.track_subtitle || "")) || 0) >= 10)
    .sort((a, b) => String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || "")))

  const latestTop = latestSorted.slice(0, 3)
  const latestMore = latestSorted.slice(3, 10)

  const mostSorted = [...groupedAll].sort((a, b) => {
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

  const trendingRegions: RegionBlock[] = topRegions.map((region) => {
    const rows = scans7d.filter((e) => String(e.region || "").trim() === region)
    const tracks = groupTracks(rows)
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

  return {
    rising24h,
    weekTop,
    weekMore,
    latestTop,
    latestMore,
    mostTop,
    mostMore,
    trendingRegions,
  }
}

function TrackRow({ t }: { t: RadarTrack }) {
  return (
    <div className="mb-3">
      <div>{t.track_title}</div>
      <div className="text-gray-500 text-sm">
        {t.track_subtitle || "Unknown"} · {t.scans} scans
      </div>
    </div>
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
  } = await getRadar()

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-xl mb-8">RADAR</h1>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Rising 24h</h2>
        {rising24h ? (
          <>
            <div>{rising24h.track_title}</div>
            <div className="text-gray-500 text-sm">
              {rising24h.track_subtitle || "Unknown"} · {rising24h.scans} scans
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-sm">No signal yet</div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Bangers of the Week</h2>
        {weekTop.length === 0 ? (
          <div className="text-gray-500 text-sm">No signal yet</div>
        ) : (
          <>
            {weekTop.map((t, i) => <TrackRow key={`week-top-${i}`} t={t} />)}
            {weekMore.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-400">Show more</summary>
                <div className="mt-3">
                  {weekMore.map((t, i) => <TrackRow key={`week-more-${i}`} t={t} />)}
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Latest Signals</h2>
        {latestTop.length === 0 ? (
          <div className="text-gray-500 text-sm">No signal yet</div>
        ) : (
          <>
            {latestTop.map((t, i) => <TrackRow key={`latest-top-${i}`} t={t} />)}
            {latestMore.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-400">Show more</summary>
                <div className="mt-3">
                  {latestMore.map((t, i) => <TrackRow key={`latest-more-${i}`} t={t} />)}
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Trending In</h2>
        {trendingRegions.length === 0 ? (
          <div className="text-gray-500 text-sm">No regional signal yet</div>
        ) : (
          <div className="grid gap-6">
            {trendingRegions.map((block) => (
              <div key={block.region}>
                <div className="mb-2 font-semibold">
                  {block.region} · {block.total_scans} scans
                </div>
                {block.tracks.length === 0 ? (
                  <div className="text-gray-500 text-sm">No signal yet</div>
                ) : (
                  block.tracks.map((t, i) => (
                    <TrackRow key={`${block.region}-${i}`} t={t} />
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase text-gray-400 mb-2">Most Scanned</h2>
        {mostTop.length === 0 ? (
          <div className="text-gray-500 text-sm">No signal yet</div>
        ) : (
          <>
            {mostTop.map((t, i) => <TrackRow key={`most-top-${i}`} t={t} />)}
            {mostMore.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-400">Show more</summary>
                <div className="mt-3">
                  {mostMore.map((t, i) => <TrackRow key={`most-more-${i}`} t={t} />)}
                </div>
              </details>
            )}
          </>
        )}
      </section>
    </main>
  )
}
