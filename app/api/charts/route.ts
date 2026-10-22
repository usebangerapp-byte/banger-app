import { createClient } from "@supabase/supabase-js"
import { loadOverrides, ovFor, shownScans } from "@/lib/server/overrides"
import { adminClient, userFromRequest } from "@/lib/server/notify"
import { isPro } from "@/lib/server/pro"
import { FREE } from "@/lib/plan"
import { titleKey } from "@/lib/titleKey"
export const dynamic = "force-dynamic"

type ResultType = "recognized_unreleased" | "recognized_world" | "not_found" | null

type ChartRow = {
  track_title: string | null
  track_subtitle: string | null
  result_type: ResultType
}

type AggregatedRow = {
  track_title: string | null
  track_subtitle: string | null
  result_type: ResultType
  scans: number
}

async function compute(): Promise<Response> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from("scan_events")
    .select("track_title,track_subtitle,result_type")
    .in("result_type", ["recognized_unreleased", "recognized_world"])
    .order("created_at", { ascending: false })
    .limit(5000)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!Array.isArray(data)) {
    return Response.json([])
  }

  const map = new Map<string, AggregatedRow>()

  for (const row of data as ChartRow[]) {
    const title = row.track_title || ""
    const subtitle = row.track_subtitle || ""
    const resultType = row.result_type || null

    if (!title.trim() || title.trim().toLowerCase() === "unknown") continue

    // Deduplicate by title only (case-insensitive) — a track changing status shouldn't appear twice
    const key = title.toLowerCase().trim()

    const current = map.get(key) || {
      track_title: row.track_title,
      track_subtitle: row.track_subtitle,
      result_type: resultType,
      scans: 0,
    }

    current.scans += 1
    // Keep the most recent result_type (first row wins since ordered by created_at desc)
    if (current.scans === 1) current.result_type = resultType
    map.set(key, current)
  }

  // Status: a track uploaded on BANGER follows its own page (released / unreleased, and a release date
  // still in the future = unreleased), not what the recogniser said at scan time.
  const { data: cat } = await supabase.from("bpro_tracks").select("title,is_released,release_status,release_date").limit(20000)
  const today = new Date().toISOString().slice(0, 10)
  const rel = new Map<string, boolean>()
  for (const t of (cat || []) as any[]) {
    const out = t.is_released === true || t.release_status === "released"
    rel.set(titleKey(t.title), out && !(t.release_date && String(t.release_date).slice(0, 10) > today))
  }
  for (const r of map.values()) {
    const k = titleKey(r.track_title || "")
    if (rel.has(k)) r.result_type = rel.get(k) ? "recognized_world" : "recognized_unreleased"
  }

  const ov = await loadOverrides(supabase)
  const result = Array.from(map.values())
    .filter((r) => !ovFor(ov, r.track_title)?.hidden)
    .map((r) => ({ ...r, scans: shownScans(ovFor(ov, r.track_title), r.scans) }))
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 200)

  return Response.json(result)
}


// Shared CDN cache: the chart is recomputed at most once a minute instead of on every visit.
// Free accounts: Top 3 of each chart in full; everything below comes back locked (no titles sent).
export async function GET(req: Request) {
  const res = await compute()
  if (res.status !== 200) return res
  const rows: any[] = await res.json()
  const sb = adminClient()
  const me = await userFromRequest(sb, req).catch(() => null)
  const pro = me ? await isPro(sb, me.id) : false
  let out = rows
  if (!pro) {
    const seen = { rel: new Set<string>(), unrel: new Set<string>() }
    out = rows.map((r) => {
      const k = titleKey(r.track_title)
      const released = r.result_type === "recognized_world"
      const bucket = released ? seen.rel : seen.unrel
      if (bucket.has(k) || bucket.size < FREE.chartRows) { bucket.add(k); return r }
      return { locked: true, result_type: released ? "recognized_world" : "recognized_unreleased", scans: 0 }
    })
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } })
}
