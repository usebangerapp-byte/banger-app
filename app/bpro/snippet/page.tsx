"use client";

import { useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export default function SnippetPage() {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [snippetUrl, setSnippetUrl] = useState<string>("");
  const [startSec, setStartSec] = useState(0);
  const [durationSec, setDurationSec] = useState(60);
  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const maxDuration = 60;

  const summary = useMemo(() => {
    const endSec = startSec + durationSec;
    return {
      startSec,
      endSec,
      durationSec,
      fileName: file?.name ?? "",
      fileSizeMb: file ? (file.size / 1024 / 1024).toFixed(1) : "",
      format: file?.type || "audio",
    };
  }, [file, startSec, durationSec]);

  async function ensureFFmpeg() {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      await ffmpeg.load();
    }
    return ffmpeg;
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;

    setError("");
    setSnippetUrl("");
    setIsReady(false);
    setFile(picked);

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const nextUrl = URL.createObjectURL(picked);
    setSourceUrl(nextUrl);

    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    if (waveformRef.current) {
      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#7a7a7a",
        progressColor: "#e8e8e8",
        cursorColor: "#ffffff",
        height: 96,
        barWidth: 2,
        barGap: 1,
      });
      waveSurferRef.current = ws;
      await ws.loadBlob(picked);

      ws.on("ready", () => {
        const total = ws.getDuration();
        if (Number.isFinite(total) && total > 0) {
          const safeDuration = Math.min(maxDuration, Math.floor(total));
          setStartSec(0);
          setDurationSec(safeDuration || maxDuration);
        }
      });
    }
  }

  function confirmSnippet() {
    setIsReady(true);
    setError("");
  }

  async function generateSnippet() {
    if (!file) return;

    try {
      setIsGenerating(true);
      setError("");

      const ffmpeg = await ensureFFmpeg();

      await ffmpeg.writeFile("input", await fetchFile(file));
      await ffmpeg.exec([
        "-i", "input",
        "-ss", String(startSec),
        "-t", String(durationSec),
        "-vn",
        "-acodec", "libmp3lame",
        "-b:a", "192k",
        "snippet.mp3",
      ]);

      const data = await ffmpeg.readFile("snippet.mp3");
      if (typeof data === "string") {
        throw new Error("Invalid ffmpeg output");
      }
      const safeBytes = new Uint8Array(data.length);
      safeBytes.set(data);
      const blob = new Blob([safeBytes.buffer], { type: "audio/mpeg" });

      if (snippetUrl) URL.revokeObjectURL(snippetUrl);
      const url = URL.createObjectURL(blob);
      setSnippetUrl(url);
    } catch (err) {
      console.error(err);
      setError("Impossible de générer le snippet pour le moment.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 18, fontSize: 12, opacity: 0.7 }}>BPRO / DJ · Label</div>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Créer ton snippet</h1>
        <p style={{ opacity: 0.72, marginBottom: 24 }}>
          Importe un fichier audio lourd, choisis un extrait de 60 secondes max, puis convertis-le en MP3.
        </p>

        <div style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          padding: 18,
          background: "rgba(255,255,255,0.03)"
        }}>
          <input type="file" accept="audio/*" onChange={onPickFile} />

          {file && (
            <>
              <div style={{ marginTop: 20, fontSize: 13, opacity: 0.8 }}>
                Fichier: {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>

              <div
                ref={waveformRef}
                style={{ marginTop: 18, borderRadius: 12, overflow: "hidden", background: "#111", padding: 12 }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Début (sec)</span>
                  <input
                    type="number"
                    min={0}
                    value={startSec}
                    onChange={(e) => setStartSec(Math.max(0, Number(e.target.value) || 0))}
                    style={{ padding: 12, borderRadius: 10, border: "1px solid #333", background: "#0d0d0d", color: "#fff" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span>Durée (max 60 sec)</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={durationSec}
                    onChange={(e) => {
                      const n = Number(e.target.value) || 1;
                      setDurationSec(Math.min(maxDuration, Math.max(1, n)));
                    }}
                    style={{ padding: 12, borderRadius: 10, border: "1px solid #333", background: "#0d0d0d", color: "#fff" }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>
                Start: {summary.startSec}s · End: {summary.endSec}s · Durée: {summary.durationSec}s
              </div>

              {sourceUrl && (
                <div style={{ marginTop: 16 }}>
                  <audio controls src={sourceUrl} style={{ width: "100%" }} />
                </div>
              )}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                <button
                  onClick={confirmSnippet}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #444", background: "#fff", color: "#000" }}
                >
                  Confirmer
                </button>
              </div>
            </>
          )}
        </div>

        {isReady && (
          <div style={{
            marginTop: 22,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            padding: 18,
            background: "rgba(255,255,255,0.03)"
          }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Snippet prêt, passons à l’analyse</div>
            <div style={{ opacity: 0.78, fontSize: 14 }}>
              {summary.fileName} · {summary.format} · {summary.fileSizeMb} MB
            </div>
            <div style={{ opacity: 0.78, fontSize: 14, marginTop: 6 }}>
              Début: {summary.startSec}s · Fin: {summary.endSec}s · Durée: {summary.durationSec}s
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                onClick={generateSnippet}
                disabled={isGenerating}
                style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #444", background: "#fff", color: "#000" }}
              >
                {isGenerating ? "Génération..." : "Analyser le snippet"}
              </button>
            </div>

            {snippetUrl && (
              <div style={{ marginTop: 18 }}>
                <div style={{ marginBottom: 8, fontSize: 14, opacity: 0.85 }}>
                  Snippet MP3 généré. Prêt pour la phase scan.
                </div>
                <audio controls src={snippetUrl} style={{ width: "100%" }} />
              </div>
            )}

            {error && (
              <div style={{ marginTop: 14, color: "#ff8f8f", fontSize: 14 }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
