'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Status = 'idle' | 'listening' | 'recognizing';
type Tag = 'UNRELEASED' | 'RELEASED' | 'NOT FOUND';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [title, setTitle] = useState('Adam Ten - Beat Goes On');
  const [subtitle, setSubtitle] = useState('(Maccabi Records)');
  const [tag, setTag] = useState<Tag>('UNRELEASED');

  const [success, setSuccess] = useState(false);

  // outward success wave trigger
  const [successWaveKey, setSuccessWaveKey] = useState(0);

  // recognizing rings tick (slow)
  const [searchWaveTick, setSearchWaveTick] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const listening = status === 'listening';
  const recognizing = status === 'recognizing';
  const busy = status !== 'idle';

  function vib(pattern: number | number[]) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // @ts-ignore
        navigator.vibrate(pattern);
      }
    } catch {}
  }

  function stopRecording() {
    try {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    } catch {}
    timerRef.current = null;

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
  }

  // success lifetime + sync success wave
  useEffect(() => {
    if (!success) return;
    setSuccessWaveKey((k) => k + 1);
    const t = window.setTimeout(() => setSuccess(false), 1100);
    return () => window.clearTimeout(t);
  }, [success]);

  // slow search wave spawner (no flashing)
  useEffect(() => {
    if (!recognizing) return;
    setSearchWaveTick(0);
    const id = window.setInterval(() => setSearchWaveTick((t) => t + 1), 900);
    return () => window.clearInterval(id);
  }, [recognizing]);

  async function startListening() {
    if (busy) return;

    try {
      vib(30); // vibration trigger

      setStatus('listening');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = function (e: BlobEvent) {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async function () {
        // stop mic
        try {
          const tracks = streamRef.current ? streamRef.current.getTracks() : [];
          for (let i = 0; i < tracks.length; i++) tracks[i].stop();
        } catch {}
        streamRef.current = null;

        setStatus('recognizing');

        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const fd = new FormData();
          fd.append('audio', blob, 'sample.webm');

          const res = await fetch('/api/recognize', { method: 'POST', body: fd });
          const data = await res.json();

          const custom =
            data && data.metadata && data.metadata.custom_files
              ? data.metadata.custom_files[0]
              : null;

          const music =
            data && data.metadata && data.metadata.music ? data.metadata.music[0] : null;

          if (custom && custom.title) {
            setTitle(custom.title);
            setSubtitle('(Private DB)');
            setTag('UNRELEASED');
            setSuccess(true);
            vib([40, 30, 80]);
          } else if (music && music.title) {
            const a = music.artists && music.artists[0] ? music.artists[0].name : '';
            setTitle(a ? a + ' - ' + music.title : music.title);
            setSubtitle('(Released)');
            setTag('RELEASED');
            setSuccess(true);
            vib([40, 30, 80]);
          } else {
            setTitle('Not found');
            setSubtitle('Try again');
            setTag('NOT FOUND');
            vib([15, 40, 15]);
          }
        } catch {
          setTitle('Not found');
          setSubtitle('Server error');
          setTag('NOT FOUND');
          vib([15, 40, 15]);
        }

        setStatus('idle');
      };

      mr.start();

      timerRef.current = window.setTimeout(() => {
        stopRecording();
      }, 10000);
    } catch {
      setStatus('idle');
      alert("Micro non autorisé. Active l'accès micro dans le navigateur.");
    }
  }

  const badgeBg =
    tag === 'UNRELEASED'
      ? 'rgba(225,225,225,0.14)'
      : tag === 'RELEASED'
      ? 'rgba(225,225,225,0.10)'
      : 'rgba(225,225,225,0.08)';

  const headerTitleStyle = useMemo(
    () => ({
      ...styles.title,
      background: 'linear-gradient(180deg, rgba(245,245,245,0.98), rgba(160,160,160,0.62))',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      textShadow: '0 1px 0 rgba(255,255,255,0.08)',
    }),
    []
  );

  const subStyle = useMemo(
    () => ({
      ...styles.sub,
      background: 'linear-gradient(180deg, rgba(235,235,235,0.92), rgba(150,150,150,0.70))',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
    }),
    []
  );

  // intensity controls (sync waves with success)
  const searchIntensity = success ? 1 : 0;
  const ringOpacityBase = recognizing ? (success ? 0.26 : 0.16) : 0;
  const ringBorderA = `1px solid rgba(235,235,235,${success ? 0.30 : 0.18})`;
  const ringBorderB = `1px solid rgba(235,235,235,${success ? 0.18 : 0.12})`;

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes successOutwardWave {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; }
          100% { transform: translate(-50%, -50%) scale(2.35); opacity: 0; }
        }

        /* Listening: slow tech breath that dissolves into background */
        @keyframes techBreath {
          0% { transform: translate(-50%, -50%) scale(0.985); opacity: 0.20; }
          50% { transform: translate(-50%, -50%) scale(1.075); opacity: 0.34; }
          100% { transform: translate(-50%, -50%) scale(0.985); opacity: 0.20; }
        }

        /* Recognizing: slow dissolve ring */
        @keyframes dissolveRing {
          0% { transform: translate(-50%, -50%) scale(1); opacity: ${ringOpacityBase}; }
          100% { transform: translate(-50%, -50%) scale(2.55); opacity: 0; }
        }

        @keyframes floatSpecular {
          0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 0.14; }
          100% { transform: translate(-50%, -50%) rotate(14deg); opacity: 0.10; }
        }
      `}</style>

      <div style={styles.phone}>
        <div style={styles.top}>
          <div style={headerTitleStyle}>BANGER</div>
          <div style={subStyle}>Find your Un/Released</div>
        </div>

        <div style={styles.center}>
          <div style={styles.haloWrap}>
            {/* base halos (listening) */}
            <div
              style={{
                ...styles.haloOuter,
                opacity: listening ? 1 : 0,
                transform: listening ? 'scale(1.12)' : 'scale(0.85)',
              }}
            />
            <div
              style={{
                ...styles.haloInner,
                opacity: listening ? 1 : 0,
                transform: listening ? 'scale(1.06)' : 'scale(0.92)',
              }}
            />

            {/* Listening tech breath (dissolves) */}
            {listening ? (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 280,
                  height: 280,
                  borderRadius: 9999,
                  background:
                    'radial-gradient(circle at 50% 50%, rgba(235,235,235,0.18) 0%, rgba(235,235,235,0.06) 36%, rgba(0,0,0,0) 72%)',
                  filter: 'blur(11px)',
                  pointerEvents: 'none',
                  zIndex: 1,
                  animation: 'techBreath 1.9s ease-in-out infinite',
                  mixBlendMode: 'screen',
                }}
              />
            ) : null}

            {/* Recognizing rings: slow + melted */}
            {recognizing ? (
              <>
                <div
                  key={`dr-a-${searchWaveTick}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 220,
                    height: 220,
                    borderRadius: 9999,
                    border: ringBorderA,
                    filter: success ? 'blur(0.6px)' : 'blur(1.0px)',
                    pointerEvents: 'none',
                    zIndex: 1,
                    animation: 'dissolveRing 1.6s cubic-bezier(.2,.8,.2,1) forwards',
                    mixBlendMode: 'screen',
                    boxShadow: success ? '0 0 26px rgba(255,255,255,0.08)' : 'none',
                  }}
                />
                <div
                  key={`dr-b-${searchWaveTick}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 220,
                    height: 220,
                    borderRadius: 9999,
                    border: ringBorderB,
                    filter: success ? 'blur(1.2px)' : 'blur(1.7px)',
                    pointerEvents: 'none',
                    zIndex: 1,
                    animation: 'dissolveRing 1.95s cubic-bezier(.2,.8,.2,1) forwards',
                    animationDelay: '260ms',
                    mixBlendMode: 'screen',
                    boxShadow: success ? '0 0 34px rgba(255,255,255,0.06)' : 'none',
                  }}
                />
              </>
            ) : null}

            {/* Success outward ring */}
            {success ? (
              <div
                key={successWaveKey}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 220,
                  height: 220,
                  borderRadius: 9999,
                  border: '2px solid rgba(255,255,255,0.90)',
                  pointerEvents: 'none',
                  zIndex: 2,
                  animation: 'successOutwardWave 0.62s ease-out forwards',
                  mixBlendMode: 'screen',
                }}
              />
            ) : null}

            <button
              onClick={startListening}
              disabled={busy}
              style={{
                ...styles.button3D,
                opacity: busy ? 0.9 : 1,
                transform: busy ? 'translateY(1px)' : 'translateY(0px)',
                boxShadow: success
                  ? '0 0 84px rgba(255,255,255,0.78), 0 18px 60px rgba(0,0,0,0.78)'
                  : '0 18px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)',
                border: success ? '1px solid rgba(245,245,245,0.34)' : styles.button3D.border,
                transition: 'all 0.26s ease',
              }}
            >
              {/* specular highlight */}
              <div
                style={{
                  ...styles.specular,
                  opacity: busy ? 0.08 : 0.14,
                  animation: 'floatSpecular 1.1s ease-in-out infinite alternate',
                }}
              />

              {/* ✅ strong “B light” synced with success */}
              <div
                style={{
                  position: 'absolute',
                  inset: -40,
                  borderRadius: 9999,
                  pointerEvents: 'none',
                  zIndex: 1,
                  opacity: success ? 1 : 0,
                  transition: 'opacity 0.22s ease',
                  background:
                    'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 28%, rgba(0,0,0,0) 62%)',
                  filter: 'blur(14px)',
                  mixBlendMode: 'screen',
                }}
              />

              <img
                src="/B-logo.png"
                alt="Banger"
                style={{
                  width: 168,
                  height: 168,
                  objectFit: 'contain',
                  display: 'block',
                  // ✅ make B “ignite” on success then return softly
                  filter: success
                    ? 'brightness(2.25) contrast(1.15) drop-shadow(0 0 26px rgba(255,255,255,0.55))'
                    : recognizing
                    ? 'brightness(1.15) contrast(1.05) drop-shadow(0 0 8px rgba(255,255,255,0.12))'
                    : 'brightness(1) contrast(1)',
                  transition: 'all 0.32s ease',
                  zIndex: 2,
                }}
              />
            </button>
          </div>

          <div style={styles.status}>
            {status === 'idle' ? 'DROP IT' : null}
            {status === 'listening' ? 'Listening... (10s)' : null}
            {status === 'recognizing' ? 'Searching...' : null}
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

        <div style={styles.nav}>
          <div style={styles.navOn}>Home</div>
          <div style={styles.navOff}>Library</div>
          <div style={styles.navOff}>Concerts</div>
          <div style={styles.navOff}>Search</div>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  // matte ton-sur-ton black (deeper + smoother)
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(900px 700px at 50% 18%, rgba(18,18,18,1) 0%, rgba(8,8,8,1) 42%, rgba(5,5,5,1) 70%, rgba(2,2,2,1) 100%)',
    color: '#fff',
    display: 'flex',
    justifyContent: 'center',
  },
  phone: {
    width: '100%',
    maxWidth: 420,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  top: {
    paddingTop: 44,
    paddingLeft: 24,
    paddingRight: 24,
    textAlign: 'center',
  },

  title: { marginTop: 6, fontSize: 44, fontWeight: 800, letterSpacing: '0.10em' },
  sub: { marginTop: 12, fontSize: 16, opacity: 0.82, letterSpacing: '0.08em', fontWeight: 800 },

  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 18,
    paddingLeft: 24,
    paddingRight: 24,
  },
  haloWrap: {
    position: 'relative',
    width: 320,
    height: 320,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloOuter: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 9999,
    background: 'rgba(230,230,230,0.08)',
    filter: 'blur(42px)',
    transition: 'all 0.55s ease',
    pointerEvents: 'none',
  },
  haloInner: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 9999,
    background: 'rgba(230,230,230,0.10)',
    filter: 'blur(26px)',
    transition: 'all 0.55s ease',
    pointerEvents: 'none',
  },

  // 3D button (kept, refined)
  button3D: {
    width: 220,
    height: 220,
    borderRadius: 9999,
    border: '1px solid rgba(220,220,220,0.14)',
    background:
      'radial-gradient(220px 220px at 30% 25%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 18%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0.55) 100%), linear-gradient(145deg, #0b0b0b, #040404)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 3,
    position: 'relative',
    overflow: 'hidden',
  },

  specular: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 280,
    height: 180,
    borderRadius: 9999,
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.02) 55%, rgba(255,255,255,0) 70%)',
    filter: 'blur(10px)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  status: {
    fontSize: 15,
    opacity: 0.85,
    letterSpacing: '0.16em',
    fontWeight: 900,
    textTransform: 'uppercase',
  },

  recent: { paddingLeft: 24, paddingRight: 24, paddingBottom: 22 },
  recentTitle: { fontSize: 11, letterSpacing: '0.30em', opacity: 0.55, marginBottom: 10 },
  card: {
    borderRadius: 18,
    border: '1px solid rgba(235,235,235,0.08)',
    background: 'rgba(10,10,10,0.55)',
    padding: 14,
    boxShadow: '0 18px 60px rgba(0,0,0,0.65)',
    backdropFilter: 'blur(10px)',
  },
  cardRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardMain: {
    fontSize: 14,
    fontWeight: 700,
    background: 'linear-gradient(180deg, rgba(235,235,235,0.95), rgba(160,160,160,0.65))',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  badge: {
    fontSize: 10,
    padding: '6px 10px',
    borderRadius: 9999,
    border: '1px solid rgba(235,235,235,0.10)',
    opacity: 0.9,
    letterSpacing: '0.12em',
  },
  cardSub: { marginTop: 8, fontSize: 12, opacity: 0.58 },

  nav: {
    borderTop: '1px solid rgba(235,235,235,0.08)',
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    opacity: 0.82,
    background: 'rgba(0,0,0,0.25)',
    backdropFilter: 'blur(10px)',
  },
  navOn: { opacity: 1, letterSpacing: '0.08em' },
  navOff: { opacity: 0.58, letterSpacing: '0.08em' },
};
