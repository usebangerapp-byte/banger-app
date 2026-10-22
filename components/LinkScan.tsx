"use client";

import { useEffect, useRef, useState } from "react";
import { recognizeAudio } from "@/lib/scan/recognizeAudio";
import { getRegion } from "@/lib/scan/getRegion";
import { fmtTime, youtubeId } from "@/lib/setlists";
import { buildDraft, type DraftRow } from "@/components/SetScanner";
import { fmtTitle, fmtArtist } from "@/lib/format";
import { ui, C, glass, FLAT } from "@/lib/ui";

const SAMPLE_MS = 10_000;   // listen 10 s
const STEP_SEC = 90;        // one listen every 1:30 of the set
const SETTLE_MS = 2500;     // let the player buffer after a jump

/** Same controls for every player: jump, play, where are we, how long. */
type Ctl = { seek: (s: number) => void; play: () => void; pause: () => void; time: () => Promise<number>; duration: () => Promise<number>; destroy: () => void };

function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("load"));
    document.head.appendChild(s);
  });
}
let ytReady: Promise<any> | null = null;
function loadYT(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!ytReady) ytReady = new Promise((res) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); res(w.YT); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  });
  return ytReady;
}

const kindOf = (url: string) => (youtubeId(url) ? "youtube" : /soundcloud\.com\//i.test(url) ? "soundcloud" : null);

/**
 * "From a link": the set plays here (official YouTube / SoundCloud players), BANGER jumps through it
 * and listens through the microphone a few seconds every 1:30, then gives the tracklist.
 */
export default function LinkScan({ textOf }: { textOf: (rows: { title: string; artist?: string | null }[]) => string }) {
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<{ t: number; est?: number; title: string | null; artist: string | null }[]>([]);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ctl = useRef<Ctl | null>(null);
  const stop = useRef(false);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => { stop.current = true; stream.current?.getTracks().forEach((t) => t.stop()); ctl.current?.destroy(); }, []);

  async function open() {
    const u = url.trim();
    const kind = kindOf(u);
    if (!kind) { setStatus("Paste a YouTube or SoundCloud link."); return; }
    ctl.current?.destroy(); ctl.current = null; setSamples([]); setStatus("Loading the player…"); setLoaded(u);
    await new Promise((r) => setTimeout(r, 50));
    const el = box.current; if (!el) return;
    el.innerHTML = "";
    try {
      if (kind === "youtube") {
        const YT = await loadYT();
        const div = document.createElement("div"); el.appendChild(div);
        await new Promise<void>((res) => {
          const p = new YT.Player(div, { videoId: youtubeId(u), width: "100%", height: "100%", playerVars: { playsinline: 1, rel: 0 }, events: { onReady: () => res() } });
          ctl.current = {
            seek: (s) => p.seekTo(s, true), play: () => p.playVideo(), pause: () => p.pauseVideo(),
            time: async () => p.getCurrentTime?.() || 0, duration: async () => p.getDuration?.() || 0, destroy: () => { try { p.destroy(); } catch {} },
          };
        });
      } else {
        await loadScript("https://w.soundcloud.com/player/api.js", () => !!(window as any).SC?.Widget);
        const SC = (window as any).SC;
        const f = document.createElement("iframe");
        f.allow = "autoplay"; f.style.cssText = "width:100%;height:100%;border:0";
        f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&auto_play=false&visual=true`;
        el.appendChild(f);
        const w = SC.Widget(f);
        await new Promise<void>((res) => w.bind(SC.Widget.Events.READY, () => res()));
        const ask = (m: string) => new Promise<number>((res) => w[m]((v: number) => res((v || 0) / 1000)));
        ctl.current = {
          seek: (s) => w.seekTo(s * 1000), play: () => w.play(), pause: () => w.pause(),
          time: () => ask("getPosition"), duration: () => ask("getDuration"), destroy: () => { try { f.remove(); } catch {} },
        };
      }
      setStatus("Ready. Turn the phone volume up, then start.");
    } catch { setStatus("Couldn't load this link."); setLoaded(null); }
  }

  async function listen(): Promise<Blob | null> {
    const s = stream.current; if (!s) return null;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
    const mr = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((r) => { mr.onstop = () => r(); });
    mr.start(); await new Promise((r) => setTimeout(r, SAMPLE_MS)); mr.stop(); await done;
    return new Blob(chunks, { type: mr.mimeType || "audio/webm" });
  }

  async function run() {
    const p = ctl.current; if (!p) return;
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints }); }
    catch { setStatus("Microphone access is needed."); return; }
    stop.current = false; setRunning(true); setSamples([]); setProgress(0);
    const region = await getRegion();
    p.play(); await new Promise((r) => setTimeout(r, 1500));
    const end = await p.duration();
    for (let pos = 0; pos < Math.max(end - 5, 1) && !stop.current; pos += STEP_SEC) {
      setProgress(end ? pos / end : 0);
      setStatus(`Listening at ${fmtTime(pos)}${end ? ` / ${fmtTime(end)}` : ""}…`);
      try { p.seek(pos); p.play(); } catch {}
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      if (stop.current) break;
      const t = await p.time().catch(() => pos);
      const blob = await listen(); if (!blob || stop.current) break;
      try {
        const j: any = await recognizeAudio(blob, blob.type, region, { noLog: true });
        const found = j?.result_type && j.result_type !== "not_found" && j.track_title && j.track_title !== "Unknown";
        const off = Number(j?.metadata?.custom_files?.[0]?.play_offset_ms ?? j?.metadata?.music?.[0]?.play_offset_ms ?? NaN);
        const est = found && isFinite(off) && off / 1000 <= t + 5 ? Math.max(0, Math.floor(t - off / 1000)) : undefined;
        setSamples((l) => [...l, { t: Math.floor(t), est, title: found ? j.track_title : null, artist: found ? (j.track_subtitle || null) : null }]);
      } catch { setSamples((l) => [...l, { t: Math.floor(t), title: null, artist: null }]); }
    }
    try { p.pause(); } catch {}
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    setRunning(false); setProgress(1);
    setStatus(stop.current ? "Stopped. Here is what was found." : "Done. Check the tracklist below.");
  }

  const rows: DraftRow[] = samples.length ? buildDraft(samples) : [];
  const text = textOf(rows.map((r) => ({ title: r.id ? "ID" : r.title, artist: r.id ? null : r.artist })));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ ...glass, borderRadius: 22, padding: 16, display: "grid", gap: 10 , ...FLAT }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube or SoundCloud link" inputMode="url"
            style={{ ...ui.input, flex: 1, minWidth: 0, padding: "11px 14px" }} disabled={running} />
          <button onClick={open} disabled={running || !url.trim()} style={{ ...ui.pill, flexShrink: 0 }}>Load</button>
        </div>
        {loaded && <div ref={box} style={{ width: "100%", aspectRatio: kindOf(loaded) === "youtube" ? "16 / 9" : undefined, height: kindOf(loaded) === "soundcloud" ? 166 : undefined, borderRadius: 14, overflow: "hidden", background: "#000" }} />}
        {!loaded && <div ref={box} style={{ display: "none" }} />}
        {loaded && ctl.current && !running && <button onClick={run} style={ui.cta}>⚡ Start fast auto scan</button>}
        {running && <>
          <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}><div style={{ width: `${Math.round(progress * 100)}%`, height: "100%", background: C.goldGrad, transition: "width .6s" }} /></div>
          <button onClick={() => { stop.current = true; setStatus("Stopping…"); }} style={{ ...ui.pill, justifyContent: "center", color: C.danger }}>■ Stop</button>
        </>}
        {status && <div style={{ fontSize: 13, color: C.gold }}>{status}</div>}
        {!loaded && <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.5 }}>The set plays here and BANGER listens through the microphone every 1:30. Keep the sound on and the screen open.</div>}
      </section>

      {rows.length > 0 && (
        <section style={{ ...glass, borderRadius: 22, padding: "6px 16px 14px", display: "grid", gap: 0 , ...FLAT }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
              <div style={{ width: 44, flexShrink: 0, display: "grid", gap: 2 }}>
                <span style={{ ...ui.rank, width: "auto" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 12, color: C.text3 }}>{r.start}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {r.id ? <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>ID</div> : <>
                  <div style={{ fontSize: 15, fontWeight: 650, overflowWrap: "anywhere" }}>{fmtTitle(r.title)}</div>
                  <div style={{ fontSize: 13, color: C.text2, overflowWrap: "anywhere" }}>{r.artist ? fmtArtist(r.artist) : ""}</div>
                </>}
                {r.flag && <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>? {r.flag}</div>}
              </div>
            </div>
          ))}
          {!running && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <button onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} style={{ ...ui.pill, justifyContent: "center" }}>{copied ? "Copied ✓" : "Copy"}</button>
              <button onClick={async () => { try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch {} }} style={{ ...ui.pillSolid, justifyContent: "center" }}>Share</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
