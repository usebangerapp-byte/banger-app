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

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req:Request){

const { title } = await req.json()

const clean = cleanTitle(title)

const { data } = await supabase
.from("unreleased_tracks")
.select("*")
.ilike("title","%"+clean+"%")
.limit(1)
.maybeSingle()

return NextResponse.json({
found: !!data,
track:data
})

}
