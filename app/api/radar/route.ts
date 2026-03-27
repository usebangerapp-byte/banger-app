import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return Response.json({ error: "Missing Supabase env" }, { status: 500 })
  }

  const supabase = createClient(url, key)

  const { data: scans } = await supabase
    .from("scan_events")
    .select("track_id,created_at,track_title,track_subtitle,result_type")
    .order("created_at", { ascending: false })
    .limit(1000)

  const safeScans = Array.isArray(scans) ? scans.filter(Boolean) : []

  const grouped = new Map<string, {
    track_id: string | null
    track_title: string
    track_subtitle: string
    scans: number
    latest_created_at: string | null
  }>()

  for (const e of safeScans) {
    const title = e.track_title || "Unknown ID"
    const subtitle = e.track_subtitle || ""
    const groupKey = e.track_id ? `track:${e.track_id}` : `fallback:${title}|${subtitle}`

    const current = grouped.get(groupKey) || {
      track_id: e.track_id || null,
      track_title: title,
      track_subtitle: subtitle,
      scans: 0,
      latest_created_at: e.created_at || null,
    }

    current.scans += 1

    if (e.created_at && (!current.latest_created_at || e.created_at > current.latest_created_at)) {
      current.latest_created_at = e.created_at
    }

    if (e.track_title) current.track_title = e.track_title
    if (e.track_subtitle) current.track_subtitle = e.track_subtitle

    grouped.set(groupKey, current)
  }

  const allTracks = Array.from(grouped.values())

  const trending = [...allTracks]
    .sort((a, b) => {
      if (b.scans !== a.scans) return b.scans - a.scans
      return String(b.latest_created_at || "").localeCompare(String(a.latest_created_at || ""))
    })
    .slice(0, 6)

  const mostWanted = [...allTracks]
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 6)

  const mysterious = [...allTracks]
    .filter((t) => !t.track_subtitle || t.track_subtitle.toLowerCase() === "unknown")
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 6)

  let recentlyAdded: Array<{ track_title: string; track_subtitle?: string; created_at?: string | null }> = []

  const { data: recentTracks } = await supabase
    .from("bpro_tracks")
    .select("title,artist,created_at,updated_at,status,snippet_path")
    .eq("status", "ready")
    .not("snippet_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(6)

  if (Array.isArray(recentTracks)) {
    recentlyAdded = recentTracks
      .map((row) => ({
        track_title:
          row.title ||
          (row as any).track_title ||
          (row as any).name ||
          "Unknown ID",
        track_subtitle:
          (row as any).subtitle ||
          (row as any).track_subtitle ||
          row.artist ||
          "",
        created_at:
          row.created_at ||
          (row as any).inserted_at ||
          row.updated_at ||
          null,
      }))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 6)
  }

  return Response.json({
    mysterious,
    trending,
    recentlyAdded,
    mostWanted,
  })
}
