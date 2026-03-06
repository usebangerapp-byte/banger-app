"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Mode = "DJ" | "LABEL";
type Recent = {
  id: number;
  title: string | null;
  artist: string | null;
  label: string | null;
  created_at: string | null;
};

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function LogoHeader() {
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", paddingTop: 8, paddingBottom: 6 }}>
      <video
        src="/logo-anim-pro.muted.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: 160,
          height: "auto",
          objectFit: "contain",
          mixBlendMode: "screen",
          opacity: 0.95,
          pointerEvents: "none",
          filter: "contrast(1.25) brightness(1.12)",
        }}
      />
    </div>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.72, letterSpacing: "0.10em", fontWeight: 800 }}>{title}</div>
        {right}
      </div>
      <div style={{ height: 10 }} />
      {children}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 13, opacity: 0.9 }}>{label}</span>
      <span
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.18)",
          background: value ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.10)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "rgba(255,255,255,0.92)",
            transition: "left 160ms ease",
          }}
        />
      </span>
    </button>
  );
}

export default function BproPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState("");

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [agreeRights, setAgreeRights] = useState(false);
  const [deleteAfter, setDeleteAfter] = useState(true);

  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(0);

  const [recent, setRecent] = useState<Recent[]>([]);
  const [recentLimit, setRecentLimit] = useState(3);

  const identityOk = useMemo(() => !!mode && name.trim().length > 0, [mode, name]);
  const canPick = useMemo(() => identityOk && !busy, [identityOk, busy]);
  const canAnalyze = useMemo(() => identityOk && !!pickedFile && agreeRights && !busy, [identityOk, pickedFile, agreeRights, busy]);

  async function refreshRecent() {
    try {
      const r = await fetch("/api/bpro/recent", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (j?.ok) setRecent(j.data || []);
    } catch {}
  }

  useEffect(() => {
    refreshRecent();
  }, []);

  function setStage(label: string, p: number) {
    setStep(label);
    setProgress(p);
  }

  function pickFile() {
    if (!canPick) return;
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setHover(false);
    if (!canPick) return;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setPickedFile(f);
    if (mode && name.trim() && agreeRights) {
      void analyze(f);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      e.target.value = "";
      return;
    }
    setPickedFile(f);
    if (mode && name.trim() && agreeRights) {
      void analyze(f);
    }
    e.target.value = "";
  }

  async function analyze(file: File) {
    if (!mode || !name.trim()) return;
    if (!agreeRights) return;

    setBusy(true);
    setProgress(2);
    setStage("Sealing session…", 6);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      fd.append("name", name.trim());
      fd.append("delete_after", deleteAfter ? "1" : "0");

      setStage("Uploading sample…", 22);

      const r = await fetch("/api/bpro/upload", { method: "POST", body: fd });

      setStage("Spectral fingerprinting in progress…", 58);

      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setStage("Analysis blocked. Retry.", 0);
        setBusy(false);
        return;
      }

      setStage("Finalizing imprint…", 86);

      setTimeout(async () => {
        setStage("Ready.", 100);
        setBusy(false);
        setPickedFile(null);
        await refreshRecent();
      }, 900);
    } catch {
      setStage("Network error. Retry.", 0);
      setBusy(false);
    }
  }

  const showRecent = recent.slice(0, recentLimit);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: 18,
        gap: 12,
      }}
    >
      <LogoHeader />

      {/* ROW 1: Identity | Submit */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card title="IDENTITY">
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode("DJ")}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.16)",
                background: mode === "DJ" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 900,
                letterSpacing: "0.08em",
                fontSize: 12,
              }}
            >
              DJ
            </button>
            <button
              type="button"
              onClick={() => setMode("LABEL")}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.16)",
                background: mode === "LABEL" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 900,
                letterSpacing: "0.08em",
                fontSize: 12,
              }}
            >
              LABEL
            </button>
          </div>

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            {mode ? `${mode} name` : "Choose DJ or LABEL first"}
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "LABEL" ? "Label name" : "DJ name"}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              outline: "none",
              fontSize: 13,
            }}
          />

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Fingerprint is generated from your original file — filename is kept as-is.
          </div>
        </Card>

        <Card
          title="SUBMIT SAMPLE"
          right={
            <button
              type="button"
              disabled={!canPick}
              onClick={pickFile}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                background: canPick ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                color: "#fff",
                cursor: canPick ? "pointer" : "not-allowed",
                fontSize: 12,
              }}
            >
              Choose
            </button>
          }
        >
          <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
            Submit an audio sample to generate a private audio fingerprint.
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (canPick) setHover(true);
            }}
            onDragLeave={() => setHover(false)}
            onDrop={onDrop}
            onClick={pickFile}
            style={{
              borderRadius: 16,
              border: "1px dashed rgba(255,255,255,0.20)",
              background: hover ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              padding: 16,
              cursor: canPick ? "pointer" : "not-allowed",
              opacity: canPick ? 1 : 0.55,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.92 }}>
              {canPick ? "Drag & drop audio here" : "Set DJ/LABEL + name to unlock"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              mp3 / wav / m4a — short excerpt recommended
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
              {pickedFile ? `Loaded: ${pickedFile.name}` : "No file loaded."}
            </div>
          </div>

          <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac" onChange={onPick} style={{ display: "none" }} />
        </Card>
      </div>

      {/* ROW 2: Status + Analyze (full width) */}
      <Card title="STATUS + ANALYZE">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: busy ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)",
              boxShadow: busy ? "0 0 14px rgba(255,255,255,0.55)" : "none",
              animation: busy ? "pulse 900ms ease-in-out infinite" : "none",
            }}
          />
          <div style={{ fontSize: 13, opacity: 0.95 }}>
            {busy ? step || "Working…" : "Ready"}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
            {busy ? "Spectral fingerprinting in progress…" : "Spectral fingerprinting in progress…"}
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              height: "100%",
              background: "rgba(255,255,255,0.55)",
              transition: "width 200ms ease",
            }}
          />
        </div>

        <div style={{ height: 12 }} />

        <button
          type="button"
          disabled={!canAnalyze}
          onClick={() => pickedFile && analyze(pickedFile)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.18)",
            background: canAnalyze ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
            color: "#fff",
            cursor: canAnalyze ? "pointer" : "not-allowed",
            fontWeight: 900,
            letterSpacing: "0.16em",
            fontSize: 13,
            alignSelf: "flex-start",
          }}
        >
          ANALYZE
        </button>

        <div style={{ height: 12 }} />

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={agreeRights}
            onChange={(e) => setAgreeRights(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <div>
            <div style={{ fontSize: 13, opacity: 0.92 }}>
              I confirm I own or control the rights to this audio file.
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
              Required to run analysis.
            </div>
          </div>
        </label>

        <div style={{ height: 10 }} />

        <Toggle value={deleteAfter} onChange={setDeleteAfter} label="Delete after analyze" />
      </Card>

      {/* ROW 3: Recent */}
      <Card
        title="RECENT"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={refreshRecent}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Refresh
            </button>
            {recent.length > recentLimit ? (
              <button
                type="button"
                onClick={() => setRecentLimit((v) => Math.min(recent.length, v + 3))}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Show more
              </button>
            ) : null}
          </div>
        }
      >
        {showRecent.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12 }}>No recent samples yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {showRecent.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{t.title || "Untitled"}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {(t.label || "unknown") + " • " + (t.artist || "unknown")}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{timeAgo(t.created_at)}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      opacity: 0.9,
                      border: "1px solid rgba(255,255,255,0.12)",
                      padding: "6px 8px",
                      borderRadius: 999,
                      display: "inline-block",
                    }}
                  >
                    secured
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: .65; }
          50% { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: .65; }
        }
      `}</style>
    </div>
  );
}
