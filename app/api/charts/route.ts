import { createClient } from "@supabase/supabase-js"
import { loadOverrides, ovFor } from "@/lib/server/overrides"
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

  const ov = await loadOverrides(supabase)
  const result = Array.from(map.values())
    .filter((r) => !ovFor(ov, r.track_title)?.hidden)
    .map((r) => { const o = ovFor(ov, r.track_title); return o?.scans != null ? { ...r, scans: o.scans } : r })
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 200)

  return Response.json(result)
}


// Shared CDN cache: the chart is recomputed at most once a minute instead of on every visit.
export async function GET() {
  const res = await compute()
  if (res.status === 200) {
    res.headers.set("Cache-Control", "no-store")
  }
  return res
}
