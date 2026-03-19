import crypto from "crypto"
import { NextResponse } from "next/server"
import ytdlp from "yt-dlp-exec"
import fs from "fs"
import os from "os"
import path from "path"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request){

  try{

    const { url,title,artist,email } = await req.json()

    if(!url){
      return NextResponse.json({error:"Missing url"},{status:400})
    }

    const tmp = path.join(os.tmpdir(),"banger_import.mp3")

    await ytdlp(url,{
      extractAudio:true,
      audioFormat:"mp3",
      output:tmp
    })

    const buffer = fs.readFileSync(tmp)

    const objectPath = `snippets/${crypto.randomUUID()}.mp3`

    const { error: uploadError } = await supabase.storage
      .from("bpro_uploads")
      .upload(objectPath,buffer,{
        contentType:"audio/mpeg",
        upsert:false
      })

    if(uploadError){
      return NextResponse.json({error:uploadError.message},{status:500})
    }

    const cleanTitle = String(title || "Imported track").trim()
    const cleanArtist = String(artist || "unknown").trim()

    const { data: existingTrack, error: existingError } = await supabase
      .from("bpro_tracks")
      .select("*")
      .eq("title", cleanTitle)
      .eq("artist", cleanArtist)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const payload = {
      title: cleanTitle,
      artist: cleanArtist,
      snippet_path: objectPath,
      uploader_email: email || null,
      status: "ready"
    }

    const query = existingTrack
      ? supabase.from("bpro_tracks").update(payload).eq("id", existingTrack.id)
      : supabase.from("bpro_tracks").insert(payload)

    const { data: savedTrack, error: saveError } = await query
      .select("*")
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      track: savedTrack
    })

  }catch(e){
    return NextResponse.json({error:"Import failed"},{status:500})
  }

}
