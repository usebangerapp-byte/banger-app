"use client"; // build-1781643571963714000
import { useRouter } from "next/navigation";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { isNativeApp, nativeHaptic } from "@/lib/native";
import { startOAuth } from "@/lib/oauth";
import { ui, C, MONO, tag as tagStyle } from "@/lib/ui";
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
function WooferSVG({ audioLevel, listening, kick = 0 }: { audioLevel: number; listening: boolean; kick?: number }) {
  // Cone "breathes" with the overall level and punches forward on every bass hit
  const pump = 1 + audioLevel * 0.035 + kick * 0.09;
  const domePunch = 1 + kick * 0.07;
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

        {/* ── Baffle / cabinet background ── */}
        <circle cx={C} cy={C} r={R} fill="url(#baffleG)"/>

        {/* ── Chrome outer bezel ── */}
        <circle cx={C} cy={C} r={R} fill="none"
          stroke="url(#bezelG)" strokeWidth="5"/>
        {/* Bezel inner edge shadow */}
        <circle cx={C} cy={C} r={R-5} fill="none"
          stroke="rgba(0,0,0,0.9)" strokeWidth="2"/>
        {/* Bezel top highlight */}
        {/* arc drawn ON the bezel circle (r = R-2), from 10 o'clock to 2 o'clock */}
        <path d={`M ${C + (R-2)*Math.cos(-130*Math.PI/180)} ${C + (R-2)*Math.sin(-130*Math.PI/180)} A ${R-2} ${R-2} 0 0 1 ${C + (R-2)*Math.cos(-50*Math.PI/180)} ${C + (R-2)*Math.sin(-50*Math.PI/180)}`}
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
          transition: "transform 0.06s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}>
          <circle cx={C} cy={C} r="62" fill="url(#coneG)"/>
          {/* Sheen highlight — no texture lines, no rings */}
          <circle cx={C} cy={C} r="62" fill="url(#coneSheenG)"/>

          {/* ── Spider / voice coil former ── */}
          <circle cx={C} cy={C} r="27" fill="url(#spiderG)"
            stroke="rgba(0,0,0,0.8)" strokeWidth="1.5"/>
          <circle cx={C} cy={C} r="22" fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>

          {/* ── Dome (dust cap) — extra punch on kicks ── */}
          <g style={{ transform: `scale(${domePunch})`, transformOrigin: `${C}px ${C}px`, transition: "transform 0.06s cubic-bezier(0.2, 0.9, 0.3, 1)" }}>
          <circle cx={C} cy={C} r="20" fill="url(#domeG)"
            stroke="rgba(80,80,80,0.3)" strokeWidth="0.8"
            filter="url(#dropS)"/>
          {/* Dome specular */}
          <ellipse cx={C-6} cy={C-7} rx="8" ry="5"
            fill="rgba(255,255,255,0.11)" style={{filter:"blur(1.5px)"}}/>
          </g>
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
      <img src="/B-logo-sm.png" alt="B" style={{
        position: "absolute",
        width: 28, height: 28,
        objectFit: "contain",
        filter: "brightness(0) invert(1)",
        opacity: 0.88,
        transition: "transform 0.06s cubic-bezier(0.2, 0.9, 0.3, 1)",
        transform: `scale(${pump * domePunch})`,
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
  const [kick, setKick] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const meterStopRef = useRef<(() => void) | null>(null);

  const busy = status !== "idle";

  // Size the scan button from the space actually left between the top bar (52px)
  // and the bottom nav (96px), keeping room for the status line and the result.
  const [btnScale, setBtnScale] = useState(1.3);
  useEffect(() => {
    const fit = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      const avail = vh - 52 - 96;
      const byWidth = (window.innerWidth - 40) / 240; // the visible speaker, the soft halo may bleed off-screen
      const byHeight = (avail - 170) / 235;
      setBtnScale(Math.max(0.9, Math.min(1.55, byWidth, byHeight)));
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, []);
  const [pressed, setPressed] = useState(false);
  const listening = status === "listening";
  const recognizing = status === "recognizing";

  useEffect(() => {
    setSessionOk(true);
    setSessionLoading(false);
  }, []);

  // ── Siri / Shortcuts / app link: /home?scan=1 starts a scan right away ──
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("scan") !== "1") return;
      window.history.replaceState(null, "", "/home");
      if (status === "idle") startListening();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await startOAuth(supabase, provider);
    } finally {
      setLoginLoading(false);
    }
  }

  function previewUrl(path: string) {
    const clean = path.startsWith("snippets/") ? path : `snippets/${path}`;
    const { data } = supabase!.storage.from("bpro_uploads").getPublicUrl(clean);
    return data.publicUrl;
  }

  // ── Haptic feedback ──
  // Android: navigator.vibrate
  // iOS Safari: AudioContext pulse basse fréquence (seule méthode qui marche)
  function vib(pattern: number | number[]) {
    // Native app (iOS): real Taptic Engine feedback instead of the web fallbacks below
    if (isNativeApp()) {
      const kind = typeof pattern === "number" ? "tap"
        : pattern.length >= 5 ? "success"
        : pattern[0] <= 6 ? "analyzing" : "fail";
      nativeHaptic(kind);
      return;
    }
    // Android
    try {
      const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
      if (typeof nav.vibrate === "function") nav.vibrate(pattern);
    } catch {}

    // iOS — AudioContext haptic pulse
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Convertir le pattern en liste de durées
      const durations: number[] = typeof pattern === "number" ? [pattern] : pattern;
      // On joue une pulse pour chaque durée "on" (index pairs)
      let time = ctx.currentTime;
      durations.forEach((ms, idx) => {
        if (idx % 2 === 1) { time += ms / 1000; return; } // pause
        const dur = ms / 1000;
        // Oscillateur basse fréquence (200 Hz) + gain rapide → ressenti haptique
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 200;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.9, time + Math.min(dur * 0.1, 0.01));
        gain.gain.linearRampToValueAtTime(0, time + dur);
        osc.start(time);
        osc.stop(time + dur + 0.01);
        time += dur;
      });

      // Fermer le contexte après la dernière pulse
      const totalMs = durations.reduce((s, ms) => s + ms, 0);
      setTimeout(() => ctx.close().catch(() => {}), totalMs + 200);
    } catch {}
  }

  function stopMeters() {
    try {
      meterStopRef.current?.();
    } catch {}
    meterStopRef.current = null;
    setAudioLevel(0);
    setKick(0);
  }

  async function startMeters(stream: MediaStream) {
    stopMeters();
    const meter = await startAudioMeter(stream, setAudioLevel, setKick);
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
            src="/banger-findids-sm.png"
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
        /* Identifying glow pulse — lent, fluide, sans rotation */
        @keyframes identifyGlow {
          0%,100% { opacity: 0.18; }
          50%      { opacity: 0.55; }
        }
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
        @keyframes haloIdle {
          0%,100% { opacity: 0.16; transform: scale(0.97); }
          50%     { opacity: 0.30; transform: scale(1.00); }
        }
        @keyframes haloThink {
          0%,100% { opacity: 0.35; transform: scale(0.98); }
          50%     { opacity: 0.75; transform: scale(1.05); }
        }
        @keyframes idleBreath {
          0%,100% { opacity: 0.10; transform: scale(0.98); }
          50%     { opacity: 0.34; transform: scale(1.03); }
        }
        @keyframes ripple {
          0%   { opacity: 0.55; transform: scale(0.66); }
          100% { opacity: 0;    transform: scale(1.0); }
        }
        @keyframes fadeUp {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={scanStyles.phone}>

        <div style={scanStyles.center}>
          <div style={{ width: "100%", height: 235 * btnScale, position: "relative", flexShrink: 0 }}>
          <div style={{ ...scanStyles.haloWrap, position: "absolute", left: "50%", top: "50%",
            transform: `translate(-50%, -50%) scale(${btnScale})` }}>

            {/* ── HALO — one soft glow, only its intensity changes with the phase ── */}
            <div aria-hidden style={{
              position: "absolute", inset: -40, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
              background: "radial-gradient(circle at 50% 50%, rgba(255,196,60,0.55) 0%, rgba(230,160,30,0.22) 38%, rgba(200,130,0,0.06) 56%, rgba(0,0,0,0) 70%)",
              ...(success
                ? { opacity: 1, transform: "scale(1.12)", transition: "opacity 0.9s ease-out, transform 0.9s ease-out" }
                : failPulse
                ? { opacity: 0.04, transform: "scale(0.94)", transition: "opacity 0.15s ease, transform 0.15s ease" }
                : listening
                ? { opacity: Math.min(1, 0.30 + audioLevel * 0.5 + kick * 0.35), transform: `scale(${1 + audioLevel * 0.06 + kick * 0.08})`, transition: "opacity 0.06s linear, transform 0.06s linear" }
                : recognizing
                ? { animation: "haloThink 1.6s ease-in-out infinite" }
                : { animation: "haloIdle 4s ease-in-out infinite" }),
            }} />

            <button
              onClick={startListening}
              disabled={busy}
              onPointerDown={() => setPressed(true)}
              onPointerUp={() => setPressed(false)}
              onPointerLeave={() => setPressed(false)}
              aria-label="Scan the music playing around you"
              style={{
                ...scanStyles.button3D,
                opacity: busy ? 0.92 : 1,
                transform: pressed && !busy ? "scale(0.96)" : busy ? "translateY(1px)" : "translateY(0px)",
                boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
                border: scanStyles.button3D.border,
                transition: "transform 0.15s ease, opacity 0.2s ease",
              }}
            >
              {/* ── Woofer SVG ── */}
              <WooferSVG audioLevel={audioLevel} listening={listening} kick={kick} />
            </button>
          </div>
          </div>

          <div style={scanStyles.status}>
            {status === "idle" ? "DROP IT" : null}
            {status === "listening" ? "LISTENING..." : null}
            {status === "recognizing" ? "IDENTIFYING..." : null}
          </div>

          {/* ── RESULT ── */}
          {title !== "—" && status === "idle" && (
            <div style={scanStyles.resultBlock}>
              <div style={scanStyles.resultTitle}>{title}</div>
              {subtitle ? <div style={scanStyles.resultSub}>{subtitle}</div> : null}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                <span style={tagStyle(tag === "UNRELEASED" ? "unrel" : tag === "RELEASED" ? "rel" : "neutral")}>                {tag}
                </span>
              </div>
              {(spotifyUrl || beatportUrl) && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  {spotifyUrl && <a href={spotifyUrl} target="_blank" rel="noreferrer" style={ui.pillSmall}>Spotify</a>}
                  {beatportUrl && <a href={beatportUrl} target="_blank" rel="noreferrer" style={ui.pillSmall}>Beatport</a>}
                </div>
              )}
            </div>
          )}
        </div>{/* end center */}

      </div>{/* end phone */}
    </div>
  );
}

const scanStyles: Record<string, CSSProperties> = {
  page: {
    height: "calc(100dvh - 148px)", // 52px top bar + 96px bottom nav
    minHeight: 420,
    overflow: "hidden",
    touchAction: "none",
    overscrollBehavior: "none",
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
    paddingBottom: 0,
    overflow: "hidden",
  },
  haloWrap: {
    position: "relative",
    width: 300,
    height: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
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
    fontFamily: MONO,
    fontSize: 13,
    color: C.text2,
    letterSpacing: "0.32em",
    paddingLeft: "0.32em",
    fontWeight: 600,
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
  resultLink: {
    fontSize: 11, fontWeight: 700, color: "rgba(29,185,84,0.9)", textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "4px 10px",
  },
  resultBlock: {
    textAlign: "center" as const,
    paddingTop: 0,
    maxWidth: 300,
    animation: "fadeUp 0.35s ease-out",
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    background: "linear-gradient(180deg, rgba(245,245,245,0.98), rgba(160,160,160,0.72))",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    lineHeight: 1.2,
  },
  resultSub: {
    marginTop: 6,
    fontSize: 14,
    color: C.text2,
    letterSpacing: "0.02em",
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
