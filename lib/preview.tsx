"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { ui, C } from "@/lib/ui";

function normalize(v: string | null | undefined) {
  return String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
/** Same key the Charts use to match a scanned title with an uploaded track. */
export function trackKey(title: string): string {
  return normalize(title)
    .replace(/\s*\(\s*(original|extended|club|radio|vocal|instrumental|dub|remaster|reprise)(\s+(mix|version|edit|cut))?\s*\)/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, 60);
}

let cache: Promise<Map<string, string>> | null = null;

/** title key → snippet path, for every uploaded track whose preview is allowed. Loaded once per session. */
export function usePreviewIndex() {
  const [index, setIndex] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const sb = createSupabaseBrowser();
    if (!sb) return;
    if (!cache) {
      cache = (async () => {
        const map = new Map<string, string>();
        try {
          const { data } = await sb.from("bpro_tracks").select("title,snippet_path,allow_preview").not("snippet_path", "is", null).limit(1000);
          for (const t of (data || []) as any[]) {
            if (t.allow_preview === false || !t.snippet_path) continue;
            const k = trackKey(String(t.title || ""));
            if (k && !map.has(k)) map.set(k, t.snippet_path);
          }
        } catch {}
        return map;
      })();
    }
    let alive = true;
    cache.then((m) => { if (alive) setIndex(m); });
    return () => { alive = false; };
  }, []);
  return index;
}

function publicUrl(path: string) {
  const sb = createSupabaseBrowser();
  const clean = path.startsWith("snippets/") ? path : `snippets/${path}`;
  return sb ? sb.storage.from("bpro_uploads").getPublicUrl(clean).data.publicUrl : "";
}

/** Small "▶ Preview" capsule — shares the app's single audio player with the Charts. */
export function PreviewButton({ id, snippetPath, compact }: { id: string; snippetPath: string; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const sync = () => {
      const w = window as any;
      const a = w._bangerAudio as HTMLAudioElement | undefined;
      setPlaying(!!a && !a.paused && w._bangerAudioTrackId === id);
    };
    window.addEventListener("banger-audio", sync);
    return () => window.removeEventListener("banger-audio", sync);
  }, [id]);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    const w = window as any;
    let audio = w._bangerAudio as HTMLAudioElement | undefined;
    if (!audio) { audio = new Audio(); audio.preload = "none"; w._bangerAudio = audio; }
    const fire = () => window.dispatchEvent(new Event("banger-audio"));
    if (w._bangerAudioTrackId !== id) {
      audio.pause(); audio.currentTime = 0; audio.src = publicUrl(snippetPath);
      w._bangerAudioTrackId = id;
    }
    audio.onplay = fire; audio.onpause = fire; audio.onended = fire;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    fire();
  }

  if (compact) return (
    <button type="button" onClick={toggle} aria-label={playing ? "Stop preview" : "Play preview"}
      style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, cursor: "pointer", padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: playing ? "1px solid transparent" : "1px solid rgba(245,207,104,0.30)",
        background: playing ? C.goldGrad : "rgba(245,207,104,0.12)", color: playing ? C.goldInk : C.gold,
        boxShadow: playing ? "0 0 12px rgba(245,207,104,0.5)" : undefined }}>
      {playing
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginLeft: 2 }}><path d="M7 4.5v15l13-7.5z" /></svg>}
    </button>
  );

  return (
    <button type="button" onClick={toggle} aria-label={playing ? "Stop preview" : "Play preview"}
      style={{ ...ui.pillSmall, padding: "5px 10px", fontSize: 11, color: playing ? C.goldInk : C.gold,
        background: playing ? C.goldGrad : "rgba(245,207,104,0.12)", borderColor: playing ? "transparent" : "rgba(245,207,104,0.30)", flexShrink: 0 }}>
      {playing ? "❚❚" : "▶"} {playing ? "Stop" : "Preview"}
    </button>
  );
}
