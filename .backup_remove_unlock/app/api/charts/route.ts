import { createClient } from "@supabase/supabase-js"

export async function GET(){

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const { data } = await supabase
.from("scan_events")
.select("track_title,track_subtitle")
.order("created_at",{ascending:false})

if(!data) return Response.json([])

const map:any = {}

data.forEach((e:any)=>{

const key = e.track_title + "|" + (e.track_subtitle||"")

if(!map[key]){
map[key] = {
track_title:e.track_title,
track_subtitle:e.track_subtitle,
scans:0
}
}

map[key].scans++

})

const result = Object.values(map)
.sort((a:any,b:any)=>b.scans-a.scans)
.slice(0,20)

return Response.json(result)

}
