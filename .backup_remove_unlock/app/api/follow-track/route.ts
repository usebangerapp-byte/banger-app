import { createClient } from "@supabase/supabase-js"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function normalizeSubtitle(value: unknown) {
  const s = typeof value === "string" ? value.trim() : ""
  return s || null
}

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return json({ error: "Missing Supabase env" }, 500)

  const supabase = createClient(url, key)
  const { searchParams } = new URL(req.url)
  const device_id = (searchParams.get("device_id") || "").trim()

  if (!device_id) return json({ followed: [] })

  const { data, error } = await supabase
    .from("track_followers")
    .select("track_title,track_subtitle")
    .eq("device_id", device_id)

  if (error) return json({ error: error.message }, 500)

  return json({ followed: Array.isArray(data) ? data : [] })
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return json({ error: "Missing Supabase env" }, 500)

  const supabase = createClient(url, key)
  const body = await req.json().catch(() => ({}))

  const action = body?.action === "unfollow" ? "unfollow" : "follow"
  const device_id = typeof body?.device_id === "string" ? body.device_id.trim() : ""
  const track_title = typeof body?.track_title === "string" ? body.track_title.trim() : ""
  const track_subtitle = normalizeSubtitle(body?.track_subtitle)

  if (!device_id || !track_title) {
    return json({ error: "Missing device_id or track_title" }, 400)
  }

  if (action === "unfollow") {
    let query = supabase
      .from("track_followers")
      .delete()
      .eq("device_id", device_id)
      .eq("track_title", track_title)

    if (track_subtitle) query = query.eq("track_subtitle", track_subtitle)
    else query = query.is("track_subtitle", null)

    const { error } = await query
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, following: false })
  }

  const { error } = await supabase
    .from("track_followers")
    .upsert(
      [{ device_id, track_title, track_subtitle }],
      { onConflict: "device_id,track_title,track_subtitle" }
    )

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, following: true })
}
