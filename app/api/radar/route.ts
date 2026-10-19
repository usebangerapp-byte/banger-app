import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return Response.json({ error: "Missing Supabase env" }, { status: 500 })
  }

  const supabase = createClient(url, key)

  const { data: scans, error: scansError } = await supabase
    .from("scan_events")
    .select(`
      track_id,
      created_at,
      track_title,
      track_subtitle,
      result_type,
      bpro_tracks!scan_events_track_id_fkey (
        id,
        title,
        artist,
        release_status
      )
    `)
    .not("track_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000)

  if (scansError) {
    return Response.json({ error: scansError.message }, { status: 500 })
  }

  const safeScans = Array.isArray(scans) ? scans.filter(Boolean) : []

  // 7-day window for HOT / TRENDING
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  type TrackEntry = {
    track_id: string
    track_title: string
    track_subtitle: string
    scans_all: number
    scans_week: number
    latest_created_at: string | null
    release_status: string
  }

  const grouped = new Map<string, TrackEntry>()

  for (const e of safeScans) {
    if (!e.track_id) continue

    const linked = Array.isArray((e as any).bpro_tracks)
      ? (e as any).bpro_tracks[0]
      : (e as any).bpro_tracks

    const title = linked?.title || e.track_title || "Unknown ID"
    const subtitle = linked?.artist || e.track_subtitle || ""
    const releaseStatus = linked?.release_status || "unknown"

    const current: TrackEntry = grouped.get(e.track_id) || {
      track_id: e.track_id,
      track_title: title,
      track_subtitle: subtitle,
      scans_all: 0,
      scans_week: 0,
      latest_created_at: e.created_at || null,
      release_status: releaseStatus,
    }

    current.scans_all += 1
    if (e.created_at && e.created_at >= sevenDaysAgo) current.scans_week += 1

    if (e.created_at && (!current.latest_created_at || e.created_at > current.latest_created_at)) {
      current.latest_created_at = e.created_at
    }

    current.track_title = title
    current.track_subtitle = subtitle
    current.release_status = releaseStatus

    grouped.set(e.track_id, current)
  }

  const allTracks = Array.from(grouped.values())

  // HOT RIGHT NOW + TRENDING: sorted by scans this week (fallback: all-time)
  const sortByWeek = (arr: TrackEntry[]) =>
    [...arr].sort((a, b) => {
      if (b.scans_week !== a.scans_week) return b.scans_week - a.scans_week
      return b.scans_all - a.scans_all
    })

  const weeklyUnreleased = sortByWeek(
    allTracks.filter((t) => t.release_status !== "released")
  ).map(t => ({ ...t, scans: t.scans_week || t.scans_all }))

  const trending = weeklyUnreleased.slice(0, 10)
  const mostWanted = sortByWeek(allTracks).map(t => ({ ...t, scans: t.scans_all })).slice(0, 10)

  let recentlyAdded: Array<{ track_title: string; track_subtitle?: string; created_at?: string | null }> = []

  const { data: recentTracks } = await supabase
    .from("bpro_tracks")
    .select("title,artist,created_at,updated_at,status,snippet_path,release_status")
    .eq("status", "ready")
    .not("snippet_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(6)

  if (Array.isArray(recentTracks)) {
    recentlyAdded = recentTracks
      .map((row) => ({
        track_title: row.title || "Unknown ID",
        track_subtitle: row.artist || "",
        created_at: row.created_at || row.updated_at || null,
      }))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 6)
  }

  return Response.json({
    trending,
    mostWanted,
    recentlyAdded,
    topReleased,
    topUnreleased,
    totals: {
      released: topReleased.length,
      unreleased: topUnreleased.length,
    },
  })
}
