import { createClient } from "@supabase/supabase-js"

async function compute(): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return Response.json({ error: "Missing env" }, { status: 500 })

  const supabase = createClient(url, key)

  // ── 1. Scans (last 7 days) for HOT + TRENDING ──────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: scans } = await supabase
    .from("scan_events")
    .select(`track_id, created_at, track_title, track_subtitle, result_type, user_id,
      bpro_tracks!scan_events_track_id_fkey(id, title, artist, release_status, is_released)`)
    .not("track_id", "is", null)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(5000)

  type TrackEntry = {
    track_id: string
    track_title: string
    track_subtitle: string
    scans: number
    release_status: string
    people: Set<string>
  }

  const grouped = new Map<string, TrackEntry>()

  for (const e of (scans || [])) {
    if (!e.track_id) continue
    const linked = Array.isArray((e as any).bpro_tracks) ? (e as any).bpro_tracks[0] : (e as any).bpro_tracks
    const title = linked?.title || e.track_title || "Unknown"
    const subtitle = linked?.artist || e.track_subtitle || ""
    // Released if either field says so (uploads set is_released, the release check sets release_status)
    const releaseStatus = linked?.is_released === true || linked?.release_status === "released" ? "released" : "unreleased"
    const cur = grouped.get(e.track_id) || { track_id: e.track_id, track_title: title, track_subtitle: subtitle, scans: 0, release_status: releaseStatus, people: new Set<string>() }
    // One person scanning the same track 10 times counts once: trending = how many different people.
    cur.people.add(e.user_id || `anon-${e.created_at}`)
    cur.scans = cur.people.size
    grouped.set(e.track_id, cur)
  }

  const weeklyAll = [...grouped.values()].map(({ people, ...t }) => t).sort((a, b) => b.scans - a.scans)
  const weeklyUnreleased = weeklyAll.filter(t => t.release_status !== "released")

  const hot = weeklyUnreleased[0] || weeklyAll[0] || null
  const trending = weeklyUnreleased.slice(1, 11) // top 2-11 → positions 2-10 on screen

  // ── 2. Most Wanted: tracks with most followers ──────────────────────────
  const { data: followerRows } = await supabase
    .from("track_followers")
    .select("track_title, track_subtitle")
    .order("created_at", { ascending: false })
    .limit(5000)

  const followMap = new Map<string, { track_title: string; track_subtitle: string; followers: number }>()
  for (const row of (followerRows || [])) {
    const key = (row.track_title || "").toLowerCase().trim()
    if (!key) continue
    const cur = followMap.get(key) || { track_title: row.track_title, track_subtitle: row.track_subtitle || "", followers: 0 }
    cur.followers += 1
    followMap.set(key, cur)
  }

  const mostWanted = [...followMap.values()]
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 10)

  return Response.json({ hot, trending, mostWanted })
}


// Shared CDN cache: the chart is recomputed at most once a minute instead of on every visit.
export async function GET() {
  const res = await compute()
  if (res.status === 200) {
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
  }
  return res
}
