"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = {
  trackId?: string | null;
  trackTitle: string;
  trackSubtitle?: string | null;
};

export default function FollowTrackButton({ trackId, trackTitle, trackSubtitle }: Props) {
  const supabase = createSupabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFollow() {
    if (busy || done) return;
    setBusy(true);

    try {
      const { data } = await supabase!.auth.getUser();
      const email = data.user?.email?.toLowerCase() || null;

      const payloadBase = {
        track_id: trackId || null,
        track_title: trackTitle,
        track_subtitle: trackSubtitle || "",
      };

      let ok = false;

      try {
        const { error } = await supabase!.from("track_followers").insert({
          ...payloadBase,
          user_email: email,
        });
        if (!error) ok = true;
      } catch {}

      if (!ok) {
        try {
          const { error } = await supabase!.from("track_followers").insert(payloadBase);
          if (!error) ok = true;
        } catch {}
      }

      if (ok) setDone(true);
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
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: done ? "#fff" : "rgba(255,255,255,0.05)",
        color: done ? "#000" : "#fff",
        fontWeight: 700,
        cursor: busy || done ? "default" : "pointer",
      }}
    >
      {done ? "Following ID" : busy ? "Saving..." : "Notify me"}
    </button>
  );
}
