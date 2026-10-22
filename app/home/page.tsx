"use client"; // build-1781643571963714000
import { fmtTitle, fmtArtist } from "@/lib/format";
import { useRouter } from "next/navigation";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { isNativeApp, nativeHaptic } from "@/lib/native";
import { startOAuth } from "@/lib/oauth";
import { ui, C, glass, tag as tagStyle, TAG_TEXT } from "@/lib/ui";
import MarqueeText from "@/components/MarqueeText";
import { useTrackState, FollowButton } from "@/components/TrackRow";
import { PreviewButton, trackHref } from "@/lib/preview";
import WooferSVG from "@/components/WooferSVG";
import Link from "next/link";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
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


const CYAN = "#f5cf68";

const PAGE_BG =
  "radial-gradient(900px 700px at 50% 18%, " +
  "rgba(18,18,18,1) 0%, rgba(8,8,8,1) 42%, " +
  "rgba(5,5,5,1) 70%, rgba(2,2,2,1) 100%)";



/** Story image + (when a preview exists) the track's own 15-second preview → an MP4, so Instagram plays the real sound. */
async function buildStoryVideo(image: Blob, snippetPath: string): Promise<File | null> {
  try {
    const sb = createSupabaseBrowser();
    if (!sb) return null;
    const clean = snippetPath.startsWith("snippets/") ? snippetPath : `snippets/${snippetPath}`;
    const audioUrl = sb.storage.from("bpro_uploads").getPublicUrl(clean).data.publicUrl;
    const audio = await (await fetch(audioUrl)).arrayBuffer();
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ff = new FFmpeg();
    await ff.load();
    await ff.writeFile("story.png", new Uint8Array(await image.arrayBuffer()));
    await ff.writeFile("preview.mp3", new Uint8Array(audio));
    await ff.exec(["-loop", "1", "-framerate", "5", "-i", "story.png", "-i", "preview.mp3", "-t", "15",
      "-vf", "scale=720:1280", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", "story.mp4"]);
    const out = await ff.readFile("story.mp4");
    try { ff.terminate(); } catch {}
    const buf = out instanceof Uint8Array ? out : new TextEncoder().encode(String(out));
    return buf.byteLength > 1000 ? new File([buf.buffer as ArrayBuffer], "banger-story.mp4", { type: "video/mp4" }) : null;
  } catch { return null; }
}

/** Builds the 9:16 story (image, or video with the preview sound) and opens the share sheet (Instagram, WhatsApp…). */
/** Builds the story file (MP4 with the preview when there is one, else the PNG). */
async function prepareStory(title: string, artist: string, unreleased: boolean, snippetPath?: string | null): Promise<File> {
  const url = `/api/story?t=${encodeURIComponent(title)}&a=${encodeURIComponent(artist && artist !== "(Released)" ? artist : "")}${unreleased ? "&u=1" : ""}`;
  const blob = await (await fetch(url)).blob();
  let file = new File([blob], "banger-story.png", { type: "image/png" });
  if (snippetPath) {
    const video = await buildStoryVideo(blob, snippetPath).catch(() => null);
    if (video) file = video;
  }
  return file;
}

/** "ok" | "cancel" | "needs-tap" (iOS: the tap expired while the video was being built) */
async function shareFile(file: File): Promise<"ok" | "cancel" | "needs-tap"> {
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: "BANGER" }); return "ok"; }
    catch (e: any) {
      if (e?.name === "AbortError") return "cancel";
      if (e?.name === "NotAllowedError") return "needs-tap";
    }
  }
  // No share sheet (desktop): download the file instead of leaving the app.
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return "ok";
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
  const [isProUser, setIsProUser] = useState(false);
  useEffect(() => { getBrowserRole().then((r) => setIsProUser(r === "pro")).catch(() => {}); }, []);
  useEffect(() => {
    const fit = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      const avail = vh - 56 - 104; // top bar, bottom nav
      const byWidth = (window.innerWidth - 40) / 240; // the visible speaker, the soft halo may bleed off-screen
      const byHeight = (avail - 215) / 235;
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

      // Raw microphone: the phone's voice filters (echo cancellation, noise suppression,
      // auto gain) treat loud music as "noise" and wipe it out — that's what broke scans in bars.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        } as MediaTrackConstraints,
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
        if (earlyTimer) window.clearTimeout(earlyTimer);
        if (earlyHit) { setStatus("idle"); return; }   // the quick try already found it
        vib([6, 30, 6]);  // pulse subtil : analyse en cours
        setStatus("recognizing");

        try {
          const blob = new Blob(chunksRef.current, { type: mime });
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

      // Two tries in one scan: a quick one after 6 s (most tracks are found here), and if
      // nothing matched, a longer one with 12 s of audio — more signal for noisy rooms.
      let earlyHit = false;
      const earlyTimer = window.setTimeout(async () => {
        try {
          if (mr.state === "inactive" || !chunksRef.current.length) return;
          const blob = new Blob(chunksRef.current.slice(), { type: mime });
          const data = await recognizeAudio(blob, mime, await getRegion(), { early: true });
          const mapped = mapRecognizeResult(data);
          if (!mapped.success || mr.state === "inactive") return;
          earlyHit = true;
          setTitle(mapped.title); setSubtitle(mapped.subtitle); setTag(mapped.tag);
          setBeatportUrl(mapped.beatportUrl); setSpotifyUrl(mapped.spotifyUrl);
          setSnippetPath(mapped.snippetPath); setAllowPreview(mapped.allowPreview);
          setSuccess(true);
          vib([18, 60, 18, 60, 80]);
          stopRecording();
        } catch {}
      }, 6_000);

      mr.start(1000);   // 1 s chunks so the quick try can read what's recorded so far
      timerRef.current = window.setTimeout(() => stopRecording(), 12_000);
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
      `drop-shadow(0 0 ${10 + audioLevel * 26}px rgba(245,207,104,0.28))`
    : recognizing
    ? "brightness(1.20) contrast(1.08) " +
      "drop-shadow(0 0 14px rgba(245,207,104,0.18))"
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
      <main style={{ ...scanStyles.page }}>
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

          {/* A real button with a big touch area, above the woofer's glow layers */}
          <button type="button" onClick={() => { if (!busy) startListening(); }} disabled={busy}
            style={{ ...scanStyles.status, position: "relative", zIndex: 5, background: "none", border: "none",
              padding: "14px 40px", margin: "-14px auto", fontFamily: "inherit", cursor: busy ? "default" : "pointer",
              touchAction: "manipulation", WebkitTapHighlightColor: "transparent", color: "#fff" }}>
            {status === "idle" ? "Tap to scan" : null}
            {status === "listening" ? "Listening…" : null}
            {status === "recognizing" ? "Identifying…" : null}
          </button>


          {/* ── RESULT ── */}
          {title !== "—" && status === "idle" && (
            <ScanResult key={title} title={title} subtitle={subtitle} tag={tag}
              snippet={allowPreview !== false ? snippetPath : null} />
          )}
        </div>{/* end center */}

      </div>{/* end phone */}
    </div>
  );
}

/** Scan result card: ▶ preview · title / artist / status, then Follow · Info · Share on one line. */
function ScanResult({ title, subtitle, tag, snippet }: {
  title: string; subtitle: string; tag: string; snippet: string | null;
}) {
  const [sharing, setSharing] = useState(false);
  const [ready, setReady] = useState<File | null>(null);   // story already built → the tap shares instantly
  const [needsTap, setNeedsTap] = useState(false);           // iOS: built too late for the first tap
  const building = useRef<Promise<File> | null>(null);
  const { meta: m0 } = useTrackState(title);
  const pv = snippet || m0?.snippet || null;
  // Build the story in the background as soon as the result shows, so Share opens the
  // share sheet straight away (iOS only allows it right after a tap).
  useEffect(() => {
    if (tag === "NOT FOUND") return;
    const t = window.setTimeout(() => {
      building.current = prepareStory(title, subtitle, tag === "UNRELEASED", pv);
      building.current.then(setReady).catch(() => {});
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pv]);
  async function onShare(preview: string | null) {
    if (ready) { const r = await shareFile(ready); setNeedsTap(r === "needs-tap"); return; }
    setSharing(true);
    try {
      const file = await (building.current || prepareStory(title, subtitle, tag === "UNRELEASED", preview));
      setReady(file);
      setNeedsTap((await shareFile(file)) === "needs-tap");
    } catch {} finally { setSharing(false); }
  }
  const { meta } = useTrackState(title);
  const preview = snippet || meta?.snippet || null;     // from the scan, or from the uploaded track
  // Unreleased + in the Top 100 → "#12 in the Unreleased Charts", discreet
  const [rank, setRank] = useState<number | null>(null);
  useEffect(() => {
    if (tag !== "UNRELEASED") return;
    let alive = true;
    fetch(`/api/charts?rank=${encodeURIComponent(title)}`, { cache: "no-store" }).then((r) => r.json())
      .then((j) => { if (alive && typeof j?.rank === "number") setRank(j.rank); }).catch(() => {});
    return () => { alive = false; };
  }, [title, tag]);
  const found = tag !== "NOT FOUND";
  const artist = subtitle && subtitle !== "(Released)" ? subtitle : "";
  const pill: CSSProperties = { ...ui.pillSmall, flex: 1, justifyContent: "center", padding: "8px 10px" };
  return (
    <div style={{ ...scanStyles.resultBlock, textAlign: "left", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {found && (preview
          ? <PreviewButton compact id={`scan-${title}`} snippetPath={preview} />
          : <span aria-hidden style={{ width: 32, height: 32, borderRadius: "50%", border: "1px dashed rgba(255,255,255,0.12)", flexShrink: 0 }} />)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <MarqueeText text={fmtTitle(title)} style={{ ...scanStyles.resultTitle, fontSize: 17 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, minWidth: 0 }}>
            {artist && <span style={{ fontSize: 14, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{fmtArtist(artist)}</span>}
            <span style={tagStyle(tag === "UNRELEASED" ? "unrel" : tag === "RELEASED" ? "rel" : "neutral")}>
              {tag === "UNRELEASED" ? TAG_TEXT.unrel : tag === "RELEASED" ? TAG_TEXT.rel : "Not found"}
            </span>
          </div>
          {rank && (
            <Link href="/charts" style={{ display: "inline-block", marginTop: 6, fontSize: 12, fontWeight: 600, color: C.gold, textDecoration: "none", opacity: 0.85 }}>
              #{rank} in the Unreleased Charts ›
            </Link>
          )}
        </div>
      </div>
      {found && (
        <div style={{ display: "flex", gap: 8 }}>
          {tag === "UNRELEASED" && <FollowButton title={title} artist={artist} style={{ flex: 1, padding: "8px 10px" }} />}
          <Link href={trackHref(title, artist)} style={pill}>Info</Link>
          <button disabled={sharing} onClick={() => onShare(preview)}
            style={{ ...pill, color: C.gold, background: "rgba(245,207,104,0.12)", borderColor: "rgba(245,207,104,0.30)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 14v6h14v-6" /></svg>
            {sharing ? "Preparing…" : needsTap ? "Tap to share" : "Share"}
          </button>
        </div>
      )}
    </div>
  );
}

const scanStyles: Record<string, CSSProperties> = {
  page: {
    height: "calc(100dvh - 160px - env(safe-area-inset-top))", // 56px top bar + 104px bottom nav
    minHeight: 420,
    overflow: "hidden",
    touchAction: "none",
    overscrollBehavior: "none",
    background: "transparent",
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
      "radial-gradient(circle at 50% 50%, rgba(245,207,104,0.22) 0%, " +
      "rgba(245,207,104,0.08) 36%, rgba(0,0,0,0) 72%)",
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
      "rgba(245,207,104,0.00) 14deg, " +
      "rgba(245,207,104,0.30) 22deg, " +
      "rgba(245,207,104,0.95) 35deg, " +
      "rgba(245,207,104,0.35) 52deg, " +
      "rgba(245,207,104,0.10) 70deg, " +
      "transparent 92deg)",
    filter: "blur(0.3px)",
    transform: "translate(-50%,-50%)",
    opacity: 0.95,
    pointerEvents: "none",
    zIndex: 2,
    boxShadow: "0 0 26px rgba(245,207,104,0.12)",
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
    border: "1px solid rgba(245,207,104,0.25)",
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
    border: "1px solid rgba(245,207,104,0.15)",
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
    border: "1px solid rgba(245,207,104,0.08)",
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
    border: "1px solid rgba(245,207,104,0.22)",
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
    border: "1px solid rgba(245,207,104,0.12)",
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
      "rgba(245,207,104,0.55), rgba(0,0,0,0))",
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
      "0 0 10px rgba(245,207,104,0.22), 0 0 18px rgba(245,207,104,0.10)",
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
      "radial-gradient(circle at 50% 50%, rgba(245,207,104,0.30) 0%, " +
      "rgba(245,207,104,0.12) 28%, rgba(0,0,0,0) 62%)",
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
    fontSize: 17,
    color: "#fff",
    fontWeight: 600,
    letterSpacing: "-0.01em",
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
    filter: "drop-shadow(0 0 18px rgba(245,207,104,0.35))",
  },
  googleBtn: {
    width: "min(340px, 100%)",
    padding: "15px 16px",
    borderRadius: 999,
    background: C.goldGrad,
    border: "none",
    color: C.goldInk,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    boxShadow: "0 8px 24px rgba(200,140,15,0.25), inset 0 1px 0 rgba(255,235,160,0.35)",
  },
  loginHint: {
    color: C.text2,
    fontSize: 15,
    textAlign: "center" as const,
    whiteSpace: "pre-line" as const,
    lineHeight: 1.5,
  },
  loading: {
    opacity: 0.8,
    letterSpacing: "0.14em",
    fontWeight: 900,
    marginTop: 44,
  },
  appleBtn: {
    width: "min(340px, 100%)",
    padding: "15px 16px",
    borderRadius: 999,
    ...glass,
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
    textAlign: "center" as const,
  },
  resultLink: {
    fontSize: 11, fontWeight: 700, color: "rgba(29,185,84,0.9)", textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "4px 10px",
  },
  resultBlock: {
    ...glass,
    borderRadius: 22,
    padding: "16px 18px",
    textAlign: "center" as const,
    width: "100%",
    maxWidth: 340,
    boxSizing: "border-box" as const,
    animation: "fadeUp 0.35s ease-out",
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#fff",
    lineHeight: 1.25,
  },
  resultSub: {
    marginTop: 4,
    fontSize: 14,
    color: C.text2,
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
    background: "rgba(245,207,104,0.10)",
    border: "1px solid rgba(245,207,104,0.30)",
    color: "#f5cf68",
    fontWeight: 700,
    fontSize: 13,
    textDecoration: "none",
    textAlign: "center" as const,
    letterSpacing: "0.04em",
  },
};
// redeploy
// Tue Jun 16 22:24:59 CEST 2026
