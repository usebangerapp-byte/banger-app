import crypto from "crypto"
import { NextResponse } from "next/server"
import ytdlpBase from "yt-dlp-exec"
import path from "path"
import fs from "fs"
import os from "os"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const ytdlp = ytdlpBase.create(path.join(process.cwd(), "node_modules/yt-dlp-exec/bin/yt-dlp"))

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
      noCheckCertificates:true,
      output:tmp
    })

    const buffer = fs.readFileSync(tmp)

    const cleanTitle = String(title || "Imported track").trim()
    const cleanArtist = String(artist || "unknown").trim()


    const acrForm = new FormData();
    acrForm.append('file', new Blob([buffer], { type: 'audio/mpeg' }), 'import.mp3');
    acrForm.append('title', cleanTitle);
    acrForm.append('artist', cleanArtist);
    acrForm.append('data_type', 'audio');

    await fetch(
      `https://api-v2.acrcloud.com/api/buckets/${process.env.ACR_BUCKET_ID}/files`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.ACR_CONSOLE_TOKEN}`,
        },
        body: acrForm,
      }
    );

    const snippetPaths = [
      `snippets/${crypto.randomUUID()}.mp3`,
      `snippets/${crypto.randomUUID()}.mp3`,
      `snippets/${crypto.randomUUID()}.mp3`,
    ]

    for (const objectPath of snippetPaths) {
      const { error: uploadError } = await supabase.storage
        .from("bpro_uploads")
        .upload(objectPath, buffer, {
          contentType: "audio/mpeg",
          upsert: false
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }
    }


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
      snippet_path: snippetPaths[1],
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

    const snippetRows = snippetPaths.map((snippetPath, index) => ({
      track_id: savedTrack.id,
      snippet_path: snippetPath,
      snippet_index: index + 1,
      start_seconds: 0,
      duration_seconds: null,
      is_preview: index === 1,
    }))

    const { error: snippetError } = await supabase
      .from("bpro_track_snippets")
      .insert(snippetRows)

    if (snippetError) {
      return NextResponse.json({ error: snippetError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      track: savedTrack
    })

  }catch(e){
    console.error("bpro import failed", e)

    return NextResponse.json({error:"Import failed"},{status:500})
  }

}
