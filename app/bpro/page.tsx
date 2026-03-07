"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type RecentItem = {
  id: string
  title: string
  artist: string | null
  label: string | null
  acr_id: string | null
  bucket_id: string | null
  created_at: string
}

export default function BproPage() {
  const [role, setRole] = useState("DJ")
  const [note, setNote] = useState("")
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState("")
  const [recent, setRecent] = useState<RecentItem[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/bpro/recent", { cache: "no-store" })
      const json = await res.json()
      if (json?.ok && Array.isArray(json.data)) {
        setRecent(json.data)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  async function uploadFile(file: File) {
    setUploading(true)
    setStatus("Upload en cours...")

    try {
      const form = new FormData()
      form.append("file", file)
      form.append("role", role)
      form.append("note", note)

      const res = await fetch("/api/bpro/upload", {
        method: "POST",
        body: form,
      })

      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Upload failed")
      }

      setStatus("Upload ACR réussi")
      setNote("")
      await loadRecent()
    } catch (e: any) {
      setStatus(e?.message || "Erreur upload")
    } finally {
      setUploading(false)
    }
  }

  function onPickClick() {
    inputRef.current?.click()
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ""
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
            Banger
          </div>
          <h1 className="text-3xl font-semibold">BPRO Upload</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Upload direct vers ACRCloud BANGER_UNRELEASED
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm text-neutral-300">Profil</div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                >
                  <option>DJ</option>
                  <option>Producer</option>
                  <option>Artist</option>
                  <option>Label</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-2 text-sm text-neutral-300">Note</div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                />
              </label>
            </div>

            <div
              onClick={onPickClick}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={[
                "flex min-h-[260px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition",
                dragging
                  ? "border-white bg-white/10"
                  : "border-white/20 bg-black/20 hover:bg-white/5",
              ].join(" ")}
            >
              <div>
                <div className="mb-3 text-lg font-medium">
                  Glisse ton fichier ici
                </div>
                <div className="mb-5 text-sm text-neutral-400">
                  ou clique pour choisir un mp3 / wav
                </div>
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
                  Choisir un fichier
                </div>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
              onChange={onInputChange}
              className="hidden"
            />

            <div className="mt-4 min-h-[24px] text-sm text-neutral-300">
              {uploading ? "Traitement..." : status}
            </div>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">Historique récent</h2>
              <button
                onClick={loadRecent}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-3">
              {recent.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
                  Aucun upload récent
                </div>
              ) : (
                recent.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-neutral-400">
                      artist: {item.artist || "unknown"} • label: {item.label || "unknown"}
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">
                      acr_id: {item.acr_id || "null"} • bucket: {item.bucket_id || "null"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
