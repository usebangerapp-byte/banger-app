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
      ...styles.title,
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
      ...styles.sub,
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
      <main style={styles.page}>
      
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
        <div style={styles.loading}>Loading…</div>
      </main>
    );
  }

  if (!sessionOk) {
    return (
      <main style={{ ...styles.page, background: "#0b0b0c" }}>
        <div style={{ ...styles.phone, justifyContent: "center" }}>
          <div style={{ ...styles.center, justifyContent: "center", gap: 18 }}>
            <div style={styles.logoWrap}>
              <Image src="/B-logo.png" alt="BANGER" width={78} height={78} priority />
            </div>
            <div style={styles.loginHint}>
              Scan the music around you.{"\n"}Discover what the scene is playing.
            </div>
            <button onClick={() => signInWith("google")} disabled={loginLoading} style={styles.googleBtn}>
              {loginLoading ? "Connecting…" : "Continue with Google"}
            </button>
            <button onClick={() => signInWith("apple")} disabled={loginLoading} style={styles.appleBtn}>
              {loginLoading ? "Connecting…" : "\uF8FF  Continue with Apple"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div style={styles.page}>
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
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 1; }
          60%  { opacity: 0.8; }
          100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; }
        }
        @keyframes boomRing2 {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; }
        }
        @keyframes logoSlam {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.22); }
          55%  { transform: scale(0.94); }
          75%  { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
      `}</style>

      {success ? <div style={styles.successFlash} /> : null}
      {failPulse ? <div style={styles.failFlash} /> : null}

      <div style={styles.phone}>
        <div style={styles.top}>
        </div>

        <div style={styles.center}>
          <div style={{
              ...styles.haloWrap,
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

            {/* ── RECOGNIZING : tremblement de terre + strobe ── */}
            {recognizing && (<>
              {/* Strobe flash */}
              <div style={{
                position: "fixed", inset: 0, zIndex: 50,
                background: "rgba(255,255,255,0.06)",
                animation: "strobeIn 0.8s ease-out forwards",
                pointerEvents: "none",
              }} />
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

            {/* ── SUCCESS UNRELEASED : boom blanc ── */}
            {success && tag === "UNRELEASED" && (<>
              <div style={{
                position: "fixed", inset: 0, zIndex: 50,
                background: "rgba(255,255,255,0.18)",
                animation: "strobeIn 0.5s ease-out forwards",
                pointerEvents: "none",
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.9)",
                animation: "boomRing 0.7s cubic-bezier(0.2,0,0.4,1) forwards",
                pointerEvents: "none", zIndex: 2,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.5)",
                animation: "boomRing2 0.9s cubic-bezier(0.2,0,0.4,1) forwards",
                animationDelay: "0.1s",
                pointerEvents: "none", zIndex: 2,
              }} />
            </>)}

            {/* ── SUCCESS RELEASED : boom vert ── */}
            {success && tag === "RELEASED" && (<>
              <div style={{
                position: "fixed", inset: 0, zIndex: 50,
                background: "rgba(29,185,84,0.12)",
                animation: "strobeIn 0.5s ease-out forwards",
                pointerEvents: "none",
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "2px solid rgba(29,185,84,0.9)",
                animation: "boomRing 0.7s cubic-bezier(0.2,0,0.4,1) forwards",
                pointerEvents: "none", zIndex: 2,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 180, height: 180, borderRadius: "50%",
                border: "1px solid rgba(29,185,84,0.5)",
                animation: "boomRing2 0.9s cubic-bezier(0.2,0,0.4,1) forwards",
                animationDelay: "0.1s",
                pointerEvents: "none", zIndex: 2,
              }} />
            </>)}

            <button
              onClick={startListening}
              disabled={busy}
              style={{
                ...styles.button3D,
                opacity: busy ? 0.92 : 1,
                transform: busy ? "translateY(1px)" : success ? "translateY(0px)" : "translateY(0px)",
                boxShadow: listening
                  ? "0 0 68px rgba(0,229,255,0.16), " +
                    "0 18px 60px rgba(0,0,0,0.78)"
                  : success
                  ? "0 0 84px rgba(255,255,255,0.78), " +
                    "0 18px 60px rgba(0,0,0,0.78)"
                  : "0 18px 60px rgba(0,0,0,0.75), " +
                    "inset 0 1px 0 rgba(255,255,255,0.08)",
                border: success
                  ? "1px solid rgba(245,245,245,0.34)"
                  : styles.button3D.border,
                transition: "all 0.22s ease",
              }}
            >
              <div
                style={{
                  ...styles.specular,
                  opacity: busy ? 0.07 : 0.14,
                }}
              />

              {success ? <div style={styles.successGlow} /> : null}

              {listening ? (
                <div
                  style={{
                    ...styles.listenGlow,
                    opacity: 0.16 + audioLevel * 0.62,
                  }}
                />
              ) : null}

              <img
                src="/B-logo.png"
                alt="Banger"
                style={{
                  ...styles.bLogo,
                  filter: bFilter,
                  transition: "filter 0.12s linear",
                  animation: success ? "logoSlam 0.55s cubic-bezier(0.2,0,0.4,1) forwards" : "none",
                }}
              />
            </button>
          </div>

          <div style={styles.status}>
            {status === "idle" ? "DROP IT" : null}
            {status === "listening" ? "Listening…" : null}
            {status === "recognizing" ? "Identifying…" : null}
          </div>
        </div>

        <div style={styles.recent}>
          <div style={styles.recentTitle}>LAST ID</div>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <div style={styles.cardMain}>{title}</div>
              <div style={{ ...styles.badge, background: (tag === "UNRELEASED" ? "rgba(225,225,225,0.14)" : tag === "RELEASED" ? "rgba(225,225,225,0.10)" : "rgba(225,225,225,0.08)") }}>{tag}</div>
            </div>
            <div style={styles.cardSub}>{subtitle}</div>


            {tag === "UNRELEASED" && allowPreview && snippetPath && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                <audio controls src={previewUrl(snippetPath)} style={{ width: "100%" }} />
              </div>
            )}
            {tag === "RELEASED" && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {spotifyUrl && (
                  <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" style={styles.spotifyBtn}>
                    ▶ Listen on Spotify
                  </a>
                )}
                {beatportUrl && (
                  <a href={beatportUrl} target="_blank" rel="noopener noreferrer" style={styles.beatportBtn}>
                    ⬇ Buy on Beatport
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
  },
  phone: {
    width: "100%",
    maxWidth: 420,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  top: {
    paddingTop: 44,
    paddingLeft: 24,
    paddingRight: 24,
    textAlign: "center",
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
    gap: 18,
    paddingLeft: 24,
    paddingRight: 24,
  },
  haloWrap: {
    position: "relative",
    width: 320,
    height: 320,
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
    width: 220,
    height: 220,
    borderRadius: 9999,
    border: "1px solid rgba(220,220,220,0.14)",
    background:
      "radial-gradient(220px 220px at 30% 25%, rgba(255,255,255,0.10) 0%, " +
      "rgba(255,255,255,0.04) 18%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0.55) 100%), " +
      "linear-gradient(145deg, #0b0b0b, #040404)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 4,
    position: "relative",
    overflow: "hidden",
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
    width: 168,
    height: 168,
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

  recent: { paddingLeft: 24, paddingRight: 24, paddingBottom: 22 },
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

  successFlash: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle, rgba(255,255,255,0.22), transparent 62%)",
    animation: "pop .35s ease-out forwards",
    opacity: 0,
  },
  failFlash: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle, rgba(0,0,0,0.65), transparent 70%)",
    animation: "pop .45s ease-out forwards",
    opacity: 0,
  },

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
