"use client";

import { fmtTitle, fmtArtist } from "@/lib/format";
import { useEffect, useId, useState, type ReactNode, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { authFetch } from "@/lib/authFetch";
import { ui, C, tag, TAG_TEXT } from "@/lib/ui";
import { PreviewButton, trackKey, trackHref } from "@/lib/preview";
import MarqueeText from "@/components/MarqueeText";
import AdminTrackSheet, { useIsAdmin } from "@/components/AdminTrackSheet";
import { openPro } from "@/components/ProSheet";

/* ── Shared data, loaded once per session ─────────────────────────── */

type Meta = { snippet: string | null; releaseDate: string | null; released: boolean };
let metaCache: Promise<Map<string, Meta>> | null = null;
function loadMeta() {
  if (!metaCache) {
    metaCache = (async () => {
      const map = new Map<string, Meta>();
      const sb = createSupabaseBrowser();
      if (!sb) return map;
      try {
        const { data } = await sb.from("bpro_tracks").select("title,snippet_path,allow_preview,release_date,is_released").limit(1000);
        for (const t of (data || []) as any[]) {
          const k = trackKey(String(t.title || ""));
          if (!k || map.has(k)) continue;
          map.set(k, { snippet: t.allow_preview === false ? null : t.snippet_path || null, releaseDate: t.release_date || null, released: !!t.is_released });
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

/** Released status of uploaded tracks (BANGER's own truth), by track key. */
export function useReleasedIndex() {
  const [idx, setIdx] = useState<Map<string, boolean> | null>(null);
  useEffect(() => { let alive = true; loadMeta().then((m) => { if (alive) setIdx(new Map([...m].map(([k, v]) => [k, v.released]))); }); return () => { alive = false; }; }, []);
  return idx;
}

export function useTrackState(title: string) {
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

/** Small toast at the bottom of the screen (no state needed in the pages). */
export function showToast(text: string) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed", left: "50%", bottom: "112px", transform: "translateX(-50%) translateY(8px)", zIndex: "999",
    background: "rgba(30,30,30,0.9)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "999px",
    padding: "11px 18px", fontSize: "14px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap",
    backdropFilter: "blur(24px)", opacity: "0", transition: "opacity .25s ease, transform .25s ease",
    fontFamily: "inherit",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });
  window.setTimeout(() => { el.style.opacity = "0"; window.setTimeout(() => el.remove(), 300); }, 2200);
}

/** Bell icon used on every Follow button (= "notify me when it's out"). */
export function Bell({ filled }: { filled?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 21h4" />
    </svg>
  );
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
export default function TrackRow({ title, artist, rank, meta, last, onFollowChange, right, released, status, bigRank }: {
  title: string; artist?: string | null; rank?: number; meta?: string; last?: boolean;
  bigRank?: boolean;         // chart look: big gold number
  released?: boolean;        // released tracks can't be followed (nothing left to wait for)
  status?: "rel" | "unrel";  // show a Released / Unreleased pill (the uploaded track's real status wins)
  onFollowChange?: (following: boolean) => void;
  right?: ReactNode;   // extra control under Info (e.g. a status tag)
}) {
  const { meta: m, following, key } = useTrackState(title);
  const [busy, setBusy] = useState(false);
  const isAdmin = useIsAdmin();
  const lineGroup = useId();   // title + artist line glide together
  const [editing, setEditing] = useState(false);

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
      if (res.status === 402) { openPro("follow"); return; }
      if (res.ok) {
        if (!followSet) followSet = new Set();
        if (next) followSet.add(key); else followSet.delete(key);
        emit();
        if (next) showToast("We'll notify you the day it drops");
        onFollowChange?.(next);
      }
    } finally { setBusy(false); }
  }

  const sub = [artist ? fmtArtist(artist) : "", meta].filter(Boolean).join(" · ");
  const router = useRouter();
  const href = trackHref(title, artist);
  const canFollow = !(released ?? m?.released);
  const round: CSSProperties = { width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 };

  // The whole row opens the track (Info); the bell follows it; admins get a small pencil.
  return (
    <div role="link" tabIndex={0} onClick={() => router.push(href)} onKeyDown={(e) => { if (e.key === "Enter") router.push(href); }}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: last ? "none" : `1px solid ${C.lineSoft}`, minWidth: 0, cursor: "pointer" }}>
      {rank !== undefined && <span style={bigRank ? BIG_RANK : { ...ui.rank, width: 18 }}>{rank}</span>}
      <div onClick={(e) => e.stopPropagation()} style={{ width: 32, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        {m?.snippet
          ? <PreviewButton compact id={`row-${key}`} snippetPath={m.snippet} />
          : <span aria-hidden style={{ width: 32, height: 32, borderRadius: "50%", border: `1px dashed ${C.lineSoft}`, opacity: 0.6 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MarqueeText passive text={fmtTitle(title) || "Unknown"} style={ui.rowTitle} group={lineGroup} />
        {(sub || status) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, marginTop: 2 }}>
            {sub && <span style={{ flex: 1, minWidth: 0 }}><MarqueeText passive text={sub} group={lineGroup} style={{ ...ui.rowSub, marginTop: 0 }} /></span>}
            {status && (() => { const k = m ? (m.released ? "rel" : "unrel") : status; return <span style={{ ...tag(k), fontSize: 11, padding: "3px 8px" }}>{TAG_TEXT[k]}</span>; })()}
          </div>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {right}
        {isAdmin && (
          <button onClick={() => setEditing(true)} aria-label="Edit (admin)"
            style={{ ...round, width: 30, height: 30, border: `1px solid ${C.glassBorder}`, background: "rgba(255,255,255,0.05)", color: C.text3 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
          </button>
        )}
        {canFollow && (
          <button onClick={toggleFollow} disabled={busy} aria-label={following ? "Following — tap to unfollow" : "Follow — notify me when it's out"}
            style={following
              ? { ...round, border: "1px solid rgba(245,207,104,0.45)", background: C.goldGrad, color: C.goldInk }
              : { ...round, border: "1px solid rgba(245,207,104,0.35)", background: "rgba(245,207,104,0.10)", color: C.gold }}>
            {busy ? "…" : <span style={{ transform: "scale(1.35)", display: "flex" }}><Bell filled={following} /></span>}
          </button>
        )}
        <button onClick={() => router.push(href)} aria-label="Info"
          style={{ background: "none", border: "none", padding: "8px 0 8px 4px", cursor: "pointer", fontFamily: "inherit", color: C.text3, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
          Info<span style={{ fontSize: 16 }}>›</span>
        </button>
        {editing && <AdminTrackSheet title={title} artist={artist} onClose={() => setEditing(false)} />}
      </div>
    </div>
  );
}


export const BIG_RANK: CSSProperties = { width: 34, flexShrink: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: C.gold, fontVariantNumeric: "tabular-nums", textAlign: "left" };

/** The same Follow button as in every list (bell + toast), usable on its own. */
export function FollowButton({ title, artist, style }: { title: string; artist?: string | null; style?: CSSProperties }) {
  const { following, key } = useTrackState(title);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (busy) return;
    const next = !following;
    setBusy(true);
    try {
      const res = await authFetch("/api/follow-track", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: next ? "follow" : "unfollow", track_title: title, track_subtitle: artist || null }),
      });
      if (res.status === 401) { window.location.href = "/"; return; }
      if (res.status === 402) { openPro("follow"); return; }
      if (res.ok) {
        if (!followSet) followSet = new Set();
        if (next) followSet.add(key); else followSet.delete(key);
        emit();
        if (next) showToast("We'll notify you the day it drops");
      }
    } finally { setBusy(false); }
  }
  return (
    <button onClick={toggle} disabled={busy}
      style={{ ...(following
        ? { ...ui.pillSmall, justifyContent: "center", color: C.text3 }
        : { ...ui.pillSmall, justifyContent: "center", color: C.gold, background: "rgba(245,207,104,0.12)", borderColor: "rgba(245,207,104,0.30)" }), ...style }}>
      {busy ? "…" : <><Bell filled={following} />{following ? "Following" : "Follow"}</>}
    </button>
  );
}
