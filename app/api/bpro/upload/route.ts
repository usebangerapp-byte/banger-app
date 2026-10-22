import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findMusicLinks } from '@/lib/music/findLinks'
import { userFromRequest } from '@/lib/server/notify'
import { isPro } from '@/lib/server/pro'

import { dupKey } from '@/lib/dupKey'
import { existingKeys, saveDupKey } from '@/lib/server/dups'
import { lookupRelease } from '@/lib/server/catalog'
export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type UploadedSnippet = {
  file: File
  objectPath: string
  snippetIndex: number
  isPreview: boolean
}

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // Only signed-in Pro accounts can upload, and always as themselves
  const me = await userFromRequest(supabase, req)
  if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!(await isPro(supabase, me.id))) return NextResponse.json({ error: 'Pro only' }, { status: 403 })
  try {
    const formData = await req.formData()

    const title = String(formData.get('title') || '').trim()
    const artist = String(formData.get('artist') || formData.get('name') || '').trim()
    const uploaderEmail = String(me.email || '').trim()
    const releaseDateRaw = String(formData.get('release_date') || '').trim()
    const allowPreviewRaw = String(formData.get('allow_preview') || 'true').trim()
    const isReleasedRaw = String(formData.get('is_released') || 'false').trim()
    const hasRightsRaw = String(formData.get('has_rights') || 'false').trim()

    const allowPreview = allowPreviewRaw === 'true'
    const isReleased = isReleasedRaw === 'true'
    const hasRights = hasRightsRaw === 'true' || hasRightsRaw === '1'
    const releaseDate = releaseDateRaw || null

    const providedFiles: File[] = []
    for (let i = 0; i < 25; i++) {
      const f = formData.get(`file_${i}`)
      if (f instanceof File) providedFiles.push(f)
      else break
    }
    const fallbackFile = formData.get('file')
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

    // Same song already on BANGER (any account) → don't store or fingerprint it twice.
    {
      const k = dupKey(title, artist)
      if ((await existingKeys(supabase, [k])).has(k)) {
        return NextResponse.json({ ok: false, duplicate: true, error: 'Already on BANGER' }, { status: 409 })
      }
    }

    const { data: existingTrack, error: existingError } = await supabase
      .from('bpro_tracks')
      .select('id, title, artist, snippet_path, allow_preview, is_released, release_date')
      .eq('title', title)
      .eq('artist', artist)
      .eq('uploader_email', uploaderEmail)   // never overwrite someone else's upload
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
      .select('id, title, artist, snippet_path, allow_preview, is_released, release_date')
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

    await saveDupKey(supabase, savedTrack.id, title, artist)

    // Uploaded as "unreleased" but already out (or announced) in public catalogues?
    // → fix the status / date automatically (strict title + artist match).
    let autoReleased = false, catalogDate: string | null = null, catalogLabel: string | null = null
    if (!isReleased) {
      const found = await Promise.race([
        lookupRelease(title, artist).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 9000)),
      ])
      if (found?.releaseDate) {
        catalogDate = found.releaseDate; catalogLabel = found.label
        const out = new Date(found.releaseDate).getTime() <= Date.now()
        await supabase.from('bpro_tracks').update(out
          ? { is_released: true, release_status: 'released', release_source: 'catalog', release_date: found.releaseDate, release_checked_at: new Date().toISOString() }
          : { release_date: found.releaseDate }
        ).eq('id', savedTrack.id)
        autoReleased = out
      }
    }

    return NextResponse.json({
      ok: true,
      auto_released: autoReleased,
      release_date: catalogDate,
      label: catalogLabel,
      track: savedTrack,
      snippets_created: snippetRows.length,
      message: existingTrack ? 'Upload updated' : 'Upload created'
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
