import { createClient } from '@supabase/supabase-js'

export type BangerChartTrack = {
  id: string
  title: string
  artist: string
  snippet_path: string
  release_date: string | null
  allow_preview: boolean
  preview_url: string | null
}

export async function getTopTracks(): Promise<BangerChartTrack[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('bpro_tracks')
    .select('id, title, artist, snippet_path, release_date, allow_preview')
    .eq('allow_preview', true)
    .not('snippet_path', 'is', null)
    .order('release_date', { ascending: false, nullsFirst: false })
    .limit(10)

  if (error) {
    throw error
  }

  const rows = data ?? []

  return rows.map((track) => {
    const { data: publicUrlData } = supabase.storage
      .from('bpro_uploads')
      .getPublicUrl(track.snippet_path)

    return {
      ...track,
      preview_url: publicUrlData.publicUrl,
    }
  })
}
