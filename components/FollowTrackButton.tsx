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

  async function handleFollow() {
    if (busy || done) return;
    setBusy(true);

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
        const msg = String(error.message || "").toLowerCase();
        const code = String((error as any).code || "");
        if (code === "23505" || msg.includes("duplicate key")) {
          setDone(true);
          return;
        }
        return;
      }

      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleFollow}
      disabled={busy || done}
      style={{
        padding: 0,
        borderRadius: 0,
        border: "none",
        background: "transparent",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 700,
        cursor: busy || done ? "default" : "pointer",
        fontSize: 15,
        opacity: done ? 0.7 : 1,
      }}
    >
      {done ? "Following" : busy ? "Saving..." : "Follow this track"}
    </button>
  );
}
