"use client";

import { useEffect, useState } from "react";
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) return;

        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;

        if (!mounted || !userId) {
          setReady(true);
          return;
        }

        const qs = new URLSearchParams({ user_id: userId });
        const res = await fetch(`/api/follow-track?${qs.toString()}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);
        const followed = Array.isArray(json?.followed) ? json.followed : [];

        const wantedTitle = (trackTitle || "").trim();
        const wantedSubtitle = (trackSubtitle || "").trim();

        const isFollowing = followed.some((row: { track_title?: string; track_subtitle?: string | null }) => {
          const rowTitle = String(row?.track_title || "").trim();
          const rowSubtitle = String(row?.track_subtitle || "").trim();
          return rowTitle === wantedTitle && rowSubtitle === wantedSubtitle;
        });

        if (!mounted) return;
        setDone(isFollowing);
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase, trackTitle, trackSubtitle]);

  async function handleFollow() {
    if (busy || done || !supabase) return;
    setBusy(true);

    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id || null;

      if (!userId) return;

      const res = await fetch("/api/follow-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "follow",
          user_id: userId,
          track_title: trackTitle,
          track_subtitle: trackSubtitle || null,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) return;

      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleFollow}
      disabled={busy || done || !ready}
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
