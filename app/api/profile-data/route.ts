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

type ProfileFollowRow = {
  created_at: string | null
  track_title: string | null
  track_subtitle: string | null
}

type ProfileScanRow = {
  created_at: string | null
  track_title: string | null
  track_subtitle: string | null
  result_type: string | null
  user_id: string | null
}

type ProfileUploadRow = {
  created_at: string | null
  title: string | null
  artist: string | null
  uploader_email: string | null
}

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return json({ error: "Missing Supabase env" }, 500)

  const supabase = createClient(url, key)
  const { searchParams } = new URL(req.url)

  const user_id = clean(searchParams.get("user_id"))
  const email = clean(searchParams.get("email")).toLowerCase()

  let myIds: ProfileFollowRow[] = []
  let myScans: ProfileScanRow[] = []
  let myUploads: Array<{
    created_at: string | null
    title: string
    subtitle: string
    status: string
  }> = []

  if (user_id) {
    const { data: followData } = await supabase
      .from("track_followers")
      .select("created_at,track_title,track_subtitle")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(50)

    myIds = Array.isArray(followData) ? (followData as ProfileFollowRow[]) : []
  }

  if (user_id) {
    const { data: scanData } = await supabase
      .from("scan_events")
      .select("created_at,track_title,track_subtitle,result_type,user_id")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(100)

    myScans = Array.isArray(scanData) ? (scanData as ProfileScanRow[]) : []
  }

  if (email) {
    const { data: uploadData } = await supabase
      .from("bpro_tracks")
      .select("created_at,title,artist,uploader_email,status")
      .eq("uploader_email", email)
      .order("created_at", { ascending: false })
      .limit(100)

    const rows = Array.isArray(uploadData) ? (uploadData as ProfileUploadRow[]) : []

    myUploads = rows.map((row) => ({
      created_at: row.created_at || null,
      title: row.title || "Untitled Upload",
      subtitle: row.artist || row.uploader_email || "",
      status: "ready",
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
