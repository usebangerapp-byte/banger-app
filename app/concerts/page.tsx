"use client";

import Image from "next/image";
import { useEffect, useState } from "react"
import FollowTrackButton from "@/components/FollowTrackButton"



type RadarItem = {
  track_title: string
  track_subtitle?: string
  scans?: number
  created_at?: string | null
}

type RadarData = {
  mysterious: RadarItem[]
  trending: RadarItem[]
  recentlyAdded: RadarItem[]
  mostWanted: RadarItem[]
}

const emptyData: RadarData = {
  mysterious: [],
  trending: [],
  recentlyAdded: [],
  mostWanted: [],
}

function Section(props: {
  title: string
  icon: string
  items: RadarItem[]
  accent?: string
}) {
  const { title, icon, items, accent = "#00eaff" } = props

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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          <span>{icon}</span>
          <span>{title}</span>
        </div>

        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: accent,
            boxShadow: `0 0 14px ${accent}`,
            opacity: 0.9,
          }}
        />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.length === 0 ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              opacity: 0.55,
              fontSize: 14,
            }}
          >
            No signal yet
          </div>
        ) : (
          items.map((item, i) => (
            <div
              key={item.track_title + "|" + (item.track_subtitle || "") + "|" + i}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {item.track_title || "Unknown ID"}
              </div>
              <div style={{ opacity: 0.55, fontSize: 12, marginTop: 4 }}>
                {item.track_subtitle || "Unknown ID"}
              </div>
              {typeof item.scans === "number" && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#00eaff" }}>
                  {item.scans} scans
                </div>
              )}
              <FollowTrackButton trackTitle={item.track_title} trackSubtitle={item.track_subtitle || ""} />
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default function ConcertsPage() {
  const [data, setData] = useState<RadarData>(emptyData)

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then((d) => setData({ ...emptyData, ...d }))
      .catch(() => setData(emptyData))
  }, [])

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050507",
        color: "#fff",
        padding: "40px 22px 140px",
      }}
    >
        <div style={{ display: "grid", placeItems: "center", marginBottom: 14 }}>
          <Image
            src="/b-logo.png"
            alt="Banger"
            width={72}
            height={72}
            style={{ width: 72, height: 72, objectFit: "contain" }}
            priority
          />
        </div>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              opacity: 0.55,
              textTransform: "uppercase",
            }}
          >
            Radar
          </div>

          <h1
            style={{
              fontSize: 38,
              margin: "10px 0",
              fontWeight: 800,
            }}
          >
            Scene Signals
          </h1>

          <div style={{ opacity: 0.65 }}>
            Discover what the scene is playing right now
          </div>
        </div>

        <div style={{ display: "grid", gap: 22 }}>
          <Section title="Mysterious" icon="👀" items={data.mysterious} accent="#35e8ff" />
          <Section title="Trending" icon="🔥" items={data.trending} accent="#00eaff" />
          <Section title="Recently Added" icon="🆕" items={data.recentlyAdded} accent="#55f3ff" />
          <Section title="Most Wanted" icon="⭐" items={data.mostWanted} accent="#7df7ff" />
        </div>
      </div>
    </main>
  )
}
