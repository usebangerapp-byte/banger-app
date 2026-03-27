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

  const grouped = new Map<string, {
    track_id: string
    track_title: string
    track_subtitle: string
    scans: number
    latest_created_at: string | null
    release_status: string
  }>()

  for (const e of safeScans) {
    if (!e.track_id) continue

    const linked = Array.isArray((e as any).bpro_tracks)
      ? (e as any).bpro_tracks[0]
      : (e as any).bpro_tracks

    const title =
      linked?.title ||
      e.track_title ||
      "Unknown ID"

    const subtitle =
      linked?.artist ||
      e.track_subtitle ||
      ""

    const releaseStatus =
      linked?.release_status ||
      "unknown"

    const current = grouped.get(e.track_id) || {
      track_id: e.track_id,
      track_title: title,
      track_subtitle: subtitle,
      scans: 0,
      latest_created_at: e.created_at || null,
      release_status: releaseStatus,
    }

    current.scans += 1

    if (e.created_at && (!current.latest_created_at || e.created_at > current.latest_created_at)) {
      current.latest_created_at = e.created_at
    }

    current.track_title = title
    current.track_subtitle = subtitle
    current.release_status = releaseStatus

    grouped.set(e.track_id, current)
  }

  const allTracks = Array.from(grouped.values())

  const sortTracks = (arr: typeof allTracks) =>
    [...arr].sort((a, b) => {
      if (b.scans !== a.scans) return b.scans - a.scans
      return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
    })

  const topReleased = sortTracks(
    allTracks.filter((t) => t.release_status === "released")
  ).slice(0, 100)

  const topUnreleased = sortTracks(
    allTracks.filter((t) => t.release_status !== "released")
  ).slice(0, 100)

  const trending = topUnreleased.slice(0, 6)
  const mostWanted = topUnreleased.slice(0, 6)

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
