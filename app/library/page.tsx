import { createClient } from "@supabase/supabase-js"

type RadarTrack = {
  track_title: string
  track_subtitle?: string
  scans?: number
  latest_created_at?: string | null
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
    }
  }

  const supabase = createClient(url, key)

  const { data: scans } = await supabase
    .from("scan_events")
    .select("created_at,track_title,track_subtitle,result_type")
    .eq("result_type", "recognized")
    .order("created_at", { ascending: false })
    .limit(500)

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

  return { rising24h, week, latestSignals, mostScanned }
}

export default async function RadarPage() {
  const { rising24h, week, latestSignals, mostScanned } = await getRadar()

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
