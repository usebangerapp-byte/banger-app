import { createClient } from "@supabase/supabase-js"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : ""
}

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return json({ error: "Missing Supabase env" }, 500)

  const supabase = createClient(url, key)
  const { searchParams } = new URL(req.url)

  const device_id = clean(searchParams.get("device_id"))
  const user_id = clean(searchParams.get("user_id"))
  const email = clean(searchParams.get("email")).toLowerCase()

  let myIds: any[] = []
  let myScans: any[] = []
  let myUploads: any[] = []

  if (device_id) {
    const { data } = await supabase
      .from("track_followers")
      .select("created_at,track_title,track_subtitle")
      .eq("device_id", device_id)
      .order("created_at", { ascending: false })
      .limit(50)

    myIds = Array.isArray(data) ? data : []
  }

  if (user_id) {
    const { data } = await supabase
      .from("scan_events")
      .select("created_at,track_title,track_subtitle,result_type,user_id")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(100)

    myScans = Array.isArray(data) ? data : []
  }

  {
    const { data } = await supabase
      .from("bpro_uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)

    const rows = Array.isArray(data) ? data : []

    myUploads = rows.filter((row: any) => {
      const rowUserId = clean(row?.user_id)
      const rowEmail =
        clean(row?.uploader_email).toLowerCase() ||
        clean(row?.email).toLowerCase() ||
        clean(row?.user_email).toLowerCase()

      if (user_id && rowUserId && rowUserId === user_id) return true
      if (email && rowEmail && rowEmail === email) return true
      return false
    }).map((row: any) => ({
      created_at: row?.created_at || null,
      title: row?.title || row?.track_title || row?.name || "Untitled Upload",
      subtitle: row?.artist || row?.track_subtitle || row?.uploader_email || "",
      status:
        row?.status ||
        row?.state ||
        (row?.fingerprint_id ? "Fingerprint Ready" : "Uploaded"),
    }))
  }

  const stats = {
    ids_followed: myIds.length,
    scans: myScans.length,
    uploads: myUploads.length,
  }

  return json({
    myIds,
    myScans,
    myUploads,
    stats,
  })
}
