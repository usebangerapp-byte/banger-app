"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"

type ProfileData = {
  myIds: Array<{
    created_at?: string | null
    track_title: string
    track_subtitle?: string | null
  }>
  myScans: Array<{
    created_at?: string | null
    track_title: string
    track_subtitle?: string | null
    result_type?: string | null
  }>
  myUploads: Array<{
    created_at?: string | null
    title: string
    subtitle?: string | null
    status?: string | null
  }>
  stats: {
    ids_followed: number
    scans: number
    uploads: number
  }
}

const emptyData: ProfileData = {
  myIds: [],
  myScans: [],
  myUploads: [],
  stats: {
    ids_followed: 0,
    scans: 0,
    uploads: 0,
  },
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

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: 20,
        borderRadius: 20,
        background: "linear-gradient(160deg,#0a0a0d,#0b1015)",
        border: "1px solid rgba(0,234,255,0.10)",
        boxShadow: "0 0 30px rgba(0,234,255,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: "0.14em",
          opacity: 0.6,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {props.title}
      </div>
      {props.children}
    </section>
  )
}

function Card(props: {
  title: string
  subtitle?: string | null
  meta?: string | null
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>{props.title}</div>
      {!!props.subtitle && (
        <div style={{ opacity: 0.55, fontSize: 12, marginTop: 4 }}>{props.subtitle}</div>
      )}
      {!!props.meta && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#00eaff" }}>{props.meta}</div>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData>(emptyData)
  const [email, setEmail] = useState("")
  const [userId, setUserId] = useState("")
  const [ready, setReady] = useState(false)

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return null
    return createClient(url, anon)
  }, [])

  useEffect(() => {
    let mounted = true

    async function boot() {
      const deviceId = getDeviceId()

      if (supabase) {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (mounted) {
          setEmail(user?.email || "")
          setUserId(user?.id || "")
        }

        const qs = new URLSearchParams()
        if (deviceId) qs.set("device_id", deviceId)
        if (user?.id) qs.set("user_id", user.id)
        if (user?.email) qs.set("email", user.email)

        const res = await fetch("/api/profile-data?" + qs.toString())
        const json = await res.json()
        if (mounted) {
          setData({ ...emptyData, ...json })
          setReady(true)
        }
        return
      }

      const qs = new URLSearchParams()
      if (deviceId) qs.set("device_id", deviceId)

      const res = await fetch("/api/profile-data?" + qs.toString())
      const json = await res.json()
      if (mounted) {
        setData({ ...emptyData, ...json })
        setReady(true)
      }
    }

    boot().catch(() => {
      if (mounted) setReady(true)
    })

    return () => {
      mounted = false
    }
  }, [supabase])

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050507",
        color: "#fff",
        padding: "40px 22px 140px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 30 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              opacity: 0.55,
              textTransform: "uppercase",
            }}
          >
            Profile
          </div>

          <h1
            style={{
              fontSize: 38,
              margin: "10px 0",
              fontWeight: 800,
            }}
          >
            Your Music Dashboard
          </h1>

          <div style={{ opacity: 0.65 }}>
            Track your IDs, scans, uploads and activity
          </div>

          {(email || userId) && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.55 }}>
              {email || userId}
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "linear-gradient(160deg,#0a0a0d,#0b1015)",
              border: "1px solid rgba(0,234,255,0.10)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase" }}>IDs</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{data.stats.ids_followed}</div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "linear-gradient(160deg,#0a0a0d,#0b1015)",
              border: "1px solid rgba(0,234,255,0.10)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase" }}>Scans</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{data.stats.scans}</div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "linear-gradient(160deg,#0a0a0d,#0b1015)",
              border: "1px solid rgba(0,234,255,0.10)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase" }}>Uploads</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{data.stats.uploads}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 22 }}>
          <Section title="My IDs">
            <div style={{ display: "grid", gap: 10 }}>
              {data.myIds.length === 0 ? (
                <Card
                  title={ready ? "No IDs followed yet" : "Loading..."}
                  subtitle="Follow an ID from Charts or Radar to track it here"
                />
              ) : (
                data.myIds.map((item, i) => (
                  <Card
                    key={item.track_title + "|" + (item.track_subtitle || "") + "|" + i}
                    title={item.track_title || "Unknown ID"}
                    subtitle={item.track_subtitle || "Following"}
                    meta="Following ID"
                  />
                ))
              )}
            </div>
          </Section>

          <Section title="My Scans">
            <div style={{ display: "grid", gap: 10 }}>
              {data.myScans.length === 0 ? (
                <Card
                  title={ready ? "No scans yet" : "Loading..."}
                  subtitle="Scan music around you to build your personal history"
                />
              ) : (
                data.myScans.map((item, i) => (
                  <Card
                    key={item.track_title + "|" + (item.track_subtitle || "") + "|" + i}
                    title={item.track_title || "Unknown Track"}
                    subtitle={item.track_subtitle || "Unknown ID"}
                    meta={item.result_type || "Recognized"}
                  />
                ))
              )}
            </div>
          </Section>

          <Section title="My Uploads">
            <div style={{ display: "grid", gap: 10 }}>
              {data.myUploads.length === 0 ? (
                <Card
                  title={ready ? "No uploads yet" : "Loading..."}
                  subtitle="Upload from BPRO and your tracks will appear here"
                />
              ) : (
                data.myUploads.map((item, i) => (
                  <Card
                    key={item.title + "|" + (item.subtitle || "") + "|" + i}
                    title={item.title || "Untitled Upload"}
                    subtitle={item.subtitle || ""}
                    meta={item.status || "Uploaded"}
                  />
                ))
              )}
            </div>
          </Section>
        </div>
      </div>
    </main>
  )
}
