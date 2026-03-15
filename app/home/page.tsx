"use client";
import { useRouter } from "next/navigation";

import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";



type Status = "idle" | "listening" | "recognizing";
type Tag = "UNRELEASED" | "RELEASED" | "NOT FOUND";

const CYAN = "#00E5FF";

const PAGE_BG =
  "radial-gradient(900px 700px at 50% 18%, " +
  "rgba(18,18,18,1) 0%, rgba(8,8,8,1) 42%, " +
  "rgba(5,5,5,1) 70%, rgba(2,2,2,1) 100%)";


export default function Home() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [sessionOk, setSessionOk] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [title, setTitle] = useState("—");
  const [subtitle, setSubtitle] = useState("");
  const [tag, setTag] = useState<Tag>("NOT FOUND");

  const [success, setSuccess] = useState(false);
  const [failPulse, setFailPulse] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRef = useRef<number | null>(null);

  const busy = status !== "idle";
  const listening = status === "listening";
  const recognizing = status === "recognizing";

  useEffect(() => {
    setSessionOk(true);
    setSessionLoading(false);
  }, []);

  async function signInWithGoogle() {
    setLoginLoading(true);
    try {
      await supabase!.auth.signInWithOAuth({
        provider: "google",
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

  function vib(pattern: number | number[]) {
    try {
      // @ts-ignore
      if (navigator && "vibrate" in navigator) navigator.vibrate(pattern);
    } catch {}
  }

  function stopMeters() {
    try {
      if (meterRef.current) window.clearInterval(meterRef.current);
    } catch {}
    meterRef.current = null;
    setAudioLevel(0);

    try {
      if (audioCtxRef.current) audioCtxRef.current.close();
    } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  async function startMeters(stream: MediaStream) {
    stopMeters();

    const AudioCtx =
      (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.55;
    analyserRef.current = analyser;
    source.connect(analyser);

    const buf = new Uint8Array(analyser.fftSize);

    meterRef.current = window.setInterval(() => {
      try {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const lvl = Math.max(0, Math.min(1, (rms - 0.01) / 0.18));
        setAudioLevel(lvl);
      } catch {}
    }, 80);
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
      vib(25);
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
        setStatus("recognizing");

        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const fd = new FormData();
          fd.append("audio", blob, "sample.webm");

let region = "Unknown";

if (navigator.geolocation) {
  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const j = await r.json();
          region = j.address.city || j.address.town || j.address.village || "Unknown";
        } catch {}
        resolve();
      },
      () => resolve(),
      { timeout: 3000 }
    );
  });
}

fd.append("region", region);

          try {
            const mod = await import("@supabase/supabase-js");
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            if (url && anon) {
              const supabase = mod.createClient(url, anon);
              const { data: auth } = await supabase.auth.getUser();
              const userId = auth?.user?.id || "";
              if (userId) fd.append("user_id", userId);
            }
          } catch {}

          const res = await fetch("/api/recognize", { method: "POST", body: fd });
          const data = await res.json();

          const resultType = data?.result_type || "not_found";
          const custom = data?.metadata?.custom_files?.[0] || null;
          const music = data?.metadata?.music?.[0] || null;

          if (resultType === "recognized_world") {
            setTitle(data?.track_title || "Unknown");
            setSubtitle(data?.track_subtitle || "(Released)");
            setTag("RELEASED");
            setSuccess(true);
            vib([40, 30, 80]);
          } else if (resultType === "recognized_unreleased") {
            setTitle(data?.track_title || custom?.title || "Unknown");
            setSubtitle(data?.track_subtitle || "(Private DB)");
            setTag("UNRELEASED");
            setSuccess(true);
            vib([40, 30, 80]);
          } else {
            setTitle("Not found");
            setSubtitle("Try again");
            setTag("NOT FOUND");
            vib([15, 40, 15]);
            triggerFail();
          }
        } catch {
          setTitle("Not found");
          setSubtitle("Server error");
          setTag("NOT FOUND");
          vib([15, 40, 15]);
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

  const badgeBg =
    tag === "UNRELEASED"
      ? "rgba(225,225,225,0.14)"
      : tag === "RELEASED"
      ? "rgba(225,225,225,0.10)"
      : "rgba(225,225,225,0.08)";

  const headerTitleStyle = useMemo(() => {
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
            <button onClick={signInWithGoogle} disabled={loginLoading} style={styles.googleBtn}>
              {loginLoading ? "Connexion…" : "Continue with Google"}
            </button>
            <div style={styles.loginHint}>
              Après login → Home (Scan) + onglets.

Scan the music around you
Discover what the scene is playing
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes techBreath {
          0% { transform: translate(-50%,-50%) scale(0.98); opacity: .18; }
          50% { transform: translate(-50%,-50%) scale(1.10); opacity: .44; }
          100% { transform: translate(-50%,-50%) scale(0.98); opacity: .18; }
        }
        @keyframes k2000 {
          0% { transform: translate(-50%,-50%) rotate(-86deg); opacity: .55; }
          50% { transform: translate(-50%,-50%) rotate(86deg); opacity: 1; }
          100% { transform: translate(-50%,-50%) rotate(-86deg); opacity: .55; }
        }
        @keyframes radarWave {
          0% { transform: translate(-50%,-50%) scale(0.86); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(2.10); opacity: 0; }
        }
        @keyframes scanLine {
          0% { transform: translate(-50%,-50%) translateY(-118px); opacity: 0; }
          18% { opacity: .52; }
          55% { opacity: .18; }
          100% { transform: translate(-50%,-50%) translateY(118px); opacity: 0; }
        }
        @keyframes particleFloat {
          0% { transform: translate(var(--x),var(--y)) scale(var(--s)); opacity: var(--o); }
          100% {
            transform: translate(calc(var(--x)*1.08), calc(var(--y)*1.08))
              scale(calc(var(--s) + 0.22));
            opacity: 0;
          }
        }
        @keyframes pop {
          0% { opacity: 0; }
          20% { opacity: .85; }
          100% { opacity: 0; }
        }
      `}</style>

      {success ? <div style={styles.successFlash} /> : null}
      {failPulse ? <div style={styles.failFlash} /> : null}

      <div style={styles.phone}>
        <div style={styles.top}>
          <div style={headerTitleStyle}>BANGER</div>
          <div style={subStyle}>Find your Un/Released</div>
        </div>

        <div style={styles.center}>
          <div style={styles.haloWrap}>
            <div
              style={{
                ...styles.haloOuter,
                opacity: listening ? 1 : 0,
                transform: listening ? "scale(1.14)" : "scale(0.85)",
              }}
            />
            <div
              style={{
                ...styles.haloInner,
                opacity: listening ? 1 : 0,
                transform: listening ? "scale(1.08)" : "scale(0.92)",
              }}
            />

            {/* LISTENING: K2000 + 3 WAVES + PARTICLES + SCAN LINE */}
            {listening ? (
              <>
                <div
                  style={{
                    ...styles.k2000Ring,
                    animation: "k2000 1.05s ease-in-out infinite",
                    boxShadow:
                      "0 0 22px rgba(0,229,255,0.18), " +
                      "0 0 44px rgba(0,229,255,0.08)",
                  }}
                />
                <div style={{ ...styles.wave1, animation: "radarWave 1.55s ease-out infinite" }} />
                <div style={{ ...styles.wave2, animation: "radarWave 1.55s ease-out infinite", animationDelay: "280ms" }} />
                <div style={{ ...styles.wave3, animation: "radarWave 1.55s ease-out infinite", animationDelay: "560ms" }} />

                <div style={{ ...styles.scanLine, animation: "scanLine 1.25s ease-in-out infinite" }} />

                <div
                  style={{
                    ...styles.listenBreath,
                    opacity: 0.18 + audioLevel * 0.52,
                    animation: "techBreath 1.9s ease-in-out infinite",
                  }}
                />

                
              </>
            ) : null}

            {/* SEARCHING: keep scanner + subtle rings */}
            {recognizing ? (
              <>
                <div
                  style={{
                    ...styles.k2000Ring,
                    animation: "k2000 1.05s ease-in-out infinite",
                    opacity: 0.88,
                  }}
                />
                <div style={{ ...styles.radarRing, animation: "radarWave 1.75s ease-out infinite" }} />
                <div style={{ ...styles.radarRing2, animation: "radarWave 1.75s ease-out infinite", animationDelay: "360ms" }} />
              </>
            ) : null}

            <button
              onClick={startListening}
              disabled={busy}
              style={{
                ...styles.button3D,
                opacity: busy ? 0.92 : 1,
                transform: busy ? "translateY(1px)" : "translateY(0px)",
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
                }}
              />
            </button>
          </div>

          <div style={styles.status}>
            {status === "idle" ? "DROP IT" : null}
            {status === "listening" ? "Listening... (10s)" : null}
            {status === "recognizing" ? "Searching..." : null}
          </div>
        </div>

        <div style={styles.recent}>
          <div style={styles.recentTitle}>RECENTLY FOUND</div>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <div style={styles.cardMain}>{title}</div>
              <div style={{ ...styles.badge, background: badgeBg }}>{tag}</div>
            </div>
            <div style={styles.cardSub}>{subtitle}</div>
          </div>
        </div>

        <BottomNav />
      </div>
    </div>
  );
}

const styles: any = {
  page: {
    minHeight: "100vh",
    background: PAGE_BG,
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
};
// redeploy
