"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import { authFetch } from "@/lib/authFetch";
import { recognizeAudio } from "@/lib/scan/recognizeAudio";
import { mapRecognizeResult } from "@/lib/scan/resultState";
import { getRegion } from "@/lib/scan/getRegion";
import { ui, C, glass, tag, TAG_TEXT } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";
import MarqueeText from "@/components/MarqueeText";
import LinkScan from "@/components/LinkScan";

const SAMPLE_MS = 10_000;   // listen 10 s
const GAP_MS = 40_000;      // then wait before the next listen (≈ one scan per 50 s)

type Track = { title: string; artist: string; result_type: string; at: number };
type SavedSet = { id: string; name: string | null; started_at: string; ended_at: string | null;
  tracks: { position: number; title: string; artist: string | null; result_type: string; detected_at: string }[] };

const keyOf = (t: string) => t.toLowerCase().replace(/\s*\((original|extended)( mix)?\)/g, "").replace(/\s+/g, " ").trim();
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

function tracklistText(date: Date, tracks: { title: string; artist?: string | null }[]) {
  const head = `BANGER set · ${date.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })}`;
  const lines = tracks.map((t, i) => `${String(i + 1).padStart(2, "0")}. ${t.artist ? `${t.artist} - ` : ""}${t.title}`);
  return [head, "", ...lines, "", "usebanger.com"].join("\n");
}

export default function SetModePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [step, setStep] = useState<"listening" | "identifying" | "waiting">("waiting");
  const [nextIn, setNextIn] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState("");
  const [hiddenWarn, setHiddenWarn] = useState(false);
  const [history, setHistory] = useState<SavedSet[]>([]);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [mode, setMode] = useState<"live" | "link">("live");

  const runningRef = useRef(false);
  const setIdRef = useRef("");
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const wakeRef = useRef<any>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const wakeTimer = useRef<((v?: unknown) => void) | null>(null);

  useEffect(() => {
    (async () => {
      if ((await getBrowserRole()) !== "pro") { router.replace("/upgrade"); return; }
      setReady(true);
      loadHistory();
    })();
    return () => { stopEverything(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const onVis = () => {
      if (document.visibilityState === "hidden") setHiddenWarn(true);
      else if (runningRef.current) { requestWake(); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [phase]);

  async function loadHistory() {
    const r = await authFetch("/api/sets").catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.sets) setHistory(j.sets);
  }

  async function requestWake() {
    try { wakeRef.current = await (navigator as any).wakeLock?.request("screen"); } catch {}
  }

  function sleep(ms: number) {
    return new Promise((resolve) => {
      const id = window.setTimeout(resolve, ms);
      wakeTimer.current = () => { window.clearTimeout(id); resolve(undefined); };
    });
  }

  function recordOnce(stream: MediaStream): Promise<{ blob: Blob; mime: string }> {
    return new Promise((resolve, reject) => {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      mr.onstop = () => resolve({ blob: new Blob(chunks, { type: mime }), mime });
      mr.onerror = () => reject(new Error("Recorder error"));
      mr.start();
      window.setTimeout(() => { if (mr.state !== "inactive") mr.stop(); }, SAMPLE_MS);
    });
  }

  async function loop(region: string) {
    let position = 0;
    while (runningRef.current) {
      const stream = streamRef.current;
      if (!stream) break;
      try {
        setStep("listening");
        const { blob, mime } = await recordOnce(stream);
        if (!runningRef.current) break;
        setStep("identifying");
        const data = await recognizeAudio(blob, mime, region, { noLog: true });
        const m = mapRecognizeResult(data as any);
        if (m.success && m.title && m.title !== "Unknown") {
          const k = keyOf(m.title);
          if (!seenRef.current.has(k)) {
            seenRef.current.add(k);
            position += 1;
            const artist = m.subtitle && m.subtitle !== "(Released)" ? m.subtitle : "";
            const result_type = m.tag === "UNRELEASED" ? "recognized_unreleased" : "recognized_world";
            setTracks((cur) => [...cur, { title: m.title, artist, result_type, at: Date.now() }]);
            try { navigator.vibrate?.([14, 50, 14]); } catch {}
            authFetch("/api/sets", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "track", set_id: setIdRef.current, position, title: m.title, artist, result_type, region }) }).catch(() => {});
          }
        }
      } catch { /* one failed listen doesn't stop the set */ }
      if (!runningRef.current) break;
      setStep("waiting");
      const until = Date.now() + GAP_MS;
      const tick = window.setInterval(() => setNextIn(Math.max(0, until - Date.now())), 500);
      await sleep(GAP_MS);
      window.clearInterval(tick);
    }
  }

  async function start() {
    setError(""); setTracks([]); seenRef.current = new Set(); setHiddenWarn(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      streamRef.current = stream;
    } catch { setError("Microphone access is needed for Set mode."); return; }
    const r = await authFetch("/api/sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) { setError(j?.error || "Couldn't start the set."); stopEverything(); return; }
    setIdRef.current = j.id;
    runningRef.current = true;
    setStartedAt(Date.now()); setNow(Date.now()); setPhase("running");
    await requestWake();
    loop(await getRegion());
  }

  function stopEverything() {
    runningRef.current = false;
    wakeTimer.current?.();
    try { if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    try { wakeRef.current?.release?.(); } catch {}
  }

  async function stop() {
    stopEverything();
    if (setIdRef.current) {
      await authFetch("/api/sets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", set_id: setIdRef.current }) }).catch(() => {});
    }
    setPhase("done");
    loadHistory();
  }

  async function share(text: string, id: string) {
    try {
      if ((navigator as any).share) { await (navigator as any).share({ text }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(""), 1800); } catch {}
  }
  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(""), 1800); } catch {}
  }

  async function removeSet(id: string) {
    await authFetch("/api/sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", set_id: id }) }).catch(() => {});
    setHistory((h) => h.filter((s) => s.id !== id));
  }

  if (!ready) return <main style={ui.page} />;

  const liveText = tracklistText(new Date(startedAt || Date.now()), tracks);

  return (
    <main style={ui.page}>
      <style>{`
        @keyframes setPulse { 0%,100% { transform: scale(.94); opacity: .55; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes setIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
      <div style={ui.shell}>
        <PageHeader back title="Get my tracklist" sub="Fast auto scan" />

        {phase !== "running" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
            {(["live", "link"] as const).map((m) => {
              const on = mode === m;
              return (
                <button key={m} onClick={() => setMode(m)} aria-pressed={on}
                  style={{ padding: "12px 6px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                    border: `1px solid ${on ? "rgba(245,207,104,0.55)" : C.glassBorder}`,
                    background: on ? "rgba(245,207,104,0.14)" : "rgba(255,255,255,0.06)", color: on ? C.gold : "#fff" }}>
                  {m === "live" ? "🎧 Live set" : "🔗 From a link"}
                </button>
              );
            })}
          </div>
        )}

        {mode === "link" && <LinkScan textOf={(rows) => tracklistText(new Date(), rows)} />}

        {mode === "live" && (<>

        {/* ── Idle ── */}
        {phase === "idle" && (
          <section style={{ ...ui.card, display: "grid", gap: 14, justifyItems: "center", textAlign: "center", padding: "26px 20px" }}>
            <div style={{ fontSize: 15, color: C.text2, lineHeight: 1.5 }}>
              Put your phone near the booth and keep BANGER open. It listens about once a minute and adds every track it recognises.
            </div>
            <button onClick={start} style={ui.cta}>Start set</button>
            {error && <div style={{ fontSize: 13, color: C.danger }}>{error}</div>}
          </section>
        )}

        {/* ── Running ── */}
        {phase === "running" && (
          <section style={{ ...ui.card, display: "grid", gap: 14, justifyItems: "center", textAlign: "center", padding: "24px 20px" }}>
            <div style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(226,173,46,0.45), rgba(226,173,46,0.08) 55%, transparent 70%)",
                animation: step === "waiting" ? "none" : "setPulse 1.4s ease-in-out infinite", opacity: step === "waiting" ? 0.35 : 1 }} />
              <div style={{ position: "relative", fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(now - startedAt)}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {step === "listening" ? "Listening…" : step === "identifying" ? "Identifying…" : `Next listen in ${Math.ceil(nextIn / 1000)}s`}
            </div>
            <div style={{ fontSize: 13, color: C.text3 }}>{tracks.length} track{tracks.length === 1 ? "" : "s"} found</div>
            {hiddenWarn && <div style={{ fontSize: 13, color: C.gold }}>Keep BANGER open on screen so it can keep listening.</div>}
            <button onClick={stop} style={{ ...ui.pill, padding: "12px 26px", fontSize: 15 }}>End set</button>
          </section>
        )}

        {/* ── Live / finished tracklist ── */}
        {phase !== "idle" && (
          <section style={{ ...ui.section, paddingBottom: 6 }}>
            <div style={{ ...ui.label, display: "flex", justifyContent: "space-between" }}>
              <span>Tracklist</span>
              {phase === "done" && tracks.length > 0 && (
                <span style={{ display: "flex", gap: 14 }}>
                  <button onClick={() => copy(liveText, "live")} style={linkBtn}>{copied === "live" ? "Copied ✓" : "Copy"}</button>
                  <button onClick={() => share(liveText, "live")} style={linkBtn}>Share</button>
                </span>
              )}
            </div>
            {tracks.length === 0 ? (
              <div style={ui.empty}>{phase === "running" ? "The first track will appear here." : "No track recognised this time."}</div>
            ) : tracks.map((t, i) => (
              <div key={t.title + i} style={{ ...ui.row, animation: "setIn .4s ease-out" }}>
                <span style={ui.rank}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MarqueeText text={t.title} style={ui.rowTitle} />
                  <div style={ui.rowSub}>{t.artist ? `${t.artist} · ` : ""}{fmt(t.at - startedAt)}</div>
                </div>
                {t.result_type === "recognized_unreleased" && <span style={tag("unrel")}>{TAG_TEXT.unrel}</span>}
              </div>
            ))}
            {phase === "done" && (
              <button onClick={() => { setPhase("idle"); setTracks([]); }} style={ui.more}>New set</button>
            )}
          </section>
        )}

        {/* ── Past sets ── */}
        {phase !== "running" && history.filter((s) => s.id !== (phase === "done" ? setIdRef.current : "")).length > 0 && (
          <section style={{ ...ui.section, paddingBottom: 4 }}>
            <div style={ui.label}>Past sets</div>
            {history.filter((s) => s.id !== (phase === "done" ? setIdRef.current : "")).map((s) => {
              const d = new Date(s.started_at);
              const open = openSet === s.id;
              const text = tracklistText(d, s.tracks);
              return (
                <div key={s.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div onClick={() => setOpenSet(open ? null : s.id)} style={{ ...ui.row, borderBottom: "none", cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={ui.rowTitle}>{s.name || d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</div>
                      <div style={ui.rowSub}>
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {s.ended_at ? ` · ${fmt(new Date(s.ended_at).getTime() - d.getTime())}` : ""} · {s.tracks.length} tracks
                      </div>
                    </div>
                    <span style={{ color: C.text4, fontSize: 18 }}>{open ? "–" : "›"}</span>
                  </div>
                  {open && (
                    <div style={{ display: "grid", gap: 8, padding: "0 0 14px" }}>
                      {s.tracks.length === 0 && <div style={{ fontSize: 13, color: C.text3 }}>No track recognised.</div>}
                      {s.tracks.map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, minWidth: 0 }}>
                          <span style={{ color: C.gold, fontWeight: 700, width: 20, flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.artist ? `${t.artist} - ` : ""}{t.title}
                          </span>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {s.tracks.length > 0 && <button onClick={() => copy(text, s.id)} style={ui.pillSmall}>{copied === s.id ? "Copied ✓" : "Copy"}</button>}
                        {s.tracks.length > 0 && <button onClick={() => share(text, s.id)} style={ui.pillSmall}>Share</button>}
                        <button onClick={() => removeSet(s.id)} style={{ ...ui.pillSmall, color: C.danger }}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
        </>)}
      </div>
    </main>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, color: C.gold, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
