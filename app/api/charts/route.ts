import { createClient } from "@supabase/supabase-js"

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

export async function GET() {
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

    const key = `${title}|${subtitle}|${resultType}`

    const current = map.get(key) || {
      track_title: row.track_title,
      track_subtitle: row.track_subtitle,
      result_type: resultType,
      scans: 0,
    }

    current.scans += 1
    map.set(key, current)
  }

  const result = Array.from(map.values())
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 200)

  return Response.json(result)
}
