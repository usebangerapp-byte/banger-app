"use client"; // build-1781643571963714000
import { useRouter } from "next/navigation";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { startAudioMeter } from "@/lib/scan/audioMeter";
import { mapRecognizeResult } from "@/lib/scan/resultState";
import { getRegion } from "@/lib/scan/getRegion";
import { recognizeAudio } from "@/lib/scan/recognizeAudio";



type Status = "idle" | "listening" | "recognizing";
type Tag = "UNRELEASED" | "RELEASED" | "NOT FOUND";

type ScanWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
  _bangerAudio?: HTMLAudioElement;
  _bangerAudioTrackId?: string | null;
};


const CYAN = "#00E5FF";

const PAGE_BG =
  "radial-gradient(900px 700px at 50% 18%, " +
  "rgba(18,18,18,1) 0%, rgba(8,8,8,1) 42%, " +
  "rgba(5,5,5,1) 70%, rgba(2,2,2,1) 100%)";


// Woofer inside the button — arc at the bottom
// Woofer SVG — cone doré, anneau noir, vis métalliques, dome avec B
function WooferSVG({ audioLevel, listening }: { audioLevel: number; listening: boolean }) {
  const pump = 1 + audioLevel * 0.045; // cone pumps with bass
  const glowA = 0.18 + audioLevel * 0.55;
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      pointerEvents: "none", zIndex: 4,
    }}>
      <svg width="190" height="190" viewBox="0 0 190 190" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ transition: "transform 0.06s ease-out", transform: `scale(${pump})` }}>
        <defs>
          {/* Outer ring gradient — dark chrome */}
          <radialGradient id="ringGrad" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#4a4a4a"/>
            <stop offset="40%" stopColor="#1a1a1a"/>
            <stop offset="100%" stopColor="#0a0a0a"/>
          </radialGradient>
          {/* Cone golden gradient */}
          <radialGradient id="coneGrad" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#f5c842"/>
            <stop offset="35%" stopColor="#d4a017"/>
            <stop offset="70%" stopColor="#a07010"/>
            <stop offset="100%" stopColor="#4a3000"/>
          </radialGradient>
          {/* Cone texture overlay */}
          <radialGradient id="coneSheen" cx="38%" cy="32%" r="50%">
            <stop offset="0%" stopColor="rgba(255,220,100,0.55)"/>
            <stop offset="60%" stopColor="rgba(255,180,20,0.08)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
          {/* Inner surround */}
          <radialGradient id="surroundGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a2a2a"/>
            <stop offset="50%" stopColor="#141414"/>
            <stop offset="100%" stopColor="#080808"/>
          </radialGradient>
          {/* Dome gradient */}
          <radialGradient id="domeGrad" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#3a3a3a"/>
            <stop offset="55%" stopColor="#111"/>
            <stop offset="100%" stopColor="#050505"/>
          </radialGradient>
          {/* Glow filter */}
          <filter id="glowF" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Screw gradient */}
          <radialGradient id="screwGrad" cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#888"/>
            <stop offset="100%" stopColor="#222"/>
          </radialGradient>
        </defs>

        {/* ── Glow ring when listening ── */}
        {listening && (
          <circle cx="95" cy="95" r="92" fill="none"
            stroke={`rgba(0,200,220,${glowA})`} strokeWidth="3"
            style={{ filter: "blur(4px)" }}/>
        )}

        {/* ── Outer housing ring ── */}
        <circle cx="95" cy="95" r="90" fill="url(#ringGrad)" stroke="#000" strokeWidth="1"/>
        {/* Outer ring inner shadow */}
        <circle cx="95" cy="95" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
        <circle cx="95" cy="95" r="84" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="3"/>

        {/* ── Cone (golden speaker membrane) ── */}
        <circle cx="95" cy="95" r="78" fill="url(#coneGrad)"/>
        {/* Cone texture lines — radial mesh */}
        {Array.from({length: 24}).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const x1 = 95 + Math.cos(a) * 32;
          const y1 = 95 + Math.sin(a) * 32;
          const x2 = 95 + Math.cos(a) * 76;
          const y2 = 95 + Math.sin(a) * 76;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(0,0,0,0.18)" strokeWidth="0.5"/>;
        })}
        {/* Cone concentric rings */}
        {[42, 52, 62, 72].map(r => (
          <circle key={r} cx="95" cy="95" r={r} fill="none"
            stroke="rgba(0,0,0,0.22)" strokeWidth="0.7"/>
        ))}
        {/* Cone sheen */}
        <circle cx="95" cy="95" r="78" fill="url(#coneSheen)"/>

        {/* ── Inner surround (rubber edge) ── */}
        <circle cx="95" cy="95" r="32" fill="url(#surroundGrad)"
          stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
        <circle cx="95" cy="95" r="28" fill="none"
          stroke="rgba(0,0,0,0.6)" strokeWidth="2"/>

        {/* ── Dome (dust cap) ── */}
        <circle cx="95" cy="95" r="26" fill="url(#domeGrad)"
          stroke="rgba(80,80,80,0.4)" strokeWidth="0.5"/>
        {/* Dome specular */}
        <ellipse cx="88" cy="87" rx="9" ry="6"
          fill="rgba(255,255,255,0.10)" style={{filter:"blur(2px)"}}/>

        {/* ── Screws × 6 ── */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const sx = 95 + Math.cos(a) * 85;
          const sy = 95 + Math.sin(a) * 85;
          return (
            <g key={deg}>
              <circle cx={sx} cy={sy} r="5.5" fill="url(#screwGrad)" stroke="#000" strokeWidth="0.5"/>
              <line x1={sx-2.5} y1={sy} x2={sx+2.5} y2={sy} stroke="rgba(0,0,0,0.7)" strokeWidth="1"/>
              <line x1={sx} y1={sy-2.5} x2={sx} y2={sy+2.5} stroke="rgba(0,0,0,0.7)" strokeWidth="1"/>
            </g>
          );
        })}
      </svg>

      {/* B logo over dome */}
      <img src="/B-logo.png" alt="B" style={{
        position: "absolute",
        width: 36, height: 36,
        objectFit: "contain",
        filter: "brightness(0) invert(1)",
        opacity: 0.92,
        transition: "transform 0.06s ease-out",
        transform: `scale(${pump})`,
      }}/>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [sessionOk, setSessionOk] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [title, setTitle] = useState("—");
  const [beatportUrl, setBeatportUrl] = useState<string | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [snippetPath, setSnippetPath] = useState<string | null>(null);
  const [allowPreview, setAllowPreview] = useState<boolean | null>(null);
  const [subtitle, setSubtitle] = useState("");
  const [tag, setTag] = useState<Tag>("NOT FOUND");

  const [success, setSuccess] = useState(false);
  const [failPulse, setFailPulse] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const meterStopRef = useRef<(() => void) | null>(null);

  const busy = status !== "idle";
  const listening = status === "listening";
  const recognizing = status === "recognizing";

  useEffect(() => {
    setSessionOk(true);
    setSessionLoading(false);
  }, []);

  // ── Control Center iOS (comme Shazam) ──
  // Déclenché quand l'user tape BANGER dans le Control Center
  useEffect(() => {
    function onControlCenter() {
      if (status === "idle") startListening();
    }
    window.addEventListener("banger:scan", onControlCenter);
    return () => window.removeEventListener("banger:scan", onControlCenter);
  }, [status]);

  async function signInWith(provider: "google" | "apple") {
    if (!supabase) return;
    setLoginLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
    } finally {
      setLoginLoading(false);
    }
  }

  function previewUrl(path: string) {
    const clean = path.startsWith("snippets/") ? path : `snippets/${path}`;
    const { data } = supabase!.storage.from("bpro_uploads").getPublicUrl(clean);
    return data.publicUrl;
  }

  function vib(pattern: number | number[]) {
    try {
      const nav = navigator as Navigator & {
        vibrate?: (pattern: number | number[]) => boolean;
      };

      if (typeof nav.vibrate === "function") {
        nav.vibrate(pattern);
      }
    } catch {}
  }

  function stopMeters() {
    try {
      meterStopRef.current?.();
    } catch {}
    meterStopRef.current = null;
    setAudioLevel(0);
  }

  async function startMeters(stream: MediaStream) {
    stopMeters();
    const meter = await startAudioMeter(stream, setAudioLevel);
    meterStopRef.current = meter.stop;
  }

  function stopRecording() {
    try {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    } catch {}
    timerRef.current = null;

    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {}
  }

  function triggerFail() {
    setFailPulse(true);
    window.setTimeout(() => setFailPulse(false), 520);
  }

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(false), 900);
    return () => window.clearTimeout(t);
  }, [success]);

  async function startListening() {
    if (busy) return;

    setTitle("—");
    setSubtitle("");
    setTag("NOT FOUND");

    try {
      vib(12);  // tap léger au démarrage
      setStatus("listening");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      await startMeters(stream);

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        try {
          const s = streamRef.current;
          if (s) s.getTracks().forEach((t) => t.stop());
        } catch {}
        streamRef.current = null;

        stopMeters();
        vib([6, 30, 6]);  // pulse subtil : analyse en cours
        setStatus("recognizing");

        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const fd = new FormData();
          fd.append("audio", blob, "sample.webm");

const region = await getRegion();
          const data = await recognizeAudio(blob, mime, region);

          const mapped = mapRecognizeResult(data);

          setTitle(mapped.title);
          setSubtitle(mapped.subtitle);
          setTag(mapped.tag);
          setBeatportUrl(mapped.beatportUrl);
          setSpotifyUrl(mapped.spotifyUrl);
          setSnippetPath(mapped.snippetPath);
          setAllowPreview(mapped.allowPreview);
          setSuccess(mapped.success);

          if (mapped.success) {
            vib([18, 60, 18, 60, 80]);  // double pulse succès
          } else {
            vib([8, 40, 8]);  // pulse court echec
            triggerFail();
          }
        } catch (e) {
          console.error("home recognize failed", e);

          const message =
            e instanceof Error && e.message
              ? e.message
              : "Server error";

          setTitle("Not found");
          setBeatportUrl(null);
          setSpotifyUrl(null);
          setSnippetPath(null);
          setAllowPreview(null);
          setSubtitle(message);
          setTag("NOT FOUND");
          vib([8, 40, 8]);
          triggerFail();
        }

        setStatus("idle");
      };

      mr.start();
      timerRef.current = window.setTimeout(() => stopRecording(), 10_000);
    } catch {
      stopMeters();
      setStatus("idle");
      alert("Micro non autorisé. Active l'accès micro dans le navigateur.");
    }
  }

  const headerTitleStyle = useMemo(() => {  const badgeBg =
    tag === "UNRELEASED"
      ? "rgba(225,225,225,0.14)"
      : tag === "RELEASED"
      ? "rgba(225,225,225,0.10)"
      : "rgba(225,225,225,0.08)";

    return {
      ...scanStyles.title,
      background:
        "linear-gradient(180deg, rgba(245,245,245,0.98), rgba(160,160,160,0.62))",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      textShadow: "0 1px 0 rgba(255,255,255,0.08)",
    };
  }, []);

  const subStyle = useMemo(() => {
    return {
      ...scanStyles.sub,
      background:
        "linear-gradient(180deg, rgba(235,235,235,0.92), rgba(150,150,150,0.70))",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  }, []);

  const bFilter = success
    ? "brightness(2.35) contrast(1.15) " +
      "drop-shadow(0 0 34px rgba(255,255,255,0.62))"
    : listening
    ? `brightness(${1.10 + audioLevel * 1.05}) contrast(1.08) ` +
      `drop-shadow(0 0 ${10 + audioLevel * 26}px rgba(0,229,255,0.28))`
    : recognizing
    ? "brightness(1.20) contrast(1.08) " +
      "drop-shadow(0 0 14px rgba(0,229,255,0.18))"
    : "brightness(1) contrast(1)";

  if (sessionLoading) {
    return (
      <main style={scanStyles.page}>
      
      <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
          <Image
            src="/banger-findids.png"
            alt="Banger Find IDs"
            width={260}
            height={90}
            style={{ width: "min(260px, 72vw)", height: "auto", objectFit: "contain" }}
            priority
          />
        </div>
        <div style={scanStyles.loading}>Loading…</div>
      </main>
    );
  }

  if (!sessionOk) {
    return (
      <main style={{ ...scanStyles.page, background: "#0b0b0c" }}>
        <div style={{ ...scanStyles.phone, justifyContent: "center" }}>
          <div style={{ ...scanStyles.center, justifyContent: "center", gap: 18 }}>
            <div style={scanStyles.logoWrap}>
              <Image src="/B-logo.png" alt="BANGER" width={78} height={78} priority />
            </div>
            <div style={scanStyles.loginHint}>
              Scan the music around you.{"\n"}Discover what the scene is playing.
            </div>
            <button onClick={() => signInWith("google")} disabled={loginLoading} style={scanStyles.googleBtn}>
              {loginLoading ? "Connecting…" : "Continue with Google"}
            </button>
            <button onClick={() => signInWith("apple")} disabled={loginLoading} style={scanStyles.appleBtn}>
              {loginLoading ? "Connecting…" : "\uF8FF  Continue with Apple"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div style={scanStyles.page}>
      <style>{`
        /* ── Club Strobe animations ── */
        @keyframes ringPulse {
          0%   { transform: translate(-50%,-50%) scale(1);    opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(2.2);  opacity: 0; }
        }
        @keyframes ringPulseFast {
          0%   { transform: translate(-50%,-50%) scale(1);    opacity: 0.9; }
          100% { transform: translate(-50%,-50%) scale(1.8);  opacity: 0; }
        }
        @keyframes breathe {
          0%,100% { transform: translate(-50%,-50%) scale(1.00); opacity: 0.12; }
          50%      { transform: translate(-50%,-50%) scale(1.18); opacity: 0.32; }
        }
        @keyframes quake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          20%     { transform: translate(-3px, 2px) rotate(-0.4deg); }
          40%     { transform: translate( 3px,-2px) rotate( 0.4deg); }
          60%     { transform: translate(-2px, 3px) rotate(-0.3deg); }
          80%     { transform: translate( 2px,-1px) rotate( 0.3deg); }
        }
        @keyframes strobeIn {
          0%   { opacity: 0; }
          8%   { opacity: 0.85; }
          16%  { opacity: 0; }
          24%  { opacity: 0.6; }
          32%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes boomRing {
          0%   { transform: translate(-50%,-50%) scale(0.85); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(2.0);  opacity: 0; }
        }
        @keyframes boomRing2 {
          0%   { transform: translate(-50%,-50%) scale(0.85); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(1.7);  opacity: 0; }
        }
        @keyframes boomRing3 {
          0%   { transform: translate(-50%,-50%) scale(0.85); opacity: 0.35; }
          100% { transform: translate(-50%,-50%) scale(1.45); opacity: 0; }
        }
        @keyframes successGlow {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.7); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(1.4); }
        }
        @keyframes logoSlam {
          0%   { transform: scale(1); }
          25%  { transform: scale(1.14); }
          55%  { transform: scale(0.96); }
          80%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* flash effects moved inside button */}

      <div style={scanStyles.phone}>

        <div style={scanStyles.center}>
          <div style={{
              ...scanStyles.haloWrap,
              animation: recognizing ? "quake 0.18s ease-in-out infinite" : "none",
            }}>

            {/* ── IDLE : anneau statique subtil ── */}
            {!busy && (
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 200, height: 200, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.08)",
                transform: "translate(-50%,-50%)",
                pointerEvents: "none",
              }} />
            )}

            {/* ── LISTENING : 3 anneaux qui pulsent au rythme du micro ── */}
            {listening && (<>
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: `${1 + audioLevel * 2}px solid rgba(255,255,255,${0.15 + audioLevel * 0.5})`,
                transform: `translate(-50%,-50%) scale(${1 + audioLevel * 0.08})`,
                transition: "all 0.05s linear",
                pointerEvents: "none", zIndex: 1,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.12)",
                animation: "ringPulse 1.6s ease-out infinite",
                pointerEvents: "none", zIndex: 1,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.08)",
                animation: "ringPulse 1.6s ease-out infinite",
                animationDelay: "0.5s",
                pointerEvents: "none", zIndex: 1,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.05)",
                animation: "ringPulse 1.6s ease-out infinite",
                animationDelay: "1s",
                pointerEvents: "none", zIndex: 1,
              }} />
              {/* Halo breathe réactif au micro */}
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 240, height: 240, borderRadius: "50%",
                background: `radial-gradient(circle, rgba(255,255,255,${0.04 + audioLevel * 0.14}) 0%, transparent 70%)`,
                transform: `translate(-50%,-50%) scale(${1 + audioLevel * 0.15})`,
                transition: "all 0.05s linear",
                pointerEvents: "none", zIndex: 0,
              }} />
            </>)}

            {/* ── RECOGNIZING : tremblement de terre ── */}
            {recognizing && (<>
              {/* Anneaux rapides */}
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.30)",
                animation: "ringPulseFast 0.9s ease-out infinite",
                pointerEvents: "none", zIndex: 1,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.15)",
                animation: "ringPulseFast 0.9s ease-out infinite",
                animationDelay: "0.3s",
                pointerEvents: "none", zIndex: 1,
              }} />
            </>)}

            {/* ── SUCCESS UNRELEASED : 3 boom rings blancs ── */}
            {success && tag === "UNRELEASED" && (<>
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 190, height: 190, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.95)",
                animation: "boomRing 0.65s cubic-bezier(0.15,0,0.35,1) forwards",
                pointerEvents: "none", zIndex: 2,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 190, height: 190, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.55)",
                animation: "boomRing2 0.85s cubic-bezier(0.15,0,0.35,1) forwards",
                animationDelay: "0.07s",
                pointerEvents: "none", zIndex: 2,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 190, height: 190, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.25)",
                animation: "boomRing3 1.0s cubic-bezier(0.15,0,0.35,1) forwards",
                animationDelay: "0.14s",
                pointerEvents: "none", zIndex: 2,
              }} />
            </>)}

            {/* ── SUCCESS RELEASED : 3 boom rings verts ── */}
            {success && tag === "RELEASED" && (<>
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 190, height: 190, borderRadius: "50%",
                border: "2px solid rgba(29,185,84,0.95)",
                animation: "boomRing 0.65s cubic-bezier(0.15,0,0.35,1) forwards",
                pointerEvents: "none", zIndex: 2,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 190, height: 190, borderRadius: "50%",
                border: "1px solid rgba(29,185,84,0.55)",
                animation: "boomRing2 0.85s cubic-bezier(0.15,0,0.35,1) forwards",
                animationDelay: "0.07s",
                pointerEvents: "none", zIndex: 2,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 190, height: 190, borderRadius: "50%",
                border: "1px solid rgba(29,185,84,0.25)",
                animation: "boomRing3 1.0s cubic-bezier(0.15,0,0.35,1) forwards",
                animationDelay: "0.14s",
                pointerEvents: "none", zIndex: 2,
              }} />
            </>)}

            <button
              onClick={startListening}
              disabled={busy}
              style={{
                ...scanStyles.button3D,
                opacity: busy ? 0.92 : 1,
                transform: busy ? "translateY(1px)" : success ? "translateY(0px)" : "translateY(0px)",
                boxShadow: listening
                  ? `0 0 ${40 + audioLevel * 60}px rgba(212,160,23,${0.25 + audioLevel * 0.45}), ` +
                    "0 18px 60px rgba(0,0,0,0.85)"
                  : success
                  ? "0 0 90px rgba(255,220,60,0.70), " +
                    "0 18px 60px rgba(0,0,0,0.85)"
                  : "0 18px 60px rgba(0,0,0,0.75), " +
                    "inset 0 1px 0 rgba(255,255,255,0.06)",
                border: success
                  ? "1px solid rgba(245,245,245,0.34)"
                  : scanStyles.button3D.border,
                transition: "all 0.22s ease",
              }}
            >
              {/* ── SUCCESS glow overlay ── */}
              {success && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: tag === "RELEASED"
                    ? "radial-gradient(circle at 50% 50%, rgba(29,185,84,0.50) 0%, rgba(29,185,84,0.18) 45%, transparent 70%)"
                    : "radial-gradient(circle at 50% 50%, rgba(255,240,120,0.55) 0%, rgba(255,200,0,0.20) 42%, transparent 68%)",
                  animation: "successGlow 0.85s cubic-bezier(0.1,0,0.35,1) forwards",
                  pointerEvents: "none", zIndex: 6,
                }} />
              )}

              {/* ── FAIL flash ── */}
              {failPulse && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,60,60,0.45) 0%, transparent 70%)",
                  animation: "pop 0.4s ease-out forwards",
                  pointerEvents: "none", zIndex: 6,
                }} />
              )}

              {/* ── Woofer SVG ── */}
              <WooferSVG audioLevel={audioLevel} listening={listening} />
            </button>
          </div>

          <div style={scanStyles.status}>
            {status === "idle" ? "DROP IT" : null}
            {status === "listening" ? "LISTENING..." : null}
            {status === "recognizing" ? "IDENTIFYING..." : null}
          </div>

          {/* LAST ID removed */}
        </div>{/* end center */}

      </div>{/* end phone */}
    </div>
  );
}

const scanStyles: Record<string, CSSProperties> = {
  page: {
    height: "100vh",
    overflow: "hidden",
    background: "#000",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
  },
  phone: {
    width: "100%",
    maxWidth: 420,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  title: {
    marginTop: 6,
    fontSize: 44,
    fontWeight: 800,
    letterSpacing: "0.10em",
  },
  sub: {
    marginTop: 12,
    fontSize: 16,
    opacity: 0.82,
    letterSpacing: "0.08em",
    fontWeight: 800,
  },
  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 14,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 80, /* BottomNav height */
    overflow: "hidden",
  },
  haloWrap: {
    position: "relative",
    width: 260,
    height: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  haloOuter: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 9999,
    background: "rgba(230,230,230,0.08)",
    filter: "blur(42px)",
    transition: "all 0.55s ease",
    pointerEvents: "none",
  },
  haloInner: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 9999,
    background: "rgba(230,230,230,0.10)",
    filter: "blur(26px)",
    transition: "all 0.55s ease",
    pointerEvents: "none",
  },

  listenBreath: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 280,
    height: 280,
    borderRadius: 9999,
    background:
      "radial-gradient(circle at 50% 50%, rgba(0,229,255,0.22) 0%, " +
      "rgba(0,229,255,0.08) 36%, rgba(0,0,0,0) 72%)",
    filter: "blur(12px)",
    pointerEvents: "none",
    zIndex: 1,
    mixBlendMode: "screen",
    transform: "translate(-50%,-50%)",
  },

  k2000Ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 252,
    height: 252,
    borderRadius: 9999,
    background:
      "conic-gradient(from 0deg, transparent 0deg, " +
      "rgba(0,229,255,0.00) 14deg, " +
      "rgba(0,229,255,0.30) 22deg, " +
      "rgba(0,229,255,0.95) 35deg, " +
      "rgba(0,229,255,0.35) 52deg, " +
      "rgba(0,229,255,0.10) 70deg, " +
      "transparent 92deg)",
    filter: "blur(0.3px)",
    transform: "translate(-50%,-50%)",
    opacity: 0.95,
    pointerEvents: "none",
    zIndex: 2,
    boxShadow: "0 0 26px rgba(0,229,255,0.12)",
    maskImage:
      "radial-gradient(circle, transparent 62%, #000 66%, #000 100%)",
    WebkitMaskImage:
      "radial-gradient(circle, transparent 62%, #000 66%, #000 100%)",
  },

  wave1: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 220,
    height: 220,
    borderRadius: 9999,
    border: "1px solid rgba(0,229,255,0.25)",
    filter: "blur(0.8px)",
    pointerEvents: "none",
    zIndex: 1,
    transform: "translate(-50%,-50%)",
  },
  wave2: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 220,
    height: 220,
    borderRadius: 9999,
    border: "1px solid rgba(0,229,255,0.15)",
    filter: "blur(1.2px)",
    pointerEvents: "none",
    zIndex: 1,
    transform: "translate(-50%,-50%)",
  },
  wave3: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 220,
    height: 220,
    borderRadius: 9999,
    border: "1px solid rgba(0,229,255,0.08)",
    filter: "blur(1.8px)",
    pointerEvents: "none",
    zIndex: 1,
    transform: "translate(-50%,-50%)",
  },

  radarRing: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 220,
    height: 220,
    borderRadius: 9999,
    border: "1px solid rgba(0,229,255,0.22)",
    filter: "blur(1.1px)",
    pointerEvents: "none",
    zIndex: 1,
    transform: "translate(-50%,-50%)",
  },
  radarRing2: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 220,
    height: 220,
    borderRadius: 9999,
    border: "1px solid rgba(0,229,255,0.12)",
    filter: "blur(1.7px)",
    pointerEvents: "none",
    zIndex: 1,
    transform: "translate(-50%,-50%)",
  },

  scanLine: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 210,
    height: 10,
    borderRadius: 9999,
    background:
      "linear-gradient(90deg, rgba(0,0,0,0), " +
      "rgba(0,229,255,0.55), rgba(0,0,0,0))",
    filter: "blur(1px)",
    pointerEvents: "none",
    zIndex: 3,
    transform: "translate(-50%,-50%)",
    mixBlendMode: "screen",
  },

  particle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 6,
    height: 6,
    borderRadius: 9999,
    background: CYAN,
    boxShadow:
      "0 0 10px rgba(0,229,255,0.22), 0 0 18px rgba(0,229,255,0.10)",
    pointerEvents: "none",
    zIndex: 2,
    filter: "blur(0.2px)",
    opacity: 0,
  },

  button3D: {
    width: 190,
    height: 190,
    borderRadius: 9999,
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 4,
    position: "relative",
    overflow: "hidden",
    padding: 0,
  },

  specular: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 280,
    height: 180,
    borderRadius: 9999,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.20) 0%, " +
      "rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.02) 55%, " +
      "rgba(255,255,255,0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
    zIndex: 1,
    transform: "translate(-50%,-50%)",
  },

  listenGlow: {
    position: "absolute",
    inset: -36,
    borderRadius: 9999,
    background:
      "radial-gradient(circle at 50% 50%, rgba(0,229,255,0.30) 0%, " +
      "rgba(0,229,255,0.12) 28%, rgba(0,0,0,0) 62%)",
    filter: "blur(14px)",
    mixBlendMode: "screen",
    pointerEvents: "none",
    zIndex: 1,
  },

  successGlow: {
    position: "absolute",
    inset: -44,
    borderRadius: 9999,
    background:
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.38) 0%, " +
      "rgba(255,255,255,0.14) 28%, rgba(0,0,0,0) 62%)",
    filter: "blur(16px)",
    mixBlendMode: "screen",
    pointerEvents: "none",
    zIndex: 1,
  },

  bLogo: {
    width: 140,
    height: 140,
    objectFit: "contain",
    display: "block",
    zIndex: 2,
  },

  status: {
    fontSize: 15,
    opacity: 0.85,
    letterSpacing: "0.16em",
    fontWeight: 900,
    textTransform: "uppercase",
  },

  recent: { width: "100%", paddingLeft: 0, paddingRight: 0 },
  recentTitle: { fontSize: 11, letterSpacing: "0.30em", opacity: 0.55, marginBottom: 10 },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(235,235,235,0.08)",
    background: "rgba(10,10,10,0.55)",
    padding: 14,
    boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
    backdropFilter: "blur(10px)",
  },
  cardRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardMain: {
    fontSize: 14,
    fontWeight: 700,
    background:
      "linear-gradient(180deg, rgba(235,235,235,0.95), rgba(160,160,160,0.65))",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  badge: {
    fontSize: 10,
    padding: "6px 10px",
    borderRadius: 9999,
    border: "1px solid rgba(235,235,235,0.10)",
    opacity: 0.9,
    letterSpacing: "0.12em",
    whiteSpace: "nowrap",
  },
  cardSub: { marginTop: 8, fontSize: 12, opacity: 0.58 },

  /* successFlash / failFlash removed — effects now inside button */

  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    filter: "drop-shadow(0 0 18px rgba(255,255,255,0.18))",
  },
  googleBtn: {
    width: "min(340px, 100%)",
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  loginHint: {
    opacity: 0.7,
    fontSize: 12,
    letterSpacing: "0.06em",
  },
  loading: {
    opacity: 0.8,
    letterSpacing: "0.14em",
    fontWeight: 900,
    marginTop: 44,
  },
  appleBtn: {
    width: "min(340px, 100%)",
    padding: "14px 16px",
    borderRadius: 14,
    background: "#000",
    border: "1px solid rgba(255,255,255,0.30)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.4,
    textAlign: "center" as const,
  },
  spotifyBtn: {
    display: "block",
    padding: "11px 14px",
    borderRadius: 12,
    background: "rgba(29,185,84,0.15)",
    border: "1px solid rgba(29,185,84,0.35)",
    color: "#1db954",
    fontWeight: 700,
    fontSize: 13,
    textDecoration: "none",
    textAlign: "center" as const,
    letterSpacing: "0.04em",
  },
  beatportBtn: {
    display: "block",
    padding: "11px 14px",
    borderRadius: 12,
    background: "rgba(0,229,255,0.10)",
    border: "1px solid rgba(0,229,255,0.30)",
    color: "#00E5FF",
    fontWeight: 700,
    fontSize: 13,
    textDecoration: "none",
    textAlign: "center" as const,
    letterSpacing: "0.04em",
  },
};
// redeploy
// Tue Jun 16 22:24:59 CEST 2026
