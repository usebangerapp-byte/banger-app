"use client";

import { fmtTitle, fmtArtist } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { ui, C, glass, FLAT } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";
import { VERDICTS, TAGS_SOUND, TAGS_ASK, type Verdict } from "@/lib/feedback";

type Promo = {
  title: string; artist: string | null; note: string | null; url: string | null;
  sender: { id: string; name: string; avatar: string | null };
  liked?: boolean; isRecipient?: boolean;
  feedback?: { verdict: Verdict; tags: string[]; note: string } | null;
};

export default function ListenPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [promo, setPromo] = useState<Promo | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const counted = useRef(false);
  const [liked, setLiked] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [fbBusy, setFbBusy] = useState(false);
  const [fbSent, setFbSent] = useState(false);
  const [fbError, setFbError] = useState("");

  async function sendFeedback() {
    if (!verdict) return;
    setFbBusy(true); setFbError("");
    const r = await authFetch("/api/promo/listen", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "feedback", verdict, tags, note }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (r?.ok && j?.ok) setFbSent(true); else setFbError(j?.error || "Couldn't send. Try again.");
    setFbBusy(false);
  }
  const toggleTag = (t: string) => { setFbSent(false); setTags((l) => l.includes(t) ? l.filter((x) => x !== t) : [...l, t]); };

  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/promo/listen?token=${encodeURIComponent(token)}`).catch(() => null);
      if (!res) { setError("Network error"); return; }
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) { setNeedsLogin(true); return; }
      if (!res.ok || !j.ok) { setError(j.error || "Link not available"); return; }
      setPromo(j); setLiked(!!j.liked);
      if (j.feedback) { setVerdict(j.feedback.verdict); setTags(j.feedback.tags || []); setNote(j.feedback.note || ""); setFbSent(true); }
    })();
  }, [token]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
      if (!counted.current) {
        counted.current = true;
        authFetch("/api/promo/listen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
      }
    } else a.pause();
  }

  function setLike(next: boolean) {
    if (!promo?.isRecipient) return;
    setLiked(next);
    if (next) setBurst((b) => b + 1);
    authFetch("/api/promo/listen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "like", like: next }) }).catch(() => {});
  }
  function onCardTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) setLike(true);   // double-tap = like
    lastTap.current = now;
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader back title="Private track" sub="Sent to you only." />

        {needsLogin && (
          <section style={{ ...ui.card, textAlign: "center", display: "grid", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Sign in to listen</div>
            <button onClick={() => router.push("/")} style={ui.cta}>Sign in</button>
          </section>
        )}

        {error && <section style={{ ...ui.card, color: C.text2, textAlign: "center" }}>{error}</section>}

        {promo && (
          <section onClick={onCardTap} style={{ ...glass, borderRadius: 26, padding: "26px 20px", display: "grid", gap: 18, justifyItems: "center", textAlign: "center", position: "relative", overflow: "hidden" , ...FLAT }}>
            <style>{`@keyframes heartPop { 0% { transform: scale(.3); opacity: 0; } 30% { transform: scale(1.15); opacity: 1; } 70% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }`}</style>
            {burst > 0 && (
              <span key={burst} aria-hidden style={{ position: "absolute", top: "38%", left: "50%", marginLeft: -45, fontSize: 90, lineHeight: 1,
                color: "#e9b844", textShadow: "0 0 30px rgba(233,184,68,0.7)", animation: "heartPop .9s ease-out forwards", pointerEvents: "none" }}>♥</span>
            )}
            <button onClick={(e) => { e.stopPropagation(); router.push(`/dj/${promo.sender.id}`); }}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: C.text2, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ ...ui.avatar, width: 26, height: 26, fontSize: 11 }}>
                {promo.sender.avatar ? <img src={promo.sender.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : promo.sender.name.charAt(0).toUpperCase()}
              </span>
              From {promo.sender.name}
            </button>

            <div style={{ display: "grid", gap: 4, minWidth: 0, maxWidth: "100%" }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>{fmtTitle(promo.title)}</div>
              {promo.artist && <div style={{ fontSize: 15, color: C.text2 }}>{fmtArtist(promo.artist)}</div>}
            </div>

            <button onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={playing ? "Pause" : "Play"} disabled={!promo.url}
              style={{ width: 84, height: 84, borderRadius: "50%", border: "none", cursor: "pointer", background: C.goldGrad,
                color: C.goldInk, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 10px 30px rgba(200,140,15,0.35), inset 0 1px 0 rgba(255,235,160,0.4)" }}>
              {playing
                ? <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginLeft: 4 }}><path d="M7 4.5v15l13-7.5z" /></svg>}
            </button>

            <div style={{ width: "100%", display: "grid", gap: 6 }}>
              <div onClick={seek} style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)", cursor: "pointer", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${dur ? (pos / dur) * 100 : 0}%`, background: C.goldGrad }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.text3, fontVariantNumeric: "tabular-nums" }}>
                <span>{fmt(pos)}</span><span>{dur ? fmt(dur) : "--:--"}</span>
              </div>
            </div>

            {promo.isRecipient && (
              <button onClick={async (e) => {
                e.stopPropagation();
                const r = await authFetch("/api/promo/listen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "download" }) }).catch(() => null);
                const j = await r?.json().catch(() => null);
                if (j?.url) window.location.href = j.url; else alert("Download not available right now.");
              }} aria-label="Download"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 600, border: `1px solid ${C.glassBorder}`, background: "rgba(255,255,255,0.06)", color: C.text2 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                Download
              </button>
            )}
            {promo.isRecipient && (
              <button onClick={(e) => { e.stopPropagation(); setLike(!liked); }} aria-label={liked ? "Unlike" : "Like"}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 600, border: liked ? "1px solid transparent" : `1px solid ${C.glassBorder}`,
                  background: liked ? "rgba(233,184,68,0.18)" : "rgba(255,255,255,0.06)", color: liked ? C.gold : C.text2 }}>
                <span style={{ fontSize: 16 }}>{liked ? "♥" : "♡"}</span>{liked ? "Liked" : "Like"}
              </button>
            )}

            {promo.note && <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.5, whiteSpace: "pre-line" }}>“{promo.note}”</div>}

            {promo.url && (
              <audio ref={audioRef} src={promo.url} preload="metadata" 
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)} />
            )}
          </section>
        )}

        {/* ── Feedback to the producer (recipient only) ── */}
        {promo?.isRecipient && (
          <section style={{ ...glass, borderRadius: 24, padding: "18px 16px", display: "grid", gap: 14 , ...FLAT }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text3 }}>Your feedback</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
              {(Object.keys(VERDICTS) as Verdict[]).map((v) => {
                const on = verdict === v;
                return (
                  <button key={v} onClick={() => { setVerdict(v); setFbSent(false); }}
                    style={{ display: "grid", gap: 4, justifyItems: "center", padding: "12px 6px", borderRadius: 18, cursor: "pointer", fontFamily: "inherit",
                      border: on ? "1px solid transparent" : `1px solid ${C.glassBorder}`,
                      background: on ? C.goldGrad : "rgba(255,255,255,0.05)", color: on ? C.goldInk : "#fff" }}>
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{VERDICTS[v].emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{VERDICTS[v].label}</span>
                  </button>
                );
              })}
            </div>
            {[TAGS_SOUND, TAGS_ASK].map((group, gi) => (
              <div key={gi} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {group.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button key={t} onClick={() => toggleTag(t)}
                      style={{ ...ui.pillSmall, padding: "7px 12px", fontSize: 13,
                        color: on ? C.gold : C.text2, background: on ? "rgba(245,207,104,0.14)" : "rgba(255,255,255,0.05)",
                        borderColor: on ? "rgba(245,207,104,0.40)" : C.glassBorder }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            ))}
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setFbSent(false); }} rows={2} maxLength={600}
              placeholder="Add a note (optional)" style={{ ...ui.input, resize: "vertical", minHeight: 60, fontFamily: "inherit" }} />
            {fbError && <div style={{ fontSize: 13, color: C.danger }}>{fbError}</div>}
            <button onClick={sendFeedback} disabled={!verdict || fbBusy || fbSent}
              style={verdict && !fbSent ? ui.cta : { ...ui.cta, background: "rgba(255,255,255,0.10)", color: fbSent ? C.rel : "rgba(255,255,255,0.45)", boxShadow: "none" }}>
              {fbBusy ? "Sending…" : fbSent ? "Feedback sent ✓" : "Send feedback"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
