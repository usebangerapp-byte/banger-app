import { createClient } from "@supabase/supabase-js"
import { loadOverrides, ovFor } from "@/lib/server/overrides"
import { adminClient, userFromRequest } from "@/lib/server/notify"
import { isPro } from "@/lib/server/pro"
import { FREE } from "@/lib/plan"
export const dynamic = "force-dynamic"

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

  const ov = await loadOverrides(supabase)
  const weeklyAll = [...grouped.values()].map(({ people, ...t }) => t)
    .filter((t) => !ovFor(ov, t.track_title)?.hidden)
    .map((t) => { const o = ovFor(ov, t.track_title); return o?.scans != null ? { ...t, scans: o.scans } : t })
    .sort((a, b) => b.scans - a.scans)
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

  // Only tracks that are on BANGER and not out yet: following a released (or unknown) track is pointless.
  const tkey = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\(\s*(original|extended|club|radio|vocal|instrumental|dub|remaster|reprise)(\s+(mix|version|edit|cut))?\s*\)/gi, " ")
    .replace(/\s+/g, " ").trim()
  const { data: catalog } = await supabase.from("bpro_tracks").select("title,artist,is_released,release_status").limit(20000)
  const status = new Map<string, { released: boolean; artist: string }>()
  for (const t of (catalog || []) as any[]) {
    const k = tkey(t.title)
    if (!k) continue
    const released = t.is_released === true || t.release_status === "released"
    const prev = status.get(k)
    status.set(k, { released: (prev?.released ?? false) || released, artist: prev?.artist || t.artist || "" })
  }
  const mostWanted = [...followMap.values()]
    .filter((w) => { const st = status.get(tkey(w.track_title)); return !!st && !st.released && !ovFor(ov, w.track_title)?.hidden })
    .map((w) => ({ ...w, track_subtitle: w.track_subtitle || status.get(tkey(w.track_title))?.artist || "" }))
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 10)

  return Response.json({ hot, trending, mostWanted })
}


// Free accounts: Hot (#1) + Trending #2–#3 in full; the rest and Most wanted come back locked (no titles sent).
export async function GET(req: Request) {
  const res = await compute()
  if (res.status !== 200) return res
  const data: any = await res.json()
  const sb = adminClient()
  const me = await userFromRequest(sb, req).catch(() => null)
  const pro = me ? await isPro(sb, me.id) : false
  if (!pro) {
    data.trending = (data.trending || []).map((t: any, i: number) => (i < FREE.radarRows - 1 ? t : { locked: true }))
    data.mostWanted = (data.mostWanted || []).map(() => ({ locked: true }))
  }
  return Response.json({ ...data, pro }, { headers: { "Cache-Control": "no-store" } })
}
