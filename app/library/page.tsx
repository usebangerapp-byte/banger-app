import { createClient } from '@supabase/supabase-js'

type Track = {
  id: string
  title: string
  artist: string
  snippet_path: string | null
  scan_count: number | null
}

async function getData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Most scanned (top global)
  const { data: mostScanned } = await supabase
    .from('tracks')
    .select('id,title,artist,snippet_path,scan_count')
    .order('scan_count', { ascending: false })
    .limit(10)

  // Banger of the Week (on prend le #1 des plus scannés)
  const bangerOfWeek = (mostScanned || [])[0] || null

  // Rising Bangers (top récents/hauts scans – simple v1)
  const { data: rising } = await supabase
    .from('tracks')
    .select('id,title,artist,snippet_path,scan_count')
    .order('scan_count', { ascending: false })
    .limit(5)

  return {
    bangerOfWeek,
    rising: rising || [],
    mostScanned: mostScanned || [],
  }
}

export default async function LibraryPage() {
  const { bangerOfWeek, rising, mostScanned } = await getData()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const previewUrl = (path: string | null) => {
    if (!path) return null
    const { data } = supabase.storage.from('bpro_uploads').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-10">
      <h1 className="text-2xl font-bold">RADAR</h1>

      {/* Banger of the Week */}
      <section>
        <h2 className="text-xl font-semibold mb-3">🔥 Banger of the Week</h2>
        {bangerOfWeek ? (
          <div className="border rounded-xl p-4">
            <div className="font-semibold">{bangerOfWeek.title}</div>
            <div className="text-sm opacity-70">{bangerOfWeek.artist}</div>
            {previewUrl(bangerOfWeek.snippet_path) && (
              <audio className="mt-2 w-full" controls preload="none">
                <source src={previewUrl(bangerOfWeek.snippet_path)!} type="audio/mpeg" />
              </audio>
            )}
            <div className="text-xs opacity-60 mt-1">
              {bangerOfWeek.scan_count ?? 0} scans
            </div>
          </div>
        ) : (
          <p className="opacity-60 text-sm">No data yet</p>
        )}
      </section>

      {/* Rising Bangers */}
      <section>
        <h2 className="text-xl font-semibold mb-3">⬆ Rising Bangers</h2>
        <div className="space-y-3">
          {rising.map((t) => (
            <div key={t.id} className="border rounded-xl p-4">
              <div className="font-semibold">{t.title}</div>
              <div className="text-sm opacity-70">{t.artist}</div>
              {previewUrl(t.snippet_path) && (
                <audio className="mt-2 w-full" controls preload="none">
                  <source src={previewUrl(t.snippet_path)!} type="audio/mpeg" />
                </audio>
              )}
              <div className="text-xs opacity-60 mt-1">
                {t.scan_count ?? 0} scans
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Most Scanned */}
      <section>
        <h2 className="text-xl font-semibold mb-3">📈 Most Scanned</h2>
        <div className="space-y-3">
          {mostScanned.slice(0,5).map((t) => (
            <div key={t.id} className="border rounded-xl p-4">
              <div className="font-semibold">{t.title}</div>
              <div className="text-sm opacity-70">{t.artist}</div>
              {previewUrl(t.snippet_path) && (
                <audio className="mt-2 w-full" controls preload="none">
                  <source src={previewUrl(t.snippet_path)!} type="audio/mpeg" />
                </audio>
              )}
              <div className="text-xs opacity-60 mt-1">
                {t.scan_count ?? 0} scans
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
