"use client";

import { useEffect, useRef, useState } from "react";
import { recognizeAudio } from "@/lib/scan/recognizeAudio";
import { getRegion } from "@/lib/scan/getRegion";
import { fmtTime, parseTime } from "@/lib/setlists";
import { titleKey } from "@/lib/titleKey";
import { ui, C, glass } from "@/lib/ui";

type Sample = { t: number; title: string | null; artist: string | null };
export type DraftRow = { start: string; title: string; artist: string; id: boolean; flag?: string };

const SAMPLE_MS = 10_000;     // listen 10 s per sample
const STEP_SEC = 90;          // fast scan: one sample every 1:30 of the set
const SETTLE_MS = 2500;       // let the video buffer after a jump

/**
 * Turns raw samples (time → recognised track or nothing) into a tracklist draft:
 * - same track on consecutive samples = one row, starting at the first sample
 * - a single odd sample between two samples of the same track = ignored (transitions)
 * - a track heard only once = kept, marked "?" (check it)
 * - nothing recognised = an ID row
 */
export function buildDraft(samples: Sample[]): DraftRow[] {
  const s = [...samples].sort((a, b) => a.t - b.t);
  const key = (x: Sample) => (x.title ? `${titleKey(x.title)}|${titleKey(x.artist || "")}` : "");
  // drop lone outliers: A X A → A A
  for (let i = 1; i < s.length - 1; i++) if (key(s[i - 1]) && key(s[i - 1]) === key(s[i + 1]) && key(s[i]) !== key(s[i - 1])) s[i] = { ...s[i - 1], t: s[i].t };
  const rows: (DraftRow & { n: number; k: string })[] = [];
  for (const x of s) {
    const k = key(x), last = rows[rows.length - 1];
    if (last && last.k === k) { last.n++; continue; }
    rows.push({ k, n: 1, start: fmtTime(x.t), title: x.title || "", artist: x.artist || "", id: !x.title });
  }
  if (rows[0] && parseTime(rows[0].start)! < STEP_SEC) rows[0].start = "0:00";
  return rows.map(({ k: _k, n, ...r }) => ({ ...r, flag: !r.id && n < 2 ? "heard once — check" : undefined }));
}

export default function SetScanner({ player, duration, initial, onSave, onClose }: {
  player: React.MutableRefObject<any>; duration: number; initial: DraftRow[];
  onSave: (rows: DraftRow[]) => Promise<boolean>; onClose: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "fast" | "live">("idle");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [rows, setRows] = useState<DraftRow[]>(initial);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const stop = useRef(false);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => { stop.current = true; stream.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => { if (samples.length) setRows(buildDraft(samples)); }, [samples]);

  async function listenOnce(): Promise<Blob | null> {
    const s = stream.current; if (!s) return null;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
    const mr = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((r) => { mr.onstop = () => r(); });
    mr.start(); await new Promise((r) => setTimeout(r, SAMPLE_MS)); mr.stop(); await done;
    return new Blob(chunks, { type: mr.mimeType || "audio/webm" });
  }

  async function sample(t: number) {
    const blob = await listenOnce(); if (!blob || stop.current) return;
    try {
      const j: any = await recognizeAudio(blob, blob.type, await getRegion(), { noLog: true });
      const found = j?.result_type && j.result_type !== "not_found" && j.track_title && j.track_title !== "Unknown";
      setSamples((l) => [...l, { t: Math.floor(t), title: found ? j.track_title : null, artist: found ? (j.track_subtitle || null) : null }]);
      setStatus(found ? `${fmtTime(t)} · ${j.track_title}` : `${fmtTime(t)} · nothing recognised`);
    } catch { setSamples((l) => [...l, { t: Math.floor(t), title: null, artist: null }]); }
  }

  async function start(m: "fast" | "live") {
    const p = player.current;
    if (!p?.getCurrentTime) { setStatus("The player isn't ready yet."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints });
    } catch { setStatus("Microphone access is needed."); return; }
    stop.current = false; setMode(m); setSamples([]);
    try { p.unMute?.(); p.setVolume?.(100); } catch {}
    const end = duration || p.getDuration?.() || 0;
    if (m === "fast") {
      for (let pos = 0; pos < end - 5 && !stop.current; pos += STEP_SEC) {
        setStatus(`Jumping to ${fmtTime(pos)}…`);
        try { p.seekTo(pos, true); p.playVideo(); } catch {}
        await new Promise((r) => setTimeout(r, SETTLE_MS));
        if (stop.current) break;
        setStatus(`Listening at ${fmtTime(pos)}…`);
        await sample(p.getCurrentTime?.() ?? pos);
      }
    } else {
      try { p.playVideo(); } catch {}
      while (!stop.current) {
        const t = p.getCurrentTime?.() ?? 0;
        if (end && t >= end - 2) break;
        setStatus(`Listening at ${fmtTime(t)}…`);
        await sample(t);
      }
    }
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    setMode("idle"); setStatus((s) => (stop.current ? "Stopped. Check the tracklist below." : "Done. Check the tracklist below."));
  }

  const set = (i: number, patch: Partial<DraftRow>) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...patch, flag: undefined } : r)));
  const inp: React.CSSProperties = { ...ui.input, padding: "8px 10px", fontSize: 14 };
  const scanning = mode !== "idle";

  return (
    <section style={{ ...glass, borderRadius: 22, padding: 16, display: "grid", gap: 12, border: "1px solid rgba(245,207,104,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>🎙 Scan this set</div>
        <button onClick={onClose} disabled={scanning} style={{ ...ui.pillSmall, color: C.text3 }}>Close</button>
      </div>
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>Turn the video sound up. BANGER listens through the microphone and notes the minute of each track.</div>
      {!scanning ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={() => start("fast")} style={{ ...ui.cta, padding: "12px 8px", fontSize: 14 }}>⚡ Fast scan</button>
          <button onClick={() => start("live")} style={{ ...ui.pill, justifyContent: "center", padding: "12px 8px", fontSize: 14 }}>▶ Live scan</button>
        </div>
      ) : (
        <button onClick={() => { stop.current = true; setStatus("Stopping…"); }} style={{ ...ui.pill, justifyContent: "center", color: C.danger }}>■ Stop</button>
      )}
      {status && <div style={{ fontSize: 13, color: C.gold }}>{status}{scanning && ` · ${samples.length} samples`}</div>}

      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: C.text3, marginTop: 4 }}>DRAFT TRACKLIST</div>
      {rows.length === 0 && <div style={{ fontSize: 13, color: C.text3 }}>Start a scan, or add the tracks by hand.</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gap: 6, padding: "10px 0", borderTop: `1px solid ${C.lineSoft}` }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ ...ui.rank, width: 22 }}>{String(i + 1).padStart(2, "0")}</span>
            <input value={r.start} onChange={(e) => set(i, { start: e.target.value })} style={{ ...inp, width: 74 }} aria-label="Start time" />
            <button onClick={() => set(i, { id: !r.id })} style={{ ...ui.pillSmall, color: r.id ? C.gold : C.text3, borderColor: r.id ? "rgba(245,207,104,0.4)" : C.glassBorder }}>{r.id ? "ID" : "Known"}</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => setRows((l) => l.filter((_, j) => j !== i))} aria-label="Remove" style={{ background: "none", border: "none", color: C.text4, fontSize: 16, cursor: "pointer", padding: 4 }}>✕</button>
          </div>
          {!r.id && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input value={r.artist} onChange={(e) => set(i, { artist: e.target.value })} placeholder="Artist" style={inp} />
              <input value={r.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Title" style={inp} />
            </div>
          )}
          {r.flag && <div style={{ fontSize: 12, color: C.gold }}>? {r.flag}</div>}
        </div>
      ))}
      <button onClick={() => setRows((l) => [...l, { start: l.length ? l[l.length - 1].start : "0:00", title: "", artist: "", id: true }])} style={{ ...ui.more, color: C.gold }}>+ Add a row</button>
      <button disabled={saving || scanning || !rows.length} onClick={async () => { setSaving(true); const ok = await onSave(rows); setSaving(false); if (ok) onClose(); }} style={ui.cta}>
        {saving ? "Saving…" : "Save tracklist"}
      </button>
      <div style={{ fontSize: 12, color: C.text4 }}>Saving replaces the set&apos;s tracklist. Names already validated are kept when the row stays the same.</div>
    </section>
  );
}
