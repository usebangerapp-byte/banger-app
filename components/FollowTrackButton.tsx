"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = {
  trackId?: string | null;
  trackTitle: string;
  trackSubtitle?: string | null;
};

export default function FollowTrackButton({ trackTitle, trackSubtitle }: Props) {
  const supabase = createSupabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFollow() {
    if (busy || done) return;
    setBusy(true);
    setErrorMsg("");

    try {
      const { data } = await supabase!.auth.getUser();
      const userId = data.user?.id || null;

      const { error } = await supabase!.from("track_followers").insert({
        track_title: trackTitle,
        track_subtitle: trackSubtitle || "",
        user_id: userId,
        device_id: userId,
      });

      if (error) {
        setErrorMsg(error.message || "Follow failed");
        return;
      }

      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        onClick={handleFollow}
        disabled={busy || done}
        style={{
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: done ? "#fff" : "rgba(255,255,255,0.05)",
          color: done ? "#000" : "#fff",
          fontWeight: 700,
          cursor: busy || done ? "default" : "pointer",
        }}
      >
        {done ? "Following ID" : busy ? "Saving..." : "Follow this ID"}
      </button>

      {errorMsg ? (
        <div style={{ color: "#ff6b6b", fontSize: 12, maxWidth: 220 }}>
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}
