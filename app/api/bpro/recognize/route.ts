import { NextResponse } from "next/server";
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"


function signRequest(p:{
httpMethod:string
httpUri:string
accessKey:string
accessSecret:string
dataType:string
signatureVersion:string
timestamp:string
}){

const stringToSign =
p.httpMethod + "\n" +
p.httpUri + "\n" +
p.accessKey + "\n" +
p.dataType + "\n" +
p.signatureVersion + "\n" +
p.timestamp

const h = crypto.createHmac("sha1",p.accessSecret)
h.update(stringToSign,"utf8")
return h.digest("base64")
}

function safeJson(text:string){
try{ return JSON.parse(text) }catch{ return null }
}

function cleanTitle(t:string){
return t
.toLowerCase()
.replace(/\.mp3$/i,"")
.replace(/\.wav$/i,"")
.replace(/\.mp4$/i,"")
.trim()
}

export async function POST(req:Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

try{

const host = process.env.ACR_HOST
const accessKey = process.env.ACR_ACCESS_KEY
const accessSecret = process.env.ACR_ACCESS_SECRET

if(!host || !accessKey || !accessSecret){
return Response.json(
{ ok:false,error:"Missing env vars" },
{ status:500 }
)
}

const incoming = await req.formData()
const file = incoming.get("audio")

if(!(file instanceof File)){
return Response.json(
{ ok:false,error:"No audio file received" },
{ status:400 }
)
}

const arrayBuffer = await file.arrayBuffer()
const sampleBytes = arrayBuffer.byteLength

const httpMethod = "POST"
const httpUri = "/v1/identify"
const dataType = "audio"
const signatureVersion = "1"
const timestamp = Math.floor(Date.now()/1000).toString()

const signature = signRequest({
httpMethod,
httpUri,
accessKey,
accessSecret,
dataType,
signatureVersion,
timestamp
})

const outForm = new FormData()
outForm.append("access_key",accessKey)
outForm.append("data_type",dataType)
outForm.append("signature_version",signatureVersion)
outForm.append("signature",signature)
outForm.append("timestamp",timestamp)
outForm.append("sample_bytes",String(sampleBytes))

const blob = new Blob([arrayBuffer],{
type:file.type || "application/octet-stream"
})
outForm.append("sample",blob,"sample.webm")

const acrRes = await fetch(
"https://" + host + httpUri,
{ method:"POST", body:outForm }
)

const text = await acrRes.text()
const acr = safeJson(text)

if(!acr){
return Response.json(
{ ok:false,error:"ACR non-JSON",preview:text.slice(0,200) },
{ status:502 }
)
}

const title =
acr?.metadata?.music?.[0]?.title ||
acr?.metadata?.custom_files?.[0]?.title ||
acr?.metadata?.custom_files?.[0]?.name ||
""

const t = cleanTitle(String(title))

let unreleased = null

if(t){
const { data } = await supabase
.from("bpro_tracks")
.select("*")
.or(
"title.ilike.%" + t + "%," +
"title.ilike.%" + t + ".mp3%," +
"title.ilike.%" + t + ".wav%," +
"title.ilike.%" + t + ".mp4%"
)
.limit(1)
.maybeSingle()

unreleased = data || null
}

return Response.json({
acr,
unreleased
})

}catch(e:any){
return Response.json(
{ ok:false,error:e?.message || "Server error" },
{ status:500 }
)
}
}
