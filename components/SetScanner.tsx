"use client";

import { useEffect, useRef, useState } from "react";
import { recognizeAudio } from "@/lib/scan/recognizeAudio";
import { getRegion } from "@/lib/scan/getRegion";
import { fmtTime, parseTime, parseTracklist } from "@/lib/setlists";
import { authFetch } from "@/lib/authFetch";
import { titleKey } from "@/lib/titleKey";
import { ui, C, glass, FLAT } from "@/lib/ui";

type Sample = { t: number; est?: number; title: string | null; artist: string | null };
export type DraftRow = { start: string; title: string; artist: string; id: boolean; flag?: string; scan?: { title: string; artist: string; heard: number } };

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
  const rows: (DraftRow & { n: number; k: string; sec: number })[] = [];
  for (const x of s) {
    const k = key(x), last = rows[rows.length - 1];
    // Real start of the track: the scan time minus how far into the track the sample was (from the recogniser)
    const est = x.title && x.est != null ? x.est : x.t;
    if (last && last.k === k) { last.n++; if (x.title && est < last.sec && est > (rows[rows.length - 2]?.sec ?? -1)) { last.sec = est; last.start = fmtTime(est); } continue; }
    const sec = Math.max(est, last ? last.sec + 1 : 0);
    rows.push({ k, n: 1, sec, start: fmtTime(sec), title: x.title || "", artist: x.artist || "", id: !x.title });
  }
  if (rows[0] && parseTime(rows[0].start)! < STEP_SEC) rows[0].start = "0:00";
  return rows.map(({ k: _k, n, sec: _s, ...r }) => ({ ...r, flag: !r.id && n < 2 ? "heard once — check" : undefined }));
}

/**
 * The scan never renames an ID by itself. What it heard is attached to the ID as a proposal;
 * on save it goes to the review queue (/sets/review) next to the users' names, and an admin validates.
 */
const propose = (r: DraftRow, sc: DraftRow, heard: number): DraftRow => {
  if (r.scan && r.scan.heard >= heard) return r;
  return { ...r, id: true, scan: { title: sc.title, artist: sc.artist, heard }, flag: `scan heard ${sc.artist ? sc.artist + " - " : ""}${sc.title} (${heard}×) → goes to review` };
};
function mergeScan(base: DraftRow[], scanned: DraftRow[]): DraftRow[] {
  // no tracklist before the scan: tracks heard twice stay as a draft to check, single hits become IDs with a proposal
  if (!base.length) return scanned.map((r) => (!r.id && r.flag ? propose({ ...r, title: "", artist: "" }, r, 1) : r));
  const out = base.map((r) => ({ ...r }));
  for (const sc of scanned) {
    if (sc.id) continue;
    const t = parseTime(sc.start) ?? 0;
    let best = -1, bestD = Infinity;
    out.forEach((r, i) => { const d = Math.abs((parseTime(r.start) ?? 0) - t); if (r.id && d < bestD) { best = i; bestD = d; } });
    if (best < 0 || bestD > 120) continue;
    out[best] = propose(out[best], sc, sc.flag ? 1 : 2);
  }
  return out;
}

/** Photo → bigger, black & white, high contrast: the reader makes far fewer mistakes (blue timestamps included). */
async function sharpen(file: File): Promise<Blob | File> {
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(2, 2400 / Math.max(img.width, img.height)) || 1;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    // grey levels, then: dark screenshot (white text on black) → inverted; contrast stretched (no hard cut,
    // a hard black/white cut was erasing light-blue timestamps and whole lines)
    const n = px.length / 4, grey = new Uint8ClampedArray(n);
    let sum = 0, lo = 255, hi = 0;
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      grey[j] = y; sum += y;
    }
    const dark = sum / n < 110;
    for (let j = 0; j < n; j++) { const v = dark ? 255 - grey[j] : grey[j]; grey[j] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    const span = Math.max(1, hi - lo);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      let v = ((grey[j] - lo) / span) * 255;
      v = v < 200 ? v * 0.75 : v;                 // push text darker, keep the background white
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/png"));
  } catch { return file; }
}

/** OCR text → "mm:ss Artist - Title" lines. Fixes "10.4121" (lost colon), "12 51:25 …" (number left in), stray dashes and dots. */
export function cleanOcr(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let l = raw.replace(/[|“”]/g, "").replace(/\s+/g, " ").trim();
    if (!l) continue;
    const numbered = /^\d{1,3}\s*[.,)]\s*\S+\s+\S+/.test(l);   // "9. 36:37 Jackie…" even if the rest is badly read
    l = l.replace(/^\d{1,3}\s*[.,)]\s*/, "");                      // "10. " / "10."
    l = l.replace(/^(\d{1,3})\s+(?=\d{1,2}[:.]\d{2})/, "");           // "12 51:25" → "51:25"
    l = l.replace(/^(\d{1,2})[.,;](\d{2})[.,;:](\d{2})\b/, "$1:$2:$3"); // "1.04.22"
    l = l.replace(/^(\d{1,2})[.,;](\d{2})\b/, "$1:$2");                 // "41.21"
    l = l.replace(/^(\d)(\d{2})(\d{2})\b/, "$1:$2:$3");                 // "10422" → 1:04:22
    l = l.replace(/^(\d{2})(\d{2})\b/, "$1:$2");                         // "4121" → 41:21
    l = l.replace(/^(\d{1,2}:\d{2}(?::\d{2})?)(?=[^\s:\d])/, "$1 ");      // "41:21Betoko"
    l = l.replace(/\s*[-–—]\s*/g, " - ").replace(/(\S)-(?=[A-Z])/g, "$1 - "); // "Betoko-USoFine" → "Betoko - USoFine"
    // trailing reading noise: " -", " .", "._", "= .", " a :" …
    for (let k = 0; k < 3; k++) l = l.replace(/(?:\s+[^\sA-Za-z0-9À-ÿ()]+|\s+[a-z]\W*)+$/, "").replace(/[\s.,;:=_\-–—~]+$/, "").trim();
    const hasTime = /^\d{1,2}:\d{2}/.test(l);
    // keep lines with a time, or that look like "Artist - Title" (the time was unreadable)
    if (hasTime || / - \S/.test(l) || numbered) out.push(l);
  }
  return out;
}

export default function SetScanner({ player, duration, initial, sourceUrl, onSave, onClose }: {
  player: React.MutableRefObject<any>; duration: number; initial: DraftRow[]; sourceUrl: string;
  onSave: (rows: DraftRow[]) => Promise<boolean>; onClose: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "fast" | "live" | "ids">("idle");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [rows, setRows] = useState<DraftRow[]>(initial);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const stop = useRef(false);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => { stop.current = true; stream.current?.getTracks().forEach((t) => t.stop()); }, []);
  const base = useRef<DraftRow[]>(initial);   // the tracklist before the scan started
  useEffect(() => { if (samples.length) setRows(mergeScan(base.current, buildDraft(samples))); }, [samples]);
  const [paste, setPaste] = useState<string | null>(null);

  async function importFromLink() {
    setStatus("Looking for a tracklist in the description and comments…");
    const r = await authFetch(`/api/setlists/preview?url=${encodeURIComponent(sourceUrl)}`).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.tracklist) { setStatus(j?.note || j?.error || "No tracklist found — paste one below."); setPaste(""); return; }
    applyText(j.tracklist); setStatus(j.note || "Tracklist imported — check it.");
  }
  // Photos of a tracklist (a screenshot of a YouTube comment…) → text, read on the device (OCR)
  const [ocr, setOcr] = useState("");
  async function fromPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 3);
    setOcr("Loading the reader…");
    try {
      const w = window as any;
      if (!w.Tesseract) await new Promise<void>((res, rej) => {
        const sc = document.createElement("script");
        sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
        sc.onload = () => res(); sc.onerror = () => rej(new Error("load")); document.head.appendChild(sc);
      });
      let text = "";
      for (let i = 0; i < list.length; i++) {
        setOcr(`Reading photo ${i + 1}/${list.length}…`);
        const r = await w.Tesseract.recognize(await sharpen(list[i]), "eng");
        text += "\n" + String(r?.data?.text || "");
      }
      const lines = cleanOcr(text);
      if (!lines.length) { setOcr("Couldn't read a tracklist on these photos."); return; }
      // the photo REPLACES the draft right away (no extra tap needed); the text stays below for fixes
      applyText(lines.join("\n"));
      setPaste(lines.join("\n"));
      const noTime = lines.filter((l) => !/^\d{1,2}:\d{2}/.test(l)).length;
      setOcr(`✓ Draft replaced by the photo · ${lines.length} tracks${noTime ? ` · ${noTime} without a time — add it` : ""}. Check it, then tap “Save tracklist” at the bottom.`);
    } catch { setOcr("Couldn't read the photos — paste the text instead."); }
  }

  function applyText(text: string) {
    const parsed = parseTracklist(text);
    if (!parsed.length) { setStatus("Nothing to import — one track per line, “0:00 Artist - Title”."); return; }
    const next = parsed.map((p) => ({ start: fmtTime(p.start_sec) || "", title: p.title || "", artist: p.artist || "", id: !p.title }));
    setRows(next); base.current = next; setPaste(null);
    setStatus(`Draft replaced · ${next.length} tracks — tap “Save tracklist” to publish it.`);
  }

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
      const off = Number(j?.metadata?.custom_files?.[0]?.play_offset_ms ?? j?.metadata?.music?.[0]?.play_offset_ms ?? NaN);
      const est = found && isFinite(off) && off / 1000 <= t + 5 ? Math.max(0, Math.floor(t - off / 1000)) : undefined;
      setSamples((l) => [...l, { t: Math.floor(t), est, title: found ? j.track_title : null, artist: found ? (j.track_subtitle || null) : null }]);
      setStatus(found ? `${fmtTime(t)} · ${j.track_title}` : `${fmtTime(t)} · nothing recognised`);
    } catch { setSamples((l) => [...l, { t: Math.floor(t), title: null, artist: null }]); }
  }

  async function start(m: "fast" | "live" | "ids") {
    const p = player.current;
    if (!p?.getCurrentTime) { setStatus("The player isn't ready yet."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints });
    } catch { setStatus("Microphone access is needed."); return; }
    stop.current = false; setMode(m); setSamples([]); base.current = rows.filter((r) => r.title || r.id);
    try { p.unMute?.(); p.setVolume?.(100); } catch {}
    const end = duration || p.getDuration?.() || 0;
    if (m === "ids") {
      // Only the unknown moments: 2 listens in the middle of each ID (away from the transitions)
      const starts = rows.map((r) => parseTime(r.start)).map((v) => (v == null ? null : v));
      const spots: number[] = [];
      rows.forEach((r, i) => {
        const a = starts[i]; if (!r.id || a == null) return;
        const nextStart = starts.slice(i + 1).find((x) => x != null) ?? (end || a + 300);
        const len = Math.max(30, nextStart - a);
        spots.push(Math.floor(a + len * 0.3), Math.floor(a + len * 0.65));
      });
      if (!spots.length) setStatus("No ID with a time in the tracklist.");
      for (let k = 0; k < spots.length && !stop.current; k++) {
        const pos = spots[k];
        setStatus(`ID ${Math.floor(k / 2) + 1}/${spots.length / 2} · jumping to ${fmtTime(pos)}…`);
        try { p.seekTo(pos, true); p.playVideo(); } catch {}
        await new Promise((r) => setTimeout(r, SETTLE_MS));
        if (stop.current) break;
        setStatus(`ID ${Math.floor(k / 2) + 1}/${spots.length / 2} · listening at ${fmtTime(pos)}…`);
        await sample(p.getCurrentTime?.() ?? pos);
      }
    } else if (m === "fast") {
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
    <section style={{ ...glass, borderRadius: 22, padding: 16, display: "grid", gap: 12, border: "1px solid rgba(245,207,104,0.35)" , ...FLAT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>🎙 Scan this set</div>
        <button onClick={onClose} disabled={scanning} style={{ ...ui.pillSmall, color: C.text3 }}>Close</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={importFromLink} disabled={scanning} style={{ ...ui.cta, padding: "12px 8px", fontSize: 14 }}>⬇ Import tracklist</button>
        <button onClick={() => setPaste(paste === null ? "" : null)} disabled={scanning} style={{ ...ui.pill, justifyContent: "center", padding: "12px 8px", fontSize: 14 }}>📋 Paste</button>
      </div>
      <label style={{ ...ui.pill, justifyContent: "center", padding: "12px 8px", fontSize: 14, cursor: scanning ? "default" : "pointer" }}>
        📷 From photos (up to 3)
        <input type="file" accept="image/*" multiple disabled={scanning} style={{ display: "none" }} onChange={(e) => { fromPhotos(e.target.files); e.target.value = ""; }} />
      </label>
      {ocr && <div style={{ fontSize: 13, color: C.gold }}>{ocr}</div>}
      {paste !== null && (
        <div style={{ display: "grid", gap: 8 }}>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8} placeholder={"Paste the tracklist (a YouTube comment, the description…)\n1. 00:00 Artist - Title\n2. 04:55 Artist - Title"} style={{ ...ui.input, fontFamily: "inherit", resize: "vertical" }} />
          <button onClick={() => applyText(paste)} disabled={!paste.trim()} style={{ ...ui.pill, justifyContent: "center" }}>Use this tracklist</button>
        </div>
      )}
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>Then scan to fill the missing ones: turn the video sound up, BANGER listens through the microphone. Scan results never rename an ID: they go to “Review IDs” for you to confirm.</div>
      {!scanning ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {rows.some((r) => r.id && parseTime(r.start) != null) && (
            <button onClick={() => start("ids")} style={{ ...ui.cta, gridColumn: "1 / -1", padding: "12px 8px", fontSize: 14 }}>🎯 Scan IDs only ({rows.filter((r) => r.id && parseTime(r.start) != null).length})</button>
          )}
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
            <button onClick={() => set(i, r.id && r.scan && !r.title ? { id: false, title: r.scan.title, artist: r.scan.artist, scan: undefined } : { id: !r.id })} style={{ ...ui.pillSmall, color: r.id ? C.gold : C.text3, borderColor: r.id ? "rgba(245,207,104,0.4)" : C.glassBorder }}>{r.id ? "ID" : "Known"}</button>
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
