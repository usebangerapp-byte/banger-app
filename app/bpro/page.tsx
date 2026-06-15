"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import { FFmpeg } from "@ffmpeg/ffmpeg";

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
      style={{ padding: "14px 16px", borderRadius: 14, width: "100%", fontWeight: 800,
        background: disabled || busy ? "rgba(255,255,255,0.10)" : "#fff",
        color: disabled || busy ? "#888" : "#000",
        border: "1px solid rgba(255,255,255,0.14)",
        cursor: disabled || busy ? "not-allowed" : "pointer" }}>
      {busy ? (busyLabel || "…") : label}
    </button>
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
        if (role === "public") { router.replace("/home"); return; }
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
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>("unreleased");
  const [releaseDate,   setReleaseDate]   = useState("");
  const [allowPreview,  setAllowPreview]  = useState(true);
  const [agreeRights,   setAgreeRights]   = useState(false);
  const [audioFile,     setAudioFile]     = useState<File | null>(null);
  const [durationSec,   setDurationSec]   = useState<number | null>(null);
  const [audioUrl,      setAudioUrl]      = useState("");

  const [busy,       setBusy]       = useState(false);
  const [step,       setStep]       = useState("");
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);
  const [segCount,   setSegCount]   = useState(0);
  const [segCurrent, setSegCurrent] = useState(0);

  const canSubmit = artist.trim() && trackTitle.trim() && agreeRights && audioFile && !busy;

  function onPickAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file); setError(""); setDone(false); setStep("");
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => setDurationSec(Math.round(audio.duration));
  }

  function onDropFile(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    onPickAudio({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
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
    setBusy(true); setError(""); setDone(false);
    try {
      const total = durationSec ?? 0;
      setStep("Cutting track into segments…");
      const segments = total > SEGMENT_DURATION ? await buildSegments(audioFile, total) : [audioFile];

      setStep(`Uploading ${segments.length} segment(s)…`);
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

      const uploadRes  = await fetch("/api/bpro/upload", { method: "POST", body: fd });
      const uploadJson = (await uploadRes.json().catch(() => null)) as UploadResult | null;
      if (!uploadRes.ok || !uploadJson?.ok) throw new Error(uploadJson?.error || "Upload failed.");

      for (let i = 0; i < segments.length; i++) {
        setStep(`Registering with ACR (${i + 1}/${segments.length})…`);
        const acrFd = new FormData();
        acrFd.append("file", segments[i]);
        acrFd.append("title", trackTitle.trim());
        acrFd.append("artist", artist.trim());
        const acrRes  = await fetch("/api/bpro/acr-upload", { method: "POST", body: acrFd });
        const acrJson = (await acrRes.json().catch(() => null)) as UploadResult | null;
        if (!acrRes.ok || !acrJson?.ok) throw new Error(acrJson?.error || `ACR failed (seg ${i + 1}).`);
      }
      setDone(true); setStep("");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally { setBusy(false); }
  }

  if (!roleReady) return <main style={{ minHeight: "100vh", background: "#000" }} />;

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "24px 18px 120px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 14 }}>

        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em" }}>UPLOAD</h1>

        <Card title="1. Track">
          <div style={{ display: "grid", gap: 10 }}>
            <input value={artist} onChange={(e) => setArtist(e.target.value)}
              placeholder="Your artist name" style={inputStyle} />
            <input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="Track title" style={inputStyle} />
          </div>
        </Card>

        <Card title="2. Audio">
          <input ref={audioInputRef} type="file"
            accept=".mp3,.wav,.aiff,.aif,.flac,.m4a,.aac,.ogg,.opus,.mp4,.mov,video/*,audio/*"
            onChange={onPickAudio} style={{ display: "none" }} />
          {!audioFile ? (
            <div onClick={() => audioInputRef.current?.click()} onDrop={onDropFile}
              onDragOver={(e) => e.preventDefault()}
              style={{ border: "1px dashed rgba(255,255,255,0.18)", borderRadius: 16,
                padding: "28px 16px", textAlign: "center", cursor: "pointer",
                background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Drop audio / video here</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.65 }}>or tap to choose a file</div>
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

        <Card title="3. Release Status">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(["unreleased", "released"] as ReleaseStatus[]).map((s) => (
              <button key={s} type="button" onClick={() => setReleaseStatus(s)}
                style={{ padding: "14px 12px", borderRadius: 14, fontWeight: 700, color: "#fff", cursor: "pointer",
                  border: releaseStatus === s ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.12)",
                  background: releaseStatus === s ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)" }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={{ fontSize: 13, opacity: 0.75 }}>
              Release date (optional)
              <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)}
                style={{ ...inputStyle, marginTop: 6 }} />
            </label>
            <label style={checkRow}>
              <input type="checkbox" checked={allowPreview} onChange={(e) => setAllowPreview(e.target.checked)} />
              <span>Allow 10-second public preview</span>
            </label>
          </div>
        </Card>

        <Card title="4. Rights & Submit">
          <div style={{ display: "grid", gap: 14 }}>
            <label style={checkRow}>
              <input type="checkbox" checked={agreeRights} onChange={(e) => setAgreeRights(e.target.checked)} />
              <span>I own the rights or have permission to analyze this audio.</span>
            </label>
            <PrimaryBtn disabled={!canSubmit} busy={busy} label="Submit for Scan"
              busyLabel={segCount > 0 ? `${step} (${segCurrent}/${segCount})` : step || "Working…"}
              onClick={submit} />
            {step && !error && <div style={infoBox}>{step}</div>}
            {error && <div style={errorBox}>{error}</div>}
            {done && (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={successBox}>
                  ✓ Track submitted — {Math.min(MAX_SEGMENTS, segCount || 1)} segment(s) registered with ACR.
                  Your track is now scannable.
                </div>
                <button type="button" onClick={() => router.push("/home")} style={ghostBtn}>Go Scan</button>
              </div>
            )}
          </div>
        </Card>

      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 16, background: "rgba(255,255,255,0.03)", display: "grid", gap: 12 };
const cardTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", opacity: 0.65 };
const inputStyle: React.CSSProperties = { padding: 12, borderRadius: 12, width: "100%", border: "1px solid rgba(255,255,255,0.14)", background: "#0d0d0d", color: "#fff", fontSize: 15 };
const summaryBox: React.CSSProperties = { borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: 12 };
const infoBox: React.CSSProperties = { borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", padding: 12, fontSize: 13 };
const errorBox: React.CSSProperties = { borderRadius: 14, background: "rgba(255,80,80,0.10)", border: "1px solid rgba(255,80,80,0.25)", padding: 12, fontSize: 13, color: "#ffb5b5" };
const successBox: React.CSSProperties = { borderRadius: 14, background: "rgba(120,255,160,0.08)", border: "1px solid rgba(120,255,160,0.20)", padding: 12, fontSize: 13, color: "#d9ffe2" };
const ghostBtn: React.CSSProperties = { padding: "12px 16px", borderRadius: 14, width: "100%", fontWeight: 600, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "#fff", cursor: "pointer" };
const checkRow: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.4 };
