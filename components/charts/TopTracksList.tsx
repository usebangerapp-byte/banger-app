type Track = {
  id: string
  title: string
  artist: string
  preview_url: string | null
}

export function TopTracksList({ tracks }: { tracks: Track[] }) {
  return (
    <div className="space-y-4">
      {tracks.map((track, index) => (
        <div key={track.id} className="rounded-xl border p-4">
          <div className="mb-2">
            <p className="font-semibold">
              #{index + 1} {track.title}
            </p>
            <p className="text-sm opacity-70">{track.artist}</p>
          </div>

          {track.preview_url ? (
            <audio controls preload="none" className="w-full">
              <source src={track.preview_url} type="audio/mpeg" />
            </audio>
          ) : (
            <p className="text-sm opacity-60">Preview indisponible</p>
          )}
        </div>
      ))}
    </div>
  )
}
