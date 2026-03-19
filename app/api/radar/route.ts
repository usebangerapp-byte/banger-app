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
    .select("created_at,track_title,track_subtitle,result_type")
    .order("created_at", { ascending: false })
    .limit(500)

  const safeScans = Array.isArray(scans) ? scans.filter(Boolean) : []

  const grouped = new Map()

  for (const e of safeScans) {
    const title = e.track_title || "Unknown ID"
    const subtitle = e.track_subtitle || ""
    const key = title + "|" + subtitle
    const current = grouped.get(key) || {
      track_title: title,
      track_subtitle: subtitle,
      scans: 0,
      latest_created_at: e.created_at || null,
    }
    current.scans += 1
    if (e.created_at && (!current.latest_created_at || e.created_at > current.latest_created_at)) {
      current.latest_created_at = e.created_at
    }
    grouped.set(key, current)
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

  const { data: unreleased } = await supabase
    .from("bpro_tracks")
    .select("*")
    .limit(50)

  if (Array.isArray(unreleased)) {
    recentlyAdded = unreleased
      .map((row) => ({
        track_title:
          row.title ||
          row.track_title ||
          row.name ||
          "Unknown ID",
        track_subtitle:
          row.subtitle ||
          row.track_subtitle ||
          row.artist ||
          "",
        created_at:
          row.created_at ||
          row.inserted_at ||
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
