import { createClient } from "@supabase/supabase-js"

type RadarTrack = {
  track_title: string
  track_subtitle?: string
  scans?: number
  latest_created_at?: string | null
}

type RegionBlock = {
  region: string
  tracks: RadarTrack[]
}

async function getRadar() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return {
      rising24h: [] as RadarTrack[],
      week: [] as RadarTrack[],
      latestSignals: [] as RadarTrack[],
      mostScanned: [] as RadarTrack[],
      trendingRegions: [] as RegionBlock[],
    }
  }

  const supabase = createClient(url, key)

  const { data: scans } = await supabase
    .from("scan_events")
    .select("created_at,track_title,track_subtitle,result_type,region")
    .eq("result_type", "recognized")
    .order("created_at", { ascending: false })
    .limit(1000)

  const safeScans = Array.isArray(scans)
    ? scans.filter((e: any) => {
        const title = (e?.track_title || "").trim().toLowerCase()
        return title && title !== "unknown"
      })
    : []

  const grouped = new Map<string, RadarTrack>()

  for (const e of safeScans) {
    const title = e.track_title || "Unknown ID"
    const subtitle = e.track_subtitle || ""
    const key = `${title}|${subtitle}`
    const current = grouped.get(key) || {
      track_title: title,
      track_subtitle: subtitle,
      scans: 0,
      latest_created_at: e.created_at || null,
    }
    current.scans = (current.scans || 0) + 1
    if (e.created_at && (!current.latest_created_at || e.created_at > current.latest_created_at)) {
      current.latest_created_at = e.created_at
    }
    grouped.set(key, current)
  }

  const allTracks = Array.from(grouped.values())

  const rising24h = [...allTracks]
    .sort((a, b) => {
      if ((b.scans || 0) !== (a.scans || 0)) return (b.scans || 0) - (a.scans || 0)
      return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
    })
    .slice(0, 6)

  const week = [...allTracks]
    .sort((a, b) => (b.scans || 0) - (a.scans || 0))
    .slice(0, 6)

  const latestSignals = safeScans
    .map((e: any) => ({
      track_title: e.track_title,
      track_subtitle: e.track_subtitle,
      latest_created_at: e.created_at || null,
    }))
    .slice(0, 6)

  const mostScanned = [...allTracks]
    .sort((a, b) => (b.scans || 0) - (a.scans || 0))
    .slice(0, 6)

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const regionTargets = ["Ibiza", "Paris"]

  const regionRows = safeScans.filter((e: any) => {
    const region = String(e?.region || "").trim()
    const createdAt = String(e?.created_at || "")
    return regionTargets.includes(region) && createdAt >= since
  })

  const trendingRegions: RegionBlock[] = regionTargets.map((region) => {
    const map = new Map<string, RadarTrack>()

    for (const e of regionRows.filter((row: any) => row.region === region)) {
      const title = e.track_title || "Unknown ID"
      const subtitle = e.track_subtitle || ""
      const key = `${title}|${subtitle}`
      const current = map.get(key) || {
        track_title: title,
        track_subtitle: subtitle,
        scans: 0,
        latest_created_at: e.created_at || null,
      }
      current.scans = (current.scans || 0) + 1
      if (e.created_at && (!current.latest_created_at || e.created_at > current.latest_created_at)) {
        current.latest_created_at = e.created_at
      }
      map.set(key, current)
    }

    return {
      region,
      tracks: Array.from(map.values())
        .sort((a, b) => {
          if ((b.scans || 0) !== (a.scans || 0)) return (b.scans || 0) - (a.scans || 0)
          return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
        })
        .slice(0, 3),
    }
  })

  return { rising24h, week, latestSignals, mostScanned, trendingRegions }
}

export default async function RadarPage() {
  const { rising24h, week, latestSignals, mostScanned, trendingRegions } = await getRadar()

  const main = rising24h[0] || null

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-xl mb-8">RADAR</h1>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Rising 24h</h2>
        {main ? (
          <>
            <div>{main.track_title}</div>
            <div className="text-gray-500 text-sm">
              {main.track_subtitle || "Unknown"} · {main.scans || 0} scans
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-sm">No signal yet</div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Bangers of the Week</h2>
        {week.map((t, i) => (
          <div key={i} className="mb-3">
            <div>{t.track_title}</div>
            <div className="text-gray-500 text-sm">
              {t.track_subtitle || "Unknown"} · {t.scans || 0} scans
            </div>
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Latest Signals</h2>
        {latestSignals.map((t, i) => (
          <div key={i} className="mb-3">
            <div>{t.track_title}</div>
            <div className="text-gray-500 text-sm">
              {t.track_subtitle || "Unknown"}
            </div>
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Trending In</h2>
        <div className="grid gap-6">
          {trendingRegions.map((block) => (
            <div key={block.region}>
              <div className="mb-2 font-semibold">{block.region}</div>
              {block.tracks.length === 0 ? (
                <div className="text-gray-500 text-sm">No signal yet</div>
              ) : (
                block.tracks.map((t, i) => (
                  <div key={`${block.region}-${i}`} className="mb-3">
                    <div>{t.track_title}</div>
                    <div className="text-gray-500 text-sm">
                      {t.track_subtitle || "Unknown"} · {t.scans || 0} scans
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase text-gray-400 mb-2">Most Scanned</h2>
        {mostScanned.map((t, i) => (
          <div key={i} className="mb-3">
            <div>{t.track_title}</div>
            <div className="text-gray-500 text-sm">
              {t.track_subtitle || "Unknown"} · {t.scans || 0} scans
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
