"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { authFetch } from "@/lib/authFetch";
import { ui, C } from "@/lib/ui";
import { PreviewButton, trackKey, trackHref } from "@/lib/preview";
import MarqueeText from "@/components/MarqueeText";

/* ── Shared data, loaded once per session ─────────────────────────── */

type Meta = { snippet: string | null; releaseDate: string | null };
let metaCache: Promise<Map<string, Meta>> | null = null;
function loadMeta() {
  if (!metaCache) {
    metaCache = (async () => {
      const map = new Map<string, Meta>();
      const sb = createSupabaseBrowser();
      if (!sb) return map;
      try {
        const { data } = await sb.from("bpro_tracks").select("title,snippet_path,allow_preview,release_date").limit(1000);
        for (const t of (data || []) as any[]) {
          const k = trackKey(String(t.title || ""));
          if (!k || map.has(k)) continue;
          map.set(k, { snippet: t.allow_preview === false ? null : t.snippet_path || null, releaseDate: t.release_date || null });
        }
      } catch {}
      return map;
    })();
  }
  return metaCache;
}

let followSet: Set<string> | null = null;
let followLoad: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function loadFollows() {
  if (!followLoad) {
    followLoad = (async () => {
      followSet = new Set();
      try {
        const r = await authFetch("/api/follow-track");
        const j = await r.json().catch(() => null);
        for (const f of j?.followed || []) followSet.add(trackKey(f.track_title || ""));
      } catch {}
      emit();
    })();
  }
  return followLoad;
}

function useTrackState(title: string) {
  const key = trackKey(title);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    loadMeta().then((m) => { if (alive) setMeta(m.get(key) || null); });
    const l = () => force((n) => n + 1);
    listeners.add(l);
    loadFollows();
    return () => { alive = false; listeners.delete(l); };
  }, [key]);
  return { meta, following: !!followSet?.has(key), key };
}

function fmtDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/**
 * One track, the same everywhere:
 * [rank] [▶ preview] [title / artist · meta / release date] [Follow over Info]
 */
export default function TrackRow({ title, artist, rank, meta, last, onFollowChange, right }: {
  title: string; artist?: string | null; rank?: number; meta?: string; last?: boolean;
  onFollowChange?: (following: boolean) => void;
  right?: ReactNode;   // extra control under Info (e.g. a status tag)
}) {
  const { meta: m, following, key } = useTrackState(title);
  const [busy, setBusy] = useState(false);

  async function toggleFollow() {
    if (busy) return;
    const next = !following;
    setBusy(true);
    try {
      const res = await authFetch("/api/follow-track", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: next ? "follow" : "unfollow", track_title: title, track_subtitle: artist || null }),
      });
      if (res.status === 401) { window.location.href = "/"; return; }
      if (res.ok) {
        if (!followSet) followSet = new Set();
        if (next) followSet.add(key); else followSet.delete(key);
        emit();
        onFollowChange?.(next);
      }
    } finally { setBusy(false); }
  }

  const sub = [artist, meta].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: last ? "none" : `1px solid ${C.lineSoft}`, minWidth: 0 }}>
      {rank !== undefined && <span style={{ ...ui.rank, width: 18 }}>{rank}</span>}
      <div style={{ width: 32, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        {m?.snippet
          ? <PreviewButton compact id={`row-${key}`} snippetPath={m.snippet} />
          : <span aria-hidden style={{ width: 32, height: 32, borderRadius: "50%", border: `1px dashed ${C.lineSoft}`, opacity: 0.6 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MarqueeText text={title || "Unknown"} style={ui.rowTitle} />
        {sub && <div style={ui.rowSub}>{sub}</div>}
      </div>
      <div style={{ display: "grid", gap: 6, flexShrink: 0, width: 96 }}>
        <button onClick={toggleFollow} disabled={busy}
          style={following
            ? { ...ui.pillSmall, justifyContent: "center", color: C.text3 }
            : { ...ui.pillSmall, justifyContent: "center", color: C.gold, background: "rgba(245,207,104,0.12)", borderColor: "rgba(245,207,104,0.30)" }}>
          {busy ? "…" : following ? "Following ✓" : "+ Follow"}
        </button>
        <Link href={trackHref(title, artist)} style={{ ...ui.pillSmall, justifyContent: "center" }}>Info</Link>
        {right}
      </div>
    </div>
  );
}
