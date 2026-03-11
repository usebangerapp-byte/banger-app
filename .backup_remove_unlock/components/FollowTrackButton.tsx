"use client"

import { useEffect, useMemo, useState } from "react"

type Props = {
  trackTitle: string
  trackSubtitle?: string
}

function getDeviceId() {
  if (typeof window === "undefined") return ""
  const key = "banger_device_id"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
  window.localStorage.setItem(key, id)
  return id
}

export default function FollowTrackButton({ trackTitle, trackSubtitle = "" }: Props) {
  const [deviceId, setDeviceId] = useState("")
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  const subtitle = useMemo(() => trackSubtitle || "", [trackSubtitle])
  const storageKey = useMemo(
    () => "followed:" + trackTitle + "|" + subtitle,
    [trackTitle, subtitle]
  )

  useEffect(() => {
    const id = getDeviceId()
    setDeviceId(id)
    const local = window.localStorage.getItem(storageKey)
    if (local === "1") setFollowing(true)
  }, [storageKey])

  async function toggleFollow() {
    if (!deviceId || busy) return
    setBusy(true)

    const nextAction = following ? "unfollow" : "follow"

    try {
      const res = await fetch("/api/follow-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextAction,
          device_id: deviceId,
          track_title: trackTitle,
          track_subtitle: subtitle || null,
        }),
      })

      const data = await res.json()
      const nextFollowing = !!data?.following
      setFollowing(nextFollowing)

      if (nextFollowing) window.localStorage.setItem(storageKey, "1")
      else window.localStorage.removeItem(storageKey)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggleFollow}
      disabled={busy}
      style={{
        marginTop: 10,
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid rgba(0,234,255,0.18)",
        background: following ? "rgba(0,234,255,0.12)" : "rgba(255,255,255,0.04)",
        color: "#fff",
        fontSize: 12,
        cursor: "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {following ? "Following ID" : "Follow ID"}
    </button>
  )
}
