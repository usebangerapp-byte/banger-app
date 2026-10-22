"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import PageHeader from "@/components/PageHeader";
import { guessTrackName } from "@/lib/trackName";
import { authFetch } from "@/lib/authFetch";
import BulkUpload from "@/components/BulkUpload";
import { ui, C, glass } from "@/lib/ui";

const SEGMENT_DURATION = 25;
const MAX_SEGMENTS     = 20;

type ReleaseStatus = "unreleased" | "released";
type UploadResult  = { ok?: boolean; acr_id?: string | null; error?: string };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={cardStyle}>
      <div style={cardTitleStyle}>{title}</div>
      {children}
    </section>
  );
}

function PrimaryBtn({ disabled, busy, label, busyLabel, onClick }:
  { disabled?: boolean; busy?: boolean; label: string; busyLabel?: string; onClick?: () => void }) {
  return (
    <button type="button" disabled={disabled || busy} onClick={onClick}
      style={disabled || busy
        ? { ...ui.cta, background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.45)", boxShadow: "none", cursor: "not-allowed" }
        : ui.cta}>
      {busy ? (busyLabel || "…") : label}
    </button>
  );
}

const PHRASES: Record<"cut" | "send" | "print", string[]> = {
  cut:   ["Listening to every bar…", "Slicing the waveform…", "Reading the low end…", "Finding the drop…"],
  send:  ["Sending the signal…", "Sealing it in the vault…"],
  print: ["Fingerprinting the drop…", "Teaching BANGER your sound…", "Mapping every frequency…", "Locking the ID…", "Almost there…"],
};

function ForgeView({ progress, phase, tick }: { progress: number; phase: "cut" | "send" | "print"; tick: number }) {
  const list = PHRASES[phase];
  const phrase = list[tick % list.length];
  const pct = Math.round(progress * 100);
  const R = 74, CIRC = 2 * Math.PI * R;
  return (
    <section style={{ ...cardStyle, justifyItems: "center", textAlign: "center", padding: "34px 20px 28px", gap: 18 }}>
      <style>{`
        @keyframes forgeSpin { to { transform: rotate(360deg); } }
        @keyframes forgeBreath { 0%,100% { opacity: .35; transform: scale(.94); } 50% { opacity: .8; transform: scale(1.04); } }
        @keyframes forgeFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
      <div style={{ position: "relative", width: 180, height: 180 }}>
        <div aria-hidden style={{ position: "absolute", inset: -10, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,207,104,0.35), rgba(245,207,104,0) 65%)",
          animation: "forgeBreath 2.4s ease-in-out infinite" }} />
        <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="forgeG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0c040" /><stop offset="100%" stopColor="#b87a08" />
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle cx="90" cy="90" r={R} fill="none" stroke="url(#forgeG)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)}
            transform="rotate(-90 90 90)" style={{ transition: "stroke-dashoffset 0.8s ease", filter: "drop-shadow(0 0 6px rgba(245,207,104,0.7))" }} />
        </svg>
        <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true"
          style={{ position: "absolute", inset: 0, animation: "forgeSpin 3.2s linear infinite" }}>
          <circle cx="90" cy="90" r="60" fill="none" stroke="rgba(245,207,104,0.35)" strokeWidth="1" strokeDasharray="2 9" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
          {pct}<span style={{ fontSize: 16, color: C.text3, marginLeft: 2 }}>%</span>
        </div>
      </div>
      <div key={phrase} style={{ fontSize: 17, fontWeight: 600, animation: "forgeFade 0.5s ease-out" }}>{phrase}</div>
      <div style={{ fontSize: 13, color: C.text3 }}>Keep BANGER open while we work.</div>
    </section>
  );
}

export default function UploadPage() {
  const router   = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [uploaderEmail, setUploaderEmail] = useState("");
  const [roleReady,     setRoleReady]     = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setUploaderEmail(data.user?.email || "");
        const role = await getBrowserRole();
        if (!mounted) return;
        if (role === "public") { router.replace("/upgrade"); return; }
        setRoleReady(true);
      } catch { if (mounted) setRoleReady(true); }
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  const audioInputRef   = useRef<HTMLInputElement | null>(null);
  const ffmpegRef       = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);

  const [artist,        setArtist]        = useState("");
  const [trackTitle,    setTrackTitle]    = useState("");
  // "Make scannable" from a set: the name is already known — keep it, whatever the file is called
  const nameFromSet = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("title"), a = q.get("artist");
    if (t) { setTrackTitle(t); setArtist(a || ""); nameFromSet.current = true; }
  }, []);
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>("unreleased");
  const [releaseDate,   setReleaseDate]   = useState("");
  const [allowPreview,  setAllowPreview]  = useState(true);
  const [agreeRights,   setAgreeRights]   = useState(false);
  const [audioFile,     setAudioFile]     = useState<File | null>(null);
  const [durationSec,   setDurationSec]   = useState<number | null>(null);
  const [audioUrl,      setAudioUrl]      = useState("");

  const [busy,       setBusy]       = useState(false);
  const [mode,       setMode]       = useState<"one" | "bulk">("one");
  const [bulkFiles,  setBulkFiles]  = useState<File[]>([]);
  const [step,       setStep]       = useState("");
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);
  const [segCount,   setSegCount]   = useState(0);
  const [segCurrent, setSegCurrent] = useState(0);
  const [progress,   setProgress]   = useState(0);   // 0 → 1, drives the ring
  const [phase,      setPhase]      = useState<"cut" | "send" | "print">("cut");
  const [tick,       setTick]       = useState(0);   // rotates the phrases

  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setTick((v) => v + 1), 2600);
    return () => window.clearInterval(t);
  }, [busy]);

  const canSubmit = artist.trim() && trackTitle.trim() && agreeRights && audioFile && !busy;

  function parseFilename(filename: string) {
    // Remove extension
    const base = filename.replace(/\.[^.]+$/, "").trim();
    // Try "Artist - Title" pattern
    const sep = base.indexOf(" - ");
    if (sep > 0) {
      return { artist: base.slice(0, sep).trim(), title: base.slice(sep + 3).trim() };
    }
    // Try "Artist_-_Title" or "Artist-Title" (hyphen without spaces)
    const dashSep = base.match(/^(.+?)[-_][-_](.+)$/);
    if (dashSep) {
      return { artist: dashSep[1].replace(/[_]/g, " ").trim(), title: dashSep[2].replace(/[_]/g, " ").trim() };
    }
    // Fallback: put everything in title
    return { artist: "", title: base.replace(/[_]/g, " ").trim() };
  }

  function onPickAudio(e: React.ChangeEvent<HTMLInputElement>) {
    // Several files picked → switch to the multi-track list automatically
    if (e.target.files && e.target.files.length > 1) {
      setBulkFiles(Array.from(e.target.files)); setMode("bulk");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file); setError(""); setDone(false); setStep("");
    // Fill artist & title from the file's tags / name (remix credits stay in the title)
    if (!nameFromSet.current) guessTrackName(file).then((g) => {
      if (g.artist) setArtist(g.artist);
      if (g.title) setTrackTitle(g.title);
    }).catch(() => {});
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => setDurationSec(Math.round(audio.duration));
  }

  function onDropFile(e: React.DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    onPickAudio({ target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>);
  }

  async function loadFFmpeg() {
    if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();
    if (!ffmpegLoadedRef.current) { await ffmpegRef.current.load(); ffmpegLoadedRef.current = true; }
    return ffmpegRef.current;
  }

  async function buildSegments(file: File, totalSec: number): Promise<File[]> {
    const ffmpeg = await loadFFmpeg();
    const ext    = file.name.split(".").pop() || "mp3";
    const inName = `input.${ext}`;
    await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));

    const interval = Math.max(SEGMENT_DURATION, Math.floor(totalSec / MAX_SEGMENTS));
    const starts: number[] = [];
    for (let t = 0; t + SEGMENT_DURATION <= totalSec; t += interval) {
      starts.push(t);
      if (starts.length >= MAX_SEGMENTS) break;
    }

    setSegCount(starts.length);
    const segments: File[] = [];
    const base = (trackTitle.trim() || "track").replace(/[^a-zA-Z0-9_-]/g, "-");

    for (let i = 0; i < starts.length; i++) {
      setSegCurrent(i + 1);
      setProgress(0.04 + 0.34 * ((i + 1) / starts.length));
      const outName = `seg_${i}.mp3`;
      await ffmpeg.exec(["-ss", String(starts[i]), "-t", String(SEGMENT_DURATION),
        "-i", inName, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", outName]);
      const data = await ffmpeg.readFile(outName);
      const buf  = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      segments.push(new File([buf.buffer as ArrayBuffer], `${base}-seg${i + 1}.mp3`, { type: "audio/mpeg" }));
      try { await ffmpeg.deleteFile(outName); } catch {}
    }
    try { await ffmpeg.deleteFile(inName); } catch {}
    return segments;
  }

  async function submit() {
    if (!canSubmit || !audioFile) return;
    setBusy(true); setError(""); setDone(false); setProgress(0.02); setPhase("cut"); setTick(0);
    try {
      // Stop right away if this song is already on BANGER (no cutting, no upload).
      const ex = await authFetch("/api/bpro/exists", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ title: trackTitle.trim(), artist: artist.trim() }] }) }).then((r) => r.json()).catch(() => null);
      if (ex?.exists?.[0]) throw new Error("This track already exists on BANGER — it's already scannable.");
      const total = durationSec ?? 0;
      setStep("Cutting track into segments…");
      const segments = total > SEGMENT_DURATION ? await buildSegments(audioFile, total) : [audioFile];

      setStep(`Uploading ${segments.length} segment(s)…`);
      setPhase("send"); setProgress(0.42);
      const fd = new FormData();
      const previewIdx = segments.length >= 6 ? 5 : segments.length >= 3 ? Math.floor(segments.length / 2) : 0;
      fd.append("file_0", segments[previewIdx]);
      fd.append("file",   segments[previewIdx]);
      fd.append("title",          trackTitle.trim());
      fd.append("artist",         artist.trim());
      fd.append("name",           artist.trim());
      fd.append("uploader_email", uploaderEmail);
      fd.append("release_status", releaseStatus);
      fd.append("is_released",    releaseStatus === "released" ? "true" : "false");
      fd.append("release_date",   releaseDate || "");
      fd.append("allow_preview",  allowPreview ? "true" : "false");
      fd.append("has_rights",     "1");
      fd.append("delete_after",   "1");

      const uploadRes  = await authFetch("/api/bpro/upload", { method: "POST", body: fd });
      const uploadJson = (await uploadRes.json().catch(() => null)) as UploadResult | null;
      if (!uploadRes.ok || !uploadJson?.ok) throw new Error(uploadJson?.error || "Upload failed.");

      setPhase("print"); setProgress(0.48);
      for (let i = 0; i < segments.length; i++) {
        setStep(`Registering with ACR (${i + 1}/${segments.length})…`);
        const acrFd = new FormData();
        acrFd.append("file", segments[i]);
        acrFd.append("title", trackTitle.trim());
        acrFd.append("artist", artist.trim());
        const acrRes  = await authFetch("/api/bpro/acr-upload", { method: "POST", body: acrFd });
        const acrJson = (await acrRes.json().catch(() => null)) as UploadResult | null;
        if (!acrRes.ok || !acrJson?.ok) throw new Error(acrJson?.error || `ACR failed (seg ${i + 1}).`);
        setProgress(0.48 + 0.52 * ((i + 1) / segments.length));
      }
      setProgress(1);
      // Forget the uploaded track — the page only offers "Go Scan" now.
      setArtist(""); setTrackTitle(""); setAudioFile(null); setAudioUrl(""); setDurationSec(null);
      setReleaseDate(""); setAgreeRights(false); setSegCount(0); setSegCurrent(0);
      setDone(true); setStep("");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally { setBusy(false); }
  }

  if (!roleReady) return <main style={{ minHeight: "100vh" }} />;

  return (
    <main style={ui.page}>
      <div style={ui.shell}>

        <PageHeader title="Upload" sub="Register your track for scanning." />

        {busy && <ForgeView progress={progress} phase={phase} tick={tick} />}

        {done && !busy && (
          <section style={{ ...cardStyle, justifyItems: "center", textAlign: "center", padding: "34px 22px", gap: 10 }}>
            <div style={doneBadge}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.goldInk} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 8 }}>Your ID is live.</div>
            <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.5 }}>Every BANGER scan can now recognise it.</div>
            <button type="button" onClick={() => router.push("/home")} style={{ ...ui.cta, marginTop: 14 }}>Go Scan</button>
            <button type="button" onClick={() => router.push("/promo")} style={{ ...ui.pill, width: "100%", padding: "13px 16px", fontSize: 15, color: C.gold, borderColor: "rgba(245,207,104,0.30)", background: "rgba(245,207,104,0.08)" }}>
              Send it to the BANGER team
            </button>
          </section>
        )}

        {!busy && !done && (
          <div style={{ ...glass, display: "grid", gridTemplateColumns: "1fr 1fr", padding: 4, borderRadius: 999 }}>
            {(["one", "bulk"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: "9px 0", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                  background: mode === m ? "rgba(255,255,255,0.16)" : "transparent", color: mode === m ? "#fff" : C.text3, fontWeight: mode === m ? 600 : 500 }}>
                {m === "one" ? "One track" : "Several tracks"}
              </button>
            ))}
          </div>
        )}

        {!busy && !done && mode === "bulk" && <BulkUpload initialFiles={bulkFiles} />}

        {!busy && !done && mode === "one" && (<>

        <Card title="Track">
          <div style={{ display: "grid", gap: 10 }}>
            <input value={artist} onChange={(e) => setArtist(e.target.value)}
              placeholder="Your artist name" style={inputStyle} />
            <input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="Track title" style={inputStyle} />
          </div>
        </Card>

        <Card title="Audio">
          <input ref={audioInputRef} type="file"
            multiple
            accept=".mp3,.wav,.aiff,.aif,.flac,.m4a,.aac,.ogg,.opus,.mp4,.mov,video/*,audio/*"
            onChange={onPickAudio} style={{ display: "none" }} />
          {!audioFile ? (
            <div onClick={() => audioInputRef.current?.click()} onDrop={onDropFile}
              onDragOver={(e) => e.preventDefault()}
              style={{ border: "1px dashed rgba(245,207,104,0.40)", borderRadius: 18,
                padding: "28px 16px", textAlign: "center", cursor: "pointer",
                background: "rgba(245,207,104,0.06)" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Drop audio or video here</div>
              <div style={{ marginTop: 4, fontSize: 13, color: C.text3 }}>or tap to choose a file</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={summaryBox}>
                <div style={{ fontWeight: 700 }}>{audioFile.name}</div>
                <div style={{ fontSize: 13, opacity: 0.65 }}>
                  {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                  {durationSec ? ` · ${Math.floor(durationSec / 60)}m${durationSec % 60}s` : ""}
                  {durationSec && durationSec > SEGMENT_DURATION
                    ? ` · ~${Math.min(MAX_SEGMENTS, Math.ceil(durationSec / SEGMENT_DURATION))} segments`
                    : " · 1 segment"}
                </div>
              </div>
              {audioUrl && <audio controls src={audioUrl} style={{ width: "100%" }} />}
              <button type="button" style={ghostBtn}
                onClick={() => { setAudioFile(null); setAudioUrl(""); setDurationSec(null); }}>
                Change file
              </button>
            </div>
          )}
        </Card>

        <Card title="Release status">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(["unreleased", "released"] as ReleaseStatus[]).map((s) => (
              <button key={s} type="button" onClick={() => setReleaseStatus(s)}
                style={{ padding: "12px", borderRadius: 999, fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
                  color: releaseStatus === s ? C.goldInk : "#fff",
                  border: releaseStatus === s ? "1px solid transparent" : `1px solid ${C.glassBorder}`,
                  background: releaseStatus === s ? C.goldGrad : "rgba(255,255,255,0.06)" }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={{ fontSize: 13, color: C.text3 }}>
              Release date (optional)
              <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)}
                style={{ ...inputStyle, marginTop: 6 }} />
            </label>
            <label style={checkRow}>
              <input type="checkbox" style={{ accentColor: "#e9b844", width: 18, height: 18, flexShrink: 0 }} checked={allowPreview} onChange={(e) => setAllowPreview(e.target.checked)} />
              <span>Allow 10-second public preview</span>
            </label>
          </div>
        </Card>

        <Card title="Rights & submit">
          <div style={{ display: "grid", gap: 14 }}>
            <label style={checkRow}>
              <input type="checkbox" style={{ accentColor: "#e9b844", width: 18, height: 18, flexShrink: 0 }} checked={agreeRights} onChange={(e) => setAgreeRights(e.target.checked)} />
              <span>I own the rights or have permission to analyze this audio.</span>
            </label>
            <PrimaryBtn disabled={!canSubmit} busy={busy} label="Submit for Scan" onClick={submit} />
            {error && <div style={errorBox}>{error}</div>}
          </div>
        </Card>
        </>)}

      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = { ...glass, borderRadius: 22, padding: 18, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, minWidth: 0 };
const doneBadge: React.CSSProperties = {
  width: 64, height: 64, borderRadius: "50%", background: C.goldGrad, display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 0 30px rgba(245,207,104,0.55)",
};
const cardTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: C.text3 };
const inputStyle: React.CSSProperties = { ...ui.input, minWidth: 0, maxWidth: "100%", minHeight: 46, WebkitAppearance: "none", appearance: "none" };
const summaryBox: React.CSSProperties = { borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", padding: 12 };
const infoBox: React.CSSProperties = { borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", padding: 12, fontSize: 13 };
const errorBox: React.CSSProperties = { borderRadius: 14, background: "rgba(255,80,80,0.10)", border: "1px solid rgba(255,80,80,0.25)", padding: 12, fontSize: 13, color: "#ffb5b5" };
const successBox: React.CSSProperties = { borderRadius: 14, background: "rgba(120,255,160,0.08)", border: "1px solid rgba(120,255,160,0.20)", padding: 12, fontSize: 13, color: "#d9ffe2" };
const ghostBtn: React.CSSProperties = { ...ui.pill, width: "100%", padding: "13px 16px", fontSize: 15 };
const checkRow: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.4 };
