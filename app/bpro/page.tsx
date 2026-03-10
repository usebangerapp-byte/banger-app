"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import WaveSurfer from "wavesurfer.js";
import { FFmpeg } from "@ffmpeg/ffmpeg";

type Mode = "DJ" | "LABEL";
type ReleaseStatus = "released" | "unreleased";
type Flow = "idle" | "preview" | "done";

type UploadResult = {
  ok?: boolean;
  acr_id?: string | null;
  fingerprint_status?: string | null;
  snippet_path?: string | null;
  artwork_path?: string | null;
  error?: string;
};

export default function BproPage() {
  const [uploaderEmail, setUploaderEmail] = useState("");
  const supabase = createSupabaseBrowser();
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const artworkInputRef = useRef<HTMLInputElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [info, setInfo] = useState("");

  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>("unreleased");
  const forceUnreleasedForUnlock = false;
  const [releaseDate, setReleaseDate] = useState("");
  const [allowPublicPreview, setAllowPublicPreview] = useState(true);
  const [agreeRights, setAgreeRights] = useState(false);

  const [artwork, setArtwork] = useState<File | null>(null);
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState("/B-logo.png");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [durationSec, setDurationSec] = useState<number | null>(null);

  const [previewStart, setPreviewStart] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(60);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<Flow>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  const identityOk = useMemo(() => !!mode && name.trim().length > 0, [mode, name]);
  const trackOk = useMemo(() => trackTitle.trim().length > 0, [trackTitle]);
  const canPickAudio = identityOk && trackOk && agreeRights && !busy;

  const isShort = durationSec !== null && durationSec <= 60;
  const isLong = durationSec !== null && durationSec > 60;

  const maxPreviewDuration = useMemo(() => {
    if (!durationSec) return 60;
    return Math.min(60, durationSec);
  }, [durationSec]);

  const previewEnd = previewStart + previewDuration;
  const maxPreviewStart = useMemo(() => {
    if (!durationSec) return 0;
    return Math.max(0, durationSec - previewDuration);
  }, [durationSec, previewDuration]);

  useEffect(() => {
    setPreviewDuration(maxPreviewDuration);
  }, [maxPreviewDuration]);

  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    if (waveRef.current) {
      waveRef.current.destroy();
      waveRef.current = null;
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#5f5f5f",
      progressColor: "#dcdcdc",
      cursorColor: "#ffffff",
      height: 100,
      barWidth: 2,
      barGap: 1,
    });

    waveRef.current = ws;
    ws.load(audioUrl);

    return () => {
      ws.destroy();
      waveRef.current = null;
    };
  }, [audioUrl]);

  async function detectDuration(file: File) {
    return await new Promise<number>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = url;

      audio.onloadedmetadata = () => {
        const d = Math.floor(audio.duration || 0);
        URL.revokeObjectURL(url);
        resolve(d);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to read audio duration."));
      };
    });
  }

  function resetMessages() {
    setError("");
    setSuccess("");
    setStatus("");
    setResult(null);
  }

  function resetAudio() {
    resetMessages();
    setAudioFile(null);
    setDurationSec(null);
    setPreviewStart(0);
    setPreviewDuration(60);
    setPreviewConfirmed(false);
    setFlow("idle");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  function resetAll() {
    resetAudio();
    setArtwork(null);
    if (artworkInputRef.current) artworkInputRef.current.value = "";
  }

  async function onPickAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    resetMessages();
    setPreviewConfirmed(false);
    setFlow("idle");

    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const nextUrl = URL.createObjectURL(file);
      setAudioUrl(nextUrl);
      setAudioFile(file);

      setStatus("Reading file…");
      const d = await detectDuration(file);
      setDurationSec(d);

      if (d > 60) {
        setFlow("preview");
        setPreviewStart(0);
        setPreviewDuration(Math.min(60, d));
        setStatus("Select a preview segment before continuing.");
      } else {
        setFlow("idle");
        setStatus("This file is ready for the next step.");
      }
    } catch (err: any) {
      setError(err?.message || "Unsupported audio file.");
      setAudioFile(null);
      setDurationSec(null);
      setFlow("idle");
    }

    e.target.value = "";
  }

  function onPickArtwork(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArtwork(file);
    setArtworkPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  }

  function confirmPreviewSegment() {
    setPreviewConfirmed(true);
    setStatus("Preview segment confirmed — ready for analysis.");
    setError("");
    setSuccess("");
  }

  async function buildUploadFile() {
    if (!audioFile) {
      throw new Error("Audio file missing.");
    }

    if (!isLong) {
      return audioFile;
    }

    setStatus("Building preview segment...");

    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }

    const ffmpeg = ffmpegRef.current;

    if (!ffmpegLoadedRef.current) {
      await ffmpeg.load();
      ffmpegLoadedRef.current = true;
    }

    const inputExt = audioFile.name.includes(".")
      ? audioFile.name.split(".").pop()
      : "wav";

    const inputName = `input.${inputExt}`;
    const outputName = "snippet.mp3";

    const inputBytes = new Uint8Array(await audioFile.arrayBuffer());
    await ffmpeg.writeFile(inputName, inputBytes);

    await ffmpeg.exec([
      "-ss",
      String(previewStart),
      "-t",
      String(previewDuration),
      "-i",
      inputName,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-b:a",
      "192k",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);

    if (typeof data === "string") {
      throw new Error("Invalid ffmpeg output");
    }

    const safeBytes = new Uint8Array(data.length);
    safeBytes.set(data);
    const blob = new Blob([safeBytes.buffer], { type: "audio/mpeg" });

    const baseName = (trackTitle.trim() || audioFile.name.replace(/\.[^/.]+$/, ""))
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "snippet";

    try {
      await ffmpeg.deleteFile(inputName);
    } catch {}

    try {
      await ffmpeg.deleteFile(outputName);
    } catch {}

    return new File([blob], `${baseName}.mp3`, { type: "audio/mpeg" });
  }

  function testPreview() {
    if (!audioPreviewRef.current || !audioUrl) return;
    const audio = audioPreviewRef.current;
    audio.pause();
    audio.currentTime = previewStart;
    void audio.play();

    const stopAt = previewEnd;
    const onTimeUpdate = () => {
      if (audio.currentTime >= stopAt) {
        audio.pause();
        audio.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
  }

  async function sendForAnalysis() {
    if (!audioFile || !mode || !name.trim() || !trackTitle.trim() || !agreeRights) return;
    if (isLong && !previewConfirmed) {
      setError("Confirm the preview segment first.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    setResult(null);
    setStatus(isLong ? "Preparing track…" : "Preparing track…");

    try {
      const fd = new FormData();
      
const uploadFile = await buildUploadFile();
fd.append("file", uploadFile);

      fd.append("mode", mode);
      fd.append("name", name.trim());
      fd.append("title", trackTitle.trim());
      fd.append("info", info.trim());
      fd.append("release_status", releaseStatus);
      fd.append("release_date", releaseDate || "");
      fd.append("allow_preview", allowPublicPreview ? "1" : "0");
      fd.append("delete_after", "1");
      fd.append("has_rights", agreeRights ? "1" : "0");
      fd.append("uploader_email", uploaderEmail || "");

      if (artwork) fd.append("artwork", artwork);

      if (isLong) {
        fd.append("snippet_start", String(previewStart));
        fd.append("snippet_duration", String(previewDuration));
      }

      const r = await fetch("/api/bpro/upload", {
        method: "POST",
        body: fd,
      });

      const j = (await r.json().catch(() => null)) as UploadResult | null;

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Unable to complete analysis.");
      }

      setResult(j);
      setFlow("done");
      setStatus("");
      setSuccess(
        j.fingerprint_status === "ready"
          ? "Your track is now ready for scan."
          : "Track prepared successfully."
      );
    } catch (err: any) {
      setError(err?.message || "Unable to complete analysis.");
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { label: "Profile", done: !!mode },
    { label: "Track", done: identityOk && trackOk },
    { label: "Rights", done: agreeRights },
    { label: "Audio", done: !!audioFile },
    { label: "Preview", done: isShort ? !!audioFile : previewConfirmed },
    { label: "Ready", done: flow === "done" },
  ];

  const selectionLeft = durationSec ? `${(previewStart / durationSec) * 100}%` : "0%";
  const selectionWidth = durationSec ? `${(previewDuration / durationSec) * 100}%` : "0%";

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 20 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 220 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: "0.10em" }}>BPRO</div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>DJ / Label Upload</h1>
          <div style={{ opacity: 0.72, fontSize: 14 }}>
            A private space to prepare your tracks before scan.
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <Card title="1. Profile">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <SelectButton active={mode === "DJ"} onClick={() => setMode("DJ")}>DJ</SelectButton>
              <SelectButton active={mode === "LABEL"} onClick={() => setMode("LABEL")}>Label</SelectButton>
            </div>
          </Card>

          <Card title="2. Track Info">
            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Artist / Label name"
                style={inputStyle}
              />
              <input
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                placeholder="Artist name(s) – Track name / Remix name"
                style={inputStyle}
              />
              <textarea
                value={info}
                onChange={(e) => setInfo(e.target.value)}
                placeholder="Additional info (optional)"
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </Card>

          <Card title="3. Release Status">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <SelectButton active={releaseStatus === "unreleased"} onClick={() => setReleaseStatus("unreleased")}>
                Unreleased
              </SelectButton>
              <div style={{ display: "grid", gap: 6 }}>
                <SelectButton active={releaseStatus === "released"} onClick={() => setReleaseStatus("released")}>
                  Released
                </SelectButton>
                
              </div>
            </div>

            <div style={{ height: 12 }} />

            <label style={{ display: "grid", gap: 6 }}>
              <span style={labelStyle}>Release date (optional)</span>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                style={inputStyle}
              />
            </label>

            <div style={{ height: 12 }} />

            <label style={checkboxRow}>
              <input
                type="checkbox"
                checked={allowPublicPreview}
                onChange={(e) => setAllowPublicPreview(e.target.checked)}
              />
              <span>Allow 10-second public preview</span>
            </label>
          </Card>

          <Card title="4. Artwork">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={hintStyle}>
                Artwork is optional — BANGER logo will be used by default.
              </div>

              <div style={{
                width: 120,
                height: 120,
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <img
                  src={artworkPreviewUrl}
                  alt="Artwork preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>

              <input
                ref={artworkInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onPickArtwork}
                style={{ display: "none" }}
              />

              <button
                type="button"
                onClick={() => artworkInputRef.current?.click()}
                style={secondaryButton}
              >
                Add square artwork (1:1)
              </button>

              <button
                type="button"
                onClick={() => {
                  setArtwork(null);
                  setArtworkPreviewUrl("/B-logo.png");
                }}
                style={ghostButton}
              >
                Use BANGER logo
              </button>

              {artwork ? (
                <div style={summaryBox}>
                  <div><strong>Artwork:</strong> {artwork.name}</div>
                  <div><strong>Size:</strong> {(artwork.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
              ) : (
                <div style={summaryBox}>
                  <div><strong>Artwork:</strong> B-logo.png</div>
                  <div>Default BANGER artwork selected</div>
                </div>
              )}
            </div>
          </Card>

          <Card title="5. Rights">
            <label style={checkboxRow}>
              <input
                type="checkbox"
                checked={agreeRights}
                onChange={(e) => setAgreeRights(e.target.checked)}
              />
              <span>I confirm that I own the rights or have permission to analyze this audio file.</span>
            </label>
          </Card>

          <Card title="6. Audio">
            <div style={{ display: "grid", gap: 12 }}>
              <input
                ref={audioInputRef}
                type="file"
                accept=".mp3,.wav,.wave,.aiff,.aif,.flac,.m4a,.aac,.ogg,.opus,audio/*"
                onChange={onPickAudio}
                style={{ display: "none" }}
              />

              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                disabled={!canPickAudio}
                style={primaryButton(!canPickAudio)}
              >
                Choose audio file
              </button>

              {!identityOk && <div style={hintStyle}>Select profile and enter your name first.</div>}
              {identityOk && !trackOk && <div style={hintStyle}>Add the track title to continue.</div>}
              {identityOk && trackOk && !agreeRights && <div style={hintStyle}>Confirm rights before importing audio.</div>}

              {audioFile && (
                <div style={summaryBox}>
                  <div><strong>File:</strong> {audioFile.name}</div>
                  <div><strong>Size:</strong> {(audioFile.size / 1024 / 1024).toFixed(1)} MB</div>
                  <div><strong>Duration:</strong> {durationSec !== null ? `${durationSec}s` : "…"}</div>
                  {audioUrl && <audio ref={audioPreviewRef} controls src={audioUrl} style={{ width: "100%", marginTop: 10 }} />}
                </div>
              )}

              {isShort && <div style={infoBox}>This file is ready for the next step.</div>}
              {isLong && <div style={infoBox}>Select a preview segment before continuing.</div>}
            </div>
          </Card>

          {isLong && (
            <Card title="7. Preview Segment">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.78 }}>
                  Move the selected area to choose the best segment for scan.
                </div>

                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#0f0f0f", padding: 12 }}>
                  <div ref={waveformRef} />
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      bottom: 12,
                      left: selectionLeft,
                      width: selectionWidth,
                      border: "1px solid rgba(255,255,255,0.75)",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.08)",
                      pointerEvents: "none",
                      minWidth: 18,
                    }}
                  />
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={labelStyle}>Move segment</span>
                  <input
                    type="range"
                    min={0}
                    max={maxPreviewStart}
                    step={1}
                    value={previewStart}
                    onChange={(e) => {
                      setPreviewStart(Number(e.target.value));
                      setPreviewConfirmed(false);
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={labelStyle}>Segment length</span>
                  <input
                    type="range"
                    min={10}
                    max={Math.min(60, durationSec || 60)}
                    step={1}
                    value={previewDuration}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setPreviewDuration(next);
                      if (durationSec && previewStart + next > durationSec) {
                        setPreviewStart(Math.max(0, durationSec - next));
                      }
                      setPreviewConfirmed(false);
                    }}
                  />
                </label>

                <div style={summaryBox}>
                  <div><strong>Start:</strong> {previewStart}s</div>
                  <div><strong>End:</strong> {previewEnd}s</div>
                  <div><strong>Length:</strong> {previewDuration}s</div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <button type="button" onClick={testPreview} style={secondaryButton}>
                    Test Preview
                  </button>

                  <button type="button" onClick={confirmPreviewSegment} style={secondaryButton}>
                    Confirm Preview Segment
                  </button>

                  <button
                    type="button"
                    disabled={busy || !previewConfirmed}
                    onClick={sendForAnalysis}
                    style={primaryButton(busy || !previewConfirmed)}
                  >
                    {busy ? "Preparing track…" : "Prepare for Scan"}
                  </button>

                  <button type="button" onClick={resetAudio} style={ghostButton}>
                    Change audio file
                  </button>
                </div>
              </div>
            </Card>
          )}

          <Card title={isLong ? "8. Scan Ready" : "7. Scan Ready"}>
            <div style={{ display: "grid", gap: 12 }}>
              {isShort && (
                <button
                  type="button"
                  disabled={busy || !audioFile}
                  onClick={sendForAnalysis}
                  style={primaryButton(busy || !audioFile)}
                >
                  {busy ? "Preparing track…" : "Prepare for Scan"}
                </button>
              )}

              {status && <div style={infoBox}>{status}</div>}
              {error && <div style={errorBox}>{error}</div>}
              {success && <div style={successBox}>{success}</div>}

              {result?.snippet_path && (
                <div style={summaryBox}>
                  <div><strong>Stored file:</strong> {result.snippet_path}</div>
                  <div><strong>Track ID:</strong> {result.acr_id || "—"}</div>
                  <div><strong>Status:</strong> {result.fingerprint_status || "processing"}</div>
                </div>
              )}

              {flow === "done" && (
                <button type="button" onClick={resetAll} style={secondaryButton}>
                  Upload another track
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div style={progressDock}>
        <div style={progressRow}>
          {steps.map((step, i) => (
            <div key={step.label} style={stepItem}>
              <div style={{
                ...stepDot,
                opacity: step.done ? 1 : 0.35,
                boxShadow: step.done ? "0 0 10px rgba(255,255,255,0.14)" : "none",
              }} />
              <div style={{
                fontSize: 11,
                opacity: step.done ? 0.92 : 0.42,
                whiteSpace: "nowrap",
              }}>
                {step.label}
              </div>
              {i < steps.length - 1 && <div style={{ ...stepLine, opacity: steps[i].done ? 0.75 : 0.18 }} />}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 18,
      padding: 16,
      background: "rgba(255,255,255,0.03)",
    }}>
      <div style={{ fontSize: 12, opacity: 0.65, letterSpacing: "0.08em", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function SelectButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        border: active ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
        color: "#fff",
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.82,
};

const checkboxRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 14,
  lineHeight: 1.4,
};

const inputStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0d0d0d",
  color: "#fff",
  width: "100%",
};

const summaryBox: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  padding: 12,
  fontSize: 14,
  display: "grid",
  gap: 6,
};

const infoBox: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  padding: 12,
  fontSize: 14,
};

const errorBox: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(255,80,80,0.10)",
  border: "1px solid rgba(255,80,80,0.25)",
  padding: 12,
  fontSize: 14,
  color: "#ffb5b5",
};

const successBox: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(120,255,160,0.08)",
  border: "1px solid rgba(120,255,160,0.20)",
  padding: 12,
  fontSize: 14,
  color: "#d9ffe2",
};

const hintStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.72,
};

function primaryButton(disabled?: boolean): React.CSSProperties {
  return {
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: disabled ? "rgba(255,255,255,0.10)" : "#fff",
    color: disabled ? "#888" : "#000",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    width: "100%",
  };
}

const secondaryButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontWeight: 700,
  width: "100%",
};

const ghostButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "transparent",
  color: "#fff",
  fontWeight: 600,
  width: "100%",
};

const progressDock: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 72,
  display: "flex",
  justifyContent: "center",
  padding: "0 12px",
  pointerEvents: "none",
};

const progressRow: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(8,8,8,0.92)",
  backdropFilter: "blur(10px)",
  borderRadius: 18,
  padding: "12px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
};

const stepItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: 1,
  minWidth: 0,
};

const stepDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#f2f2f2",
  flexShrink: 0,
};

const stepLine: React.CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.45)",
  flex: 1,
  minWidth: 8,
};
