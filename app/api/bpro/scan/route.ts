import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function cleanTitle(t:string){
return t
.toLowerCase()
.replace(".mp3","")
.replace(".wav","")
.replace(".mp4","")
.trim()
}


export async function POST(req:Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);


const { title } = await req.json()

const clean = cleanTitle(title)

const { data } = await supabase
.from("bpro_tracks")
.select("*")
.ilike("title","%"+clean+"%")
.limit(1)
.maybeSingle()

return NextResponse.json({
found: !!data,
track:data
})

}
