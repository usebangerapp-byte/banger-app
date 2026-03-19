import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findMusicLinks } from '@/lib/music/findLinks'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UploadedSnippet = {
  file: File
  objectPath: string
  snippetIndex: number
  isPreview: boolean
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

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

    const file0 = formData.get('file_0')
    const file1 = formData.get('file_1')
    const file2 = formData.get('file_2')
    const fallbackFile = formData.get('file')

    const providedFiles = [file0, file1, file2].filter(
      (value): value is File => value instanceof File
    )

    const inputFiles =
      providedFiles.length > 0
        ? providedFiles
        : fallbackFile instanceof File
          ? [fallbackFile]
          : []

    if (!hasRights) {
      return NextResponse.json(
        { error: 'You must confirm rights before uploading.' },
        { status: 400 }
      )
    }

    if (inputFiles.length === 0) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    if (!title || !artist || !uploaderEmail) {
      return NextResponse.json(
        { error: 'Missing title, artist or uploader_email' },
        { status: 400 }
      )
    }

    const previewArrayIndex = inputFiles.length >= 2 ? 1 : 0

    const uploadedSnippets: UploadedSnippet[] = []

    for (let i = 0; i < inputFiles.length; i++) {
      const file = inputFiles[i]
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

      uploadedSnippets.push({
        file,
        objectPath,
        snippetIndex: i + 1,
        isPreview: i === previewArrayIndex,
      })
    }

    const previewSnippet =
      uploadedSnippets.find((item) => item.isPreview) || uploadedSnippets[0]

    const { data: existingTrack, error: existingError } = await supabase
      .from('bpro_tracks')
      .select('id, title, artist, snippet_path, allow_preview, is_released, release_date, spotify_url, beatport_url')
      .eq('title', title)
      .eq('artist', artist)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const payload = {
      title,
      artist,
      snippet_path: previewSnippet.objectPath,
      release_date: releaseDate,
      allow_preview: allowPreview,
      is_released: isReleased,
      uploader_email: uploaderEmail,
      status: 'ready',
    }

    const query = existingTrack
      ? supabase.from('bpro_tracks').update(payload).eq('id', existingTrack.id)
      : supabase.from('bpro_tracks').insert(payload)

    const { data: savedTrack, error: saveError } = await query
      .select('id, title, artist, snippet_path, allow_preview, is_released, release_date, spotify_url, beatport_url')
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    const { error: deleteSnippetsError } = await supabase
      .from('bpro_track_snippets')
      .delete()
      .eq('track_id', savedTrack.id)

    if (deleteSnippetsError) {
      return NextResponse.json({ error: deleteSnippetsError.message }, { status: 500 })
    }

    const snippetRows = uploadedSnippets.map((item) => ({
      track_id: savedTrack.id,
      snippet_path: item.objectPath,
      snippet_index: item.snippetIndex,
      start_seconds: 0,
      duration_seconds: null,
      is_preview: item.isPreview,
    }))

    const { error: snippetError } = await supabase
      .from('bpro_track_snippets')
      .insert(snippetRows)

    if (snippetError) {
      return NextResponse.json({ error: snippetError.message }, { status: 500 })
    }

    if (!isReleased && (!savedTrack.spotify_url || !savedTrack.beatport_url)) {
      try {
        const links = await findMusicLinks(artist, title)

        const { error: linksError } = await supabase
          .from('bpro_tracks')
          .update({
            spotify_url: savedTrack.spotify_url || links.spotify_url,
            beatport_url: savedTrack.beatport_url || links.beatport_url,
          })
          .eq('id', savedTrack.id)

        if (linksError) {
          console.error('bpro link update failed', linksError)
        } else {
          savedTrack.spotify_url = savedTrack.spotify_url || links.spotify_url
          savedTrack.beatport_url = savedTrack.beatport_url || links.beatport_url
        }
      } catch (e) {
        console.error('bpro link search failed', e)
      }
    }

    return NextResponse.json({
      ok: true,
      track: savedTrack,
      snippets_created: snippetRows.length,
      message: existingTrack ? 'Upload BPro mis à jour' : 'Upload BPro créé'
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
