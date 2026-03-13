type RadarTrack = {
  track_title: string
  track_subtitle?: string
  scans?: number
  latest_created_at?: string | null
}

type RadarPayload = {
  trending?: RadarTrack[]
  mostWanted?: RadarTrack[]
  recentlyAdded?: RadarTrack[]
  mysterious?: RadarTrack[]
}

async function getRadar(): Promise<RadarPayload> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")

  const res = await fetch(`${base}/api/radar`, { cache: "no-store" })

  if (!res.ok) {
    return { trending: [], mostWanted: [], recentlyAdded: [], mysterious: [] }
  }

  return res.json()
}

export default async function RadarPage() {
  const data = await getRadar()

  const rising24h = data.trending || []
  const week = data.mostWanted || []
  const latestSignals = data.recentlyAdded || []

  const main = rising24h[0] || null
  const risingList = rising24h.slice(0, 6)
  const weekList = week.slice(0, 6)
  const latestList = latestSignals.slice(0, 6)

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
        {weekList.map((t, i) => (
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
        {latestList.map((t, i) => (
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
        {weekList.map((t, i) => (
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
