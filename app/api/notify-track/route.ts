import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {

  const { track_title, track_subtitle, device_id } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase.from("track_notifications").insert({
    track_title,
    track_subtitle,
    device_id
  })

  return Response.json({ ok:true })

}
