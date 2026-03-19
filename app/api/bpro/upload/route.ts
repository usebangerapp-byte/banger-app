import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const file = formData.get('file') as File | null
    const title = String(formData.get('title') || '').trim()
    const artist = String(formData.get('artist') || formData.get('name') || '').trim()
    const uploaderEmail = String(formData.get('uploader_email') || '').trim()
    const releaseDateRaw = String(formData.get('release_date') || '').trim()
    const allowPreviewRaw = String(formData.get('allow_preview') || 'true').trim()
    const isReleasedRaw = String(formData.get('is_released') || 'false').trim()
    const hasRightsRaw = String(formData.get('has_rights') || 'false').trim()

    const allowPreview = allowPreviewRaw === 'true'
    const isReleased = isReleasedRaw === 'true'
    const hasRights = hasRightsRaw === 'true' || hasRightsRaw === '1'
    const releaseDate = releaseDateRaw || null

    if (!hasRights) {
      return NextResponse.json(
        { error: 'You must confirm rights before uploading.' },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    if (!title || !artist || !uploaderEmail) {
      return NextResponse.json(
        { error: 'Missing title, artist or uploader_email' },
        { status: 400 }
      )
    }

    const extension = file.name.split('.').pop() || 'mp3'
    const objectPath = `snippets/${crypto.randomUUID()}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('bpro_uploads')
      .upload(objectPath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('bpro_tracks')
      .insert({
        title,
        artist,
        snippet_path: objectPath,
        release_date: releaseDate,
        allow_preview: allowPreview,
        is_released: isReleased,
        uploader_email: uploaderEmail,
        status: 'ready',
      })
      .select('id, title, artist, snippet_path, allow_preview, is_released, release_date')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      track: inserted,
      message: 'Upload BPro créé'
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
