"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
type Props = { trackId?: string | null; trackTitle: string; trackSubtitle?: string | null };
export default function FollowTrackButton({ trackTitle, trackSubtitle }: Props) {
  const supabase = createSupabaseBrowser();
  const [userId,    setUserId]    = useState<string | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [following, setFollowing] = useState(false);
  const [ready,     setReady]     = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id || null;
        if (!mounted) return;
        setUserId(uid);
        if (!uid) { setReady(true); return; }
        const res  = await fetch(`/api/follow-track?user_id=${uid}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const followed = Array.isArray(json?.followed) ? json.followed : [];
        const wt = (trackTitle || "").trim(); const ws = (trackSubtitle || "").trim();
        if (mounted) setFollowing(followed.some((r: any) =>
          String(r?.track_title || "").trim() === wt && String(r?.track_subtitle || "").trim() === ws));
      } finally { if (mounted) setReady(true); }
    })();
    return () => { mounted = false; };
  }, [supabase, trackTitle, trackSubtitle]);
  async function toggle() {
    if (busy || !supabase || !userId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/follow-track", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: following ? "unfollow" : "follow",
          user_id: userId, track_title: trackTitle, track_subtitle: trackSubtitle || null }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setFollowing(v => !v);
    } finally { setBusy(false); }
  }
  if (!ready) return null;
  return (
    <button type="button" onClick={toggle} disabled={busy || !userId} style={{
      padding: "8px 14px", borderRadius: 999,
      border: following ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.12)",
      background: following ? "rgba(255,255,255,0.10)" : "transparent",
      color: following ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.62)",
      fontWeight: 700, fontSize: 13, cursor: busy || !userId ? "default" : "pointer",
      transition: "all 0.15s ease", letterSpacing: "0.04em",
    }}>
      {busy ? "…" : following ? "Following ✓" : "+ Follow"}
    </button>
  );
}
