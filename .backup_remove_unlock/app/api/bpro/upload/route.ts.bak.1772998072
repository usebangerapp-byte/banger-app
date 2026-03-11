import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request){

const token = process.env.ACR_CONSOLE_TOKEN
const bucketId = process.env.ACR_BUCKET_ID

if(!token || !bucketId){
return NextResponse.json(
{ error:"Missing ACR env" },
{ status:500 }
)
}

const form = await req.formData()
const file = form.get("file")

if(!(file instanceof File)){
return NextResponse.json(
{ error:"No file received" },
{ status:400 }
)
}

const upload = new FormData()
upload.append("file",file)
upload.append("title",file.name)
upload.append("data_type","audio")

const res = await fetch(
"https://api-v2.acrcloud.com/api/buckets/" +
bucketId +
"/files",
{
method:"POST",
headers:{
Authorization:"Bearer " + token
},
body:upload
}
)

const text = await res.text()

let acr = null
try{ acr = JSON.parse(text) }catch{}

await supabase
.from("unreleased_tracks")
.insert({
title:file.name,
artist:"unknown",
label:"unknown",
bucket_id:bucketId,
acr_id:acr?.data?.id || null
})

return NextResponse.json({
ok:true,
acr
})

}
