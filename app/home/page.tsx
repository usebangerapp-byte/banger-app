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
// Woofer SVG — style KRK Rokit réaliste
function WooferSVG({ audioLevel, listening }: { audioLevel: number; listening: boolean }) {
  const pump = 1 + audioLevel * 0.032;
  const glowR = 80 + audioLevel * 50;
  const glowA = 0.20 + audioLevel * 0.50;
  const C = 95, R = 90;

  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      pointerEvents: "none", zIndex: 4,
    }}>
      <svg width="190" height="190" viewBox="0 0 190 190" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Cabinet / baffle noir mat */}
          <radialGradient id="baffleG" cx="42%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#232323"/>
            <stop offset="55%" stopColor="#111"/>
            <stop offset="100%" stopColor="#060606"/>
          </radialGradient>
          {/* Outer chrome bezel */}
          <linearGradient id="bezelG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#555"/>
            <stop offset="30%" stopColor="#222"/>
            <stop offset="70%" stopColor="#181818"/>
            <stop offset="100%" stopColor="#444"/>
          </linearGradient>
          {/* Surround rubber — thick black arc */}
          <radialGradient id="surroundG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1c1c1c"/>
            <stop offset="60%" stopColor="#0d0d0d"/>
            <stop offset="100%" stopColor="#050505"/>
          </radialGradient>
          {/* Cone — golden Kevlar */}
          <radialGradient id="coneG" cx="44%" cy="36%" r="58%">
            <stop offset="0%"   stopColor="#f0c040"/>
            <stop offset="18%"  stopColor="#d4960e"/>
            <stop offset="45%"  stopColor="#b87a08"/>
            <stop offset="75%"  stopColor="#8a5a04"/>
            <stop offset="100%" stopColor="#3a2200"/>
          </radialGradient>
          {/* Cone sheen highlight */}
          <radialGradient id="coneSheenG" cx="36%" cy="28%" r="45%">
            <stop offset="0%"   stopColor="rgba(255,230,120,0.50)"/>
            <stop offset="50%"  stopColor="rgba(255,200,50,0.10)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
          {/* Voice coil / spider area */}
          <radialGradient id="spiderG" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#2e2e2e"/>
            <stop offset="45%"  stopColor="#161616"/>
            <stop offset="100%" stopColor="#080808"/>
          </radialGradient>
          {/* Dome */}
          <radialGradient id="domeG" cx="38%" cy="32%" r="58%">
            <stop offset="0%"   stopColor="#3c3c3c"/>
            <stop offset="50%"  stopColor="#181818"/>
            <stop offset="100%" stopColor="#060606"/>
          </radialGradient>
          {/* Screw */}
          <radialGradient id="screwG" cx="33%" cy="28%" r="55%">
            <stop offset="0%"   stopColor="#999"/>
            <stop offset="60%"  stopColor="#444"/>
            <stop offset="100%" stopColor="#1a1a1a"/>
          </radialGradient>
          {/* Drop shadow filter */}
          <filter id="dropS" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.8"/>
          </filter>
          {/* Glow filter */}
          <filter id="glowF" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Ambient glow (reactive) ── */}
        <circle cx={C} cy={C} r={glowR}
          fill={`rgba(200,140,0,${glowA * 0.28})`}
          style={{filter:"blur(18px)"}}/>

        {/* ── Baffle / cabinet background ── */}
        <circle cx={C} cy={C} r={R} fill="url(#baffleG)"/>

        {/* ── Chrome outer bezel ── */}
        <circle cx={C} cy={C} r={R} fill="none"
          stroke="url(#bezelG)" strokeWidth="5"/>
        {/* Bezel inner edge shadow */}
        <circle cx={C} cy={C} r={R-5} fill="none"
          stroke="rgba(0,0,0,0.9)" strokeWidth="2"/>
        {/* Bezel top highlight */}
        <path d={`M ${C-60} ${C-72} A 90 90 0 0 1 ${C+60} ${C-72}`}
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"
          strokeLinecap="round"/>

        {/* ── Surround (rubber roll — thick arc) ── */}
        {/* Outer surround edge */}
        <circle cx={C} cy={C} r="76" fill="none"
          stroke="rgba(0,0,0,0.95)" strokeWidth="1"/>
        {/* Surround body */}
        <circle cx={C} cy={C} r="72" fill="url(#surroundG)"
          filter="url(#dropS)"/>
        {/* Surround groove */}
        <circle cx={C} cy={C} r="68" fill="none"
          stroke="rgba(255,255,255,0.035)" strokeWidth="1.5"/>
        <circle cx={C} cy={C} r="64" fill="none"
          stroke="rgba(0,0,0,0.7)" strokeWidth="2"/>

        {/* ── Cone (golden KRK) — pumps with audio ── */}
        <g style={{
          transform: `scale(${pump})`,
          transformOrigin: `${C}px ${C}px`,
          transition: "transform 0.05s ease-out",
        }}>
          <circle cx={C} cy={C} r="62" fill="url(#coneG)"/>
          {/* Sheen highlight — no texture lines, no rings */}
          <circle cx={C} cy={C} r="62" fill="url(#coneSheenG)"/>

          {/* ── Spider / voice coil former ── */}
          <circle cx={C} cy={C} r="27" fill="url(#spiderG)"
            stroke="rgba(0,0,0,0.8)" strokeWidth="1.5"/>
          <circle cx={C} cy={C} r="22" fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>

          {/* ── Dome (dust cap) ── */}
          <circle cx={C} cy={C} r="20" fill="url(#domeG)"
            stroke="rgba(80,80,80,0.3)" strokeWidth="0.8"
            filter="url(#dropS)"/>
          {/* Dome specular */}
          <ellipse cx={C-6} cy={C-7} rx="8" ry="5"
            fill="rgba(255,255,255,0.11)" style={{filter:"blur(1.5px)"}}/>
        </g>

        {/* ── Screws × 4 (outside cone, on baffle) ── */}
        {[45, 135, 225, 315].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const sx = C + Math.cos(a) * 83;
          const sy = C + Math.sin(a) * 83;
          return (
            <g key={deg}>
              <circle cx={sx} cy={sy} r="5" fill="url(#screwG)"
                stroke="rgba(0,0,0,0.8)" strokeWidth="0.5"/>
              {/* Phillips cross */}
              <line x1={sx-2.8} y1={sy} x2={sx+2.8} y2={sy}
                stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1={sx} y1={sy-2.8} x2={sx} y2={sy+2.8}
                stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" strokeLinecap="round"/>
              {/* Screw highlight */}
              <circle cx={sx-1} cy={sy-1} r="1.5"
                fill="rgba(255,255,255,0.22)"/>
            </g>
          );
        })}
      </svg>

      {/* ── B logo centered on dome ── */}
      <img src="/B-logo.png" alt="B" style={{
        position: "absolute",
        width: 28, height: 28,
        objectFit: "contain",
        filter: "brightness(0) invert(1)",
        opacity: 0.88,
        transition: "transform 0.05s ease-out",
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
        /* ── Animations nouvelle génération — ZERO cercle décalé ── */
        @keyframes quake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          20%     { transform: translate(-3px, 2px) rotate(-0.4deg); }
          40%     { transform: translate( 3px,-2px) rotate( 0.4deg); }
          60%     { transform: translate(-2px, 3px) rotate(-0.3deg); }
          80%     { transform: translate( 2px,-1px) rotate( 0.3deg); }
        }
        @keyframes successGlow {
          0%   { opacity: 0; transform: scale(0.7); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.4); }
        }
        /* Halo pulse — réactif, pas de translate */
        @keyframes haloPulse {
          0%,100% { opacity: 0.18; transform: scale(1.00); }
          50%      { opacity: 0.45; transform: scale(1.12); }
        }
        /* Orbit particles */
        @keyframes orbit0 { from { transform: rotate(0deg)   translateX(115px) rotate(0deg);   } to { transform: rotate(360deg)  translateX(115px) rotate(-360deg);  } }
        @keyframes orbit1 { from { transform: rotate(72deg)  translateX(115px) rotate(-72deg);  } to { transform: rotate(432deg) translateX(115px) rotate(-432deg); } }
        @keyframes orbit2 { from { transform: rotate(144deg) translateX(115px) rotate(-144deg); } to { transform: rotate(504deg) translateX(115px) rotate(-504deg); } }
        @keyframes orbit3 { from { transform: rotate(216deg) translateX(115px) rotate(-216deg); } to { transform: rotate(576deg) translateX(115px) rotate(-576deg); } }
        @keyframes orbit4 { from { transform: rotate(288deg) translateX(115px) rotate(-288deg); } to { transform: rotate(648deg) translateX(115px) rotate(-648deg); } }
        /* Fast orbit for recognizing */
        @keyframes orbitFast0 { from { transform: rotate(0deg)   translateX(105px) rotate(0deg);   } to { transform: rotate(360deg)  translateX(105px) rotate(-360deg);  } }
        @keyframes orbitFast1 { from { transform: rotate(60deg)  translateX(105px) rotate(-60deg);  } to { transform: rotate(420deg) translateX(105px) rotate(-420deg); } }
        @keyframes orbitFast2 { from { transform: rotate(120deg) translateX(105px) rotate(-120deg); } to { transform: rotate(480deg) translateX(105px) rotate(-480deg); } }
        @keyframes orbitFast3 { from { transform: rotate(180deg) translateX(105px) rotate(-180deg); } to { transform: rotate(540deg) translateX(105px) rotate(-540deg); } }
        @keyframes orbitFast4 { from { transform: rotate(240deg) translateX(105px) rotate(-240deg); } to { transform: rotate(600deg) translateX(105px) rotate(-600deg); } }
        @keyframes orbitFast5 { from { transform: rotate(300deg) translateX(105px) rotate(-300deg); } to { transform: rotate(660deg) translateX(105px) rotate(-660deg); } }
        /* Boom flash success */
        @keyframes boomFlash {
          0%   { opacity: 0.9; transform: scale(1.0); }
          60%  { opacity: 0.4; transform: scale(1.35); }
          100% { opacity: 0;   transform: scale(1.55); }
        }
        @keyframes boomFlash2 {
          0%   { opacity: 0; }
          15%  { opacity: 0.7; transform: scale(1.0); }
          100% { opacity: 0; transform: scale(1.4); }
        }
      `}</style>

      <div style={scanStyles.phone}>

        <div style={scanStyles.center}>
          <div style={{
              ...scanStyles.haloWrap,
              animation: recognizing ? "quake 0.18s ease-in-out infinite" : "none",
            }}>

            {/* ── HALO AMBIANT (toujours présent, pas de position absolue + translate) ── */}
            {/* Rendu via SVG pour zéro problème de centrage */}
            <svg style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0 }}
              width="300" height="300" viewBox="0 0 300 300">
              {/* Idle : légère aura */}
              {!busy && (
                <circle cx="150" cy="150" r="135" fill="none"
                  stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
              )}
              {/* Listening : aura réactive (rendu via filter + opacité) */}
              {listening && (<>
                <defs>
                  <radialGradient id="listenHalo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={`rgba(255,200,50,${0.10 + audioLevel * 0.22})`}/>
                    <stop offset="60%" stopColor={`rgba(255,160,0,${0.04 + audioLevel * 0.08})`}/>
                    <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
                  </radialGradient>
                </defs>
                <circle cx="150" cy="150" r="148" fill="url(#listenHalo)"
                  style={{ transition:"all 0.05s linear" }}/>
              </>)}
              {/* Recognizing : aura froide */}
              {recognizing && (<>
                <defs>
                  <radialGradient id="recogHalo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(200,220,255,0.14)"/>
                    <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
                  </radialGradient>
                </defs>
                <circle cx="150" cy="150" r="148" fill="url(#recogHalo)"/>
              </>)}
              {/* Success : flash */}
              {success && (
                <circle cx="150" cy="150" r="145"
                  fill={tag==="RELEASED" ? "rgba(29,185,84,0.22)" : "rgba(255,220,60,0.22)"}
                  style={{ animation:"boomFlash 0.75s ease-out forwards" }}/>
              )}
            </svg>

            {/* ── LISTENING : particules en orbite lente ── */}
            {listening && (
              <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{
                    position:"absolute", top:"50%", left:"50%",
                    width: 5 + audioLevel * 3, height: 5 + audioLevel * 3,
                    borderRadius:"50%",
                    background: `rgba(255,${180 + i*12},0,${0.55 + audioLevel * 0.45})`,
                    boxShadow: `0 0 ${6 + audioLevel*10}px rgba(255,180,0,0.6)`,
                    marginTop: -(2.5 + audioLevel*1.5),
                    marginLeft: -(2.5 + audioLevel*1.5),
                    animation: `orbit${i} ${3.2 - audioLevel*1.4}s linear infinite`,
                  }}/>
                ))}
              </div>
            )}

            {/* ── RECOGNIZING : particules rapides ── */}
            {recognizing && (
              <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1 }}>
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} style={{
                    position:"absolute", top:"50%", left:"50%",
                    width:4, height:4, borderRadius:"50%",
                    background:"rgba(200,220,255,0.85)",
                    boxShadow:"0 0 8px rgba(180,200,255,0.8)",
                    marginTop:-2, marginLeft:-2,
                    animation: `orbitFast${i} 0.9s linear infinite`,
                  }}/>
                ))}
              </div>
            )}

            {/* ── SUCCESS : double flash radial (SVG, pas de translate) ── */}
            {success && (
              <svg style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:2 }}
                width="300" height="300" viewBox="0 0 300 300">
                <circle cx="150" cy="150" r="100"
                  fill="none"
                  stroke={tag==="RELEASED" ? "rgba(29,185,84,0.9)" : "rgba(255,220,50,0.9)"}
                  strokeWidth="2"
                  style={{ animation:"boomFlash 0.65s ease-out forwards" }}/>
                <circle cx="150" cy="150" r="100"
                  fill="none"
                  stroke={tag==="RELEASED" ? "rgba(29,185,84,0.5)" : "rgba(255,220,50,0.5)"}
                  strokeWidth="1"
                  style={{ animation:"boomFlash2 0.9s ease-out forwards", animationDelay:"0.07s" }}/>
              </svg>
            )}

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
    width: 300,
    height: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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
