"use client";

import { fmtTitle, fmtArtist } from "@/lib/format";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import PageHeader from "@/components/PageHeader";
import { openPro } from "@/components/ProSheet";
import { fmtTime, youtubeId, type SetTrack } from "@/lib/setlists";
import { trackHref } from "@/lib/preview";
import { ui, C, glass, tag, TAG_TEXT } from "@/lib/ui";
import SetScanner, { type DraftRow } from "@/components/SetScanner";
import { parseTime } from "@/lib/setlists";

type Data = {
  set: { id: string; title: string; venue: string | null; played_on: string | null; source_url: string; cover_url: string | null; unlocked_at: string | null };
  tracks: (SetTrack & { named?: boolean })[]; fires: number[]; total: number; known: number;
  likes: number; followers: number; liked: boolean; following: boolean; credits: string[]; pro: boolean; admin: boolean;
};

/* ── YouTube player (official IFrame API: play, seek, current time) ── */
let ytReady: Promise<any> | null = null;
function loadYT(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!ytReady) ytReady = new Promise((res) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); res(w.YT); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  });
  return ytReady;
}

export default function SetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [naming, setNaming] = useState<SetTrack | null>(null);
  const [flash, setFlash] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [rowEdit, setRowEdit] = useState<SetTrack | null>(null);
  const [setEdit, setSetEdit] = useState(false);
  const player = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(() => {
    authFetch(`/api/setlists/${id}`, { cache: "no-store" }).then((r) => r.json())
      .then((j) => { if (j?.ok) setD(j); else setError(j?.error || "Set not found"); }).catch(() => setError("Network error"));
  }, [id]);
  useEffect(() => { reload(); }, [reload]);
  const refreshed = useRef(false);
  useEffect(() => {
    if (!d || refreshed.current) return;
    if (!d.tracks.some((t: any) => t.title && t.released == null && !t.locked)) return;
    refreshed.current = true;
    authFetch(`/api/setlists/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh_status" }) })
      .then(() => reload()).catch(() => {});
  }, [d, id, reload]);

  const yt = d ? youtubeId(d.set.source_url) : null;
  useEffect(() => {
    if (!yt || !boxRef.current) return;
    let alive = true, timer: any;
    loadYT().then((YT) => {
      if (!alive || !boxRef.current) return;
      player.current = new YT.Player(boxRef.current, {
        videoId: yt, width: "100%", height: "100%", playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: { onReady: (e: any) => {
          setDur(e.target.getDuration?.() || 0);
          // opened from "Played in": jump to that minute
          const t = Number(new URLSearchParams(window.location.search).get("t"));
          if (t > 0) { try { e.target.seekTo(t, true); setNow(t); } catch {} }
        } },
      });
      timer = setInterval(() => { try { const t = player.current?.getCurrentTime?.(); if (typeof t === "number") setNow(t); if (!dur) setDur(player.current?.getDuration?.() || 0); } catch {} }, 1000);
    }).catch(() => {});
    return () => { alive = false; clearInterval(timer); try { player.current?.destroy?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt]);

  const seek = (sec: number | null) => { if (sec == null) return; try { player.current?.seekTo?.(sec, true); player.current?.playVideo?.(); setNow(sec); } catch {} };
  const say = (t: string) => { setFlash(t); setTimeout(() => setFlash(""), 2200); };
  const act = async (body: any) => {
    const r = await authFetch(`/api/setlists/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (r?.status === 401) { router.push("/"); return null; }
    if (r?.status === 402) { openPro("sets"); return null; }
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { say(j?.error || "Couldn't save"); return null; }
    return j;
  };

  if (error) return <main style={ui.page}><div style={ui.shell}><PageHeader back title="Set" /><div style={ui.empty}>{error}</div></div></main>;
  if (!d) return <main style={ui.page}><div style={ui.shell}><PageHeader back title="Set" /><div style={ui.empty}>Loading…</div></div></main>;

  // the track playing right now (by start times)
  const current = [...d.tracks].reverse().find((t) => t.start_sec != null && now >= (t.start_sec as number));
  const total = dur || Math.max(...d.tracks.map((t) => (t.start_sec || 0) + 300), 3600);
  const heat = Array.from({ length: 24 }, (_, i) => d.fires.filter((f) => Math.floor((f / total) * 24) === i).length);
  const heatMax = Math.max(1, ...heat);
  const lockedN = d.tracks.filter((t) => t.locked).length;
  const pct = d.total ? Math.round((d.known / d.total) * 100) : 0;
  const pill = (on?: boolean): React.CSSProperties => ({ flex: 1, height: 44, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
    border: `1px solid ${on ? "rgba(245,207,104,0.45)" : C.glassBorder}`, background: on ? "rgba(245,207,104,0.14)" : "rgba(255,255,255,0.06)", color: on ? C.gold : "#fff" });
  const big: React.CSSProperties = { height: 52, borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: "rgba(255,255,255,0.06)", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" };

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader back title="Set" />

        {flash && <div style={{ ...ui.toast }}>{flash}</div>}

        <section style={{ ...glass, borderRadius: 22, overflow: "hidden", padding: 0 }}>
          <div style={{ aspectRatio: "16 / 9", background: "#000" }}>
            {yt ? <div ref={boxRef} style={{ width: "100%", height: "100%" }} />
              : <a href={d.set.source_url} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", height: "100%", color: C.gold, textDecoration: "none", fontWeight: 600 }}>Open the set ↗</a>}
          </div>
          <div style={{ padding: "14px 16px 16px", display: "grid", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmtArtist(d.set.title)}</div>
              {d.admin && (
                <button onClick={() => setSetEdit(true)} aria-label="Edit the set"
                  style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, border: `1px solid ${C.glassBorder}`, background: "rgba(255,255,255,0.06)", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
                </button>
              )}
            </div>
            <div style={{ fontSize: 14, color: C.text2 }}>{[d.set.venue, d.set.played_on && new Date(d.set.played_on).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: d.set.unlocked_at ? C.rel : C.goldGrad }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: d.set.unlocked_at ? C.rel : C.gold }}>{d.set.unlocked_at ? "✅ Unlocked" : `${d.known}/${d.total} known`}</div>
            </div>
          </div>
        </section>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={pill(d.liked)} onClick={async () => { const j = await act({ action: "like" }); if (j) setD({ ...d, liked: j.on, likes: d.likes + (j.on ? 1 : -1) }); }}>♥ {d.likes || "Like"}</button>
          {!d.set.unlocked_at && <button style={pill(d.following)} onClick={async () => { const j = await act({ action: "follow" }); if (j) { setD({ ...d, following: j.on }); if (j.on) say("We'll tell you when it's unlocked"); } }}>{d.following ? "Following" : "Follow the set"}</button>}
          <button style={pill()} onClick={() => { const url = window.location.href; (navigator as any).share ? (navigator as any).share({ title: d.set.title, url }).catch(() => {}) : navigator.clipboard?.writeText(url).then(() => say("Link copied")); }}>Share</button>
        </div>

        {/* Timeline: gold marks = IDs, brighter strip = the moments people loved */}
        <section style={{ ...glass, borderRadius: 22, padding: "14px 16px", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.text3 }}><span>{current ? `Now · ${current.title ? current.title : "ID"}` : "Now"} · {fmtTime(now)}</span><span>{fmtTime(total)}</span></div>
          <div style={{ position: "relative", height: 30 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 13, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
            <div style={{ position: "absolute", left: 0, width: `${Math.min(100, (now / total) * 100)}%`, top: 13, height: 4, borderRadius: 2, background: "#fff" }} />
            {d.tracks.filter((t) => t.start_sec != null).map((t) => (
              <button key={t.id} aria-label={`Go to ${fmtTime(t.start_sec)}`} onClick={() => seek(t.start_sec)}
                style={{ position: "absolute", left: `calc(${Math.min(100, ((t.start_sec as number) / total) * 100)}% - 4px)`, top: t.title || t.locked ? 6 : 3, width: t.title || t.locked ? 3 : 9,
                  height: t.title || t.locked ? 22 : 26, borderRadius: 3, border: "none", padding: 0, cursor: "pointer",
                  background: !t.locked && !t.title ? C.gold : "rgba(255,255,255,0.35)" }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))", gap: 2, height: 10 }} aria-label="Heat of the set">
            {heat.map((h, i) => <span key={i} style={{ borderRadius: 2, background: `rgba(245,207,104,${0.08 + 0.92 * (h / heatMax)})` }} />)}
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>Gold marks = IDs still unknown · brighter strip = the moments people loved</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <button style={big} onClick={async () => { if (await act({ action: "fire", at_sec: Math.floor(now) })) { setD({ ...d, fires: [...d.fires, Math.floor(now)] }); say("🔥"); } }}>🔥 Fire</button>
            <button style={big} onClick={async () => {
              const t = current; if (!t || t.title || t.locked) { say(t?.locked ? "Unlock the full tracklist to ask" : "This track is already known"); if (t?.locked) openPro("sets"); return; }
              const j = await act({ action: "ask", track_id: t.id });
              if (j) setD({ ...d, tracks: d.tracks.map((x) => x.id === t.id ? { ...x, asked: j.on, asks: (x.asks || 0) + (j.on ? 1 : -1) } : x) });
            }}>❓ ID?</button>
            <button style={{ ...big, border: "1px solid transparent", background: C.goldGrad, color: C.goldInk, fontWeight: 800 }} onClick={() => {
              const t = current && !current.title && !current.locked ? current : d.tracks.find((x) => !x.title && !x.locked);
              if (!t) { say("No ID to name here"); return; }
              setNaming(t);
            }}>✏️ Name it</button>
          </div>
        </section>

        {d.admin && yt && !scanOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => setScanOpen(true)} style={{ ...ui.cta, padding: "12px 8px", fontSize: 14 }}>⬇ Tracklist &amp; scan</button>
            <button onClick={() => setScanOpen(true)} style={{ ...ui.pill, justifyContent: "center", fontSize: 14 }}>✎ Edit tracklist</button>
          </div>
        )}
        {scanOpen && (
          <SetScanner player={player} duration={dur} sourceUrl={d.set.source_url}
            initial={d.tracks.filter((t) => !t.locked).map((t): DraftRow => ({ start: fmtTime(t.start_sec) || "0:00", title: t.title || "", artist: t.artist || "", id: !t.title }))}
            onClose={() => setScanOpen(false)}
            onSave={async (rows) => {
              const j = await act({ action: "replace_tracks", rows: rows.map((r) => ({ start_sec: parseTime(r.start), title: r.id ? null : r.title, artist: r.id ? null : r.artist })) });
              if (j) { say(`Tracklist saved · ${j.count} tracks`); reload(); return true; }
              return false;
            }} />
        )}

        <div style={{ ...ui.label, padding: "4px 4px 0" }}>Tracklist</div>
        <section style={{ ...glass, borderRadius: 22, padding: "0 16px", display: "grid", gridTemplateColumns: "minmax(0,1fr)" }}>
          {d.tracks.length === 0 && <div style={{ ...ui.empty, padding: "18px 0" }}>{d.admin ? "No tracklist yet — tap “Scan this set”." : "The tracklist is coming soon."}</div>}
          {d.tracks.map((t, i) => t.locked ? (
            <button key={t.id} onClick={() => openPro("sets")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 0", background: "none", border: "none", borderBottom: `1px solid ${C.lineSoft}`, cursor: "pointer", fontFamily: "inherit", color: "#fff", textAlign: "left" }}>
              <span style={{ ...ui.rank, width: 22 }}>{String(t.position).padStart(2, "0")}</span>
              <span style={{ width: 52, fontSize: 13, color: C.text3 }}>{fmtTime(t.start_sec)}</span>
              <span style={{ flex: 1, filter: "blur(4px)", opacity: 0.6 }} aria-hidden><span style={{ display: "block", height: 12, width: "65%", borderRadius: 6, background: "rgba(255,255,255,0.45)" }} /></span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.gold }}>🔒 Pro</span>
            </button>
          ) : (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", minWidth: 0, gap: 10, padding: "13px 0", borderBottom: i === d.tracks.length - 1 && !lockedN ? "none" : `1px solid ${C.lineSoft}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, cursor: t.start_sec != null ? "pointer" : "default" }} onClick={() => seek(t.start_sec)}>
                <span style={{ ...ui.rank, width: 22 }}>{String(t.position).padStart(2, "0")}</span>
                <span style={{ width: 52, fontSize: 13, color: C.text3, fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.start_sec)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {t.title ? <>
                    <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", overflowWrap: "anywhere" }}>{fmtTitle(t.title)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: C.text2 }}>{[t.artist ? fmtArtist(t.artist) : "", t.fires ? `🔥 ${t.fires}` : ""].filter(Boolean).join(" · ")}</span>
                    </div>
                    {(t as any).released !== true && !(t as any).scannable && ((t as any).wanted > 0 || d.pro) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                        {(t as any).wanted > 0 && <span style={{ fontSize: 12, color: C.gold }}>Wanted by {(t as any).wanted} DJ{(t as any).wanted > 1 ? "s" : ""}</span>}
                        {d.pro && <button onClick={() => router.push(`/bpro?title=${encodeURIComponent(t.title || "")}&artist=${encodeURIComponent(t.artist || "")}`)}
                          style={{ ...ui.pillSmall, padding: "5px 10px", fontSize: 12, color: C.goldInk, background: C.goldGrad, border: "1px solid transparent" }}>Make scannable</button>}
                      </div>
                    )}
                  </> : <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>ID</div>
                    <div style={{ fontSize: 13, color: C.text2 }}>{[t.asks ? `${t.asks} want to know` : "", t.suggestions?.length ? `${t.suggestions.length} name${t.suggestions.length > 1 ? "s" : ""}` : "", t.fires ? `🔥 ${t.fires}` : ""].filter(Boolean).join(" · ") || "Nobody knows yet"}</div>
                  </>}
                </div>
                {d.admin && (
                  <button onClick={(e) => { e.stopPropagation(); setRowEdit(t); }} aria-label="Edit this row"
                    style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, border: `1px solid ${C.glassBorder}`, background: "rgba(255,255,255,0.06)", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
                  </button>
                )}
                {t.title && (t as any).released != null && (
                  <span style={{ ...tag((t as any).released ? "rel" : "unrel"), flexShrink: 0 }}>{(t as any).released ? TAG_TEXT.rel : TAG_TEXT.unrel}</span>
                )}
                {t.title
                  ? <Link href={trackHref(t.title, t.artist)} onClick={(e) => e.stopPropagation()} style={{ ...ui.pillSmall }}>Info</Link>
                  : <button onClick={(e) => { e.stopPropagation(); setNaming(t); }} style={{ ...ui.pillSmall, color: C.gold, borderColor: "rgba(245,207,104,0.35)" }}>✏️ Name it</button>}
              </div>
              {!t.title && t.suggestions?.map((s) => (
                <div key={s.key} style={{ marginLeft: 86, padding: "10px 12px", borderRadius: 14, background: "rgba(245,207,104,0.08)", border: "1px solid rgba(245,207,104,0.25)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtTitle(s.title)} — {fmtArtist(s.artist)}</div>
                    <div style={{ fontSize: 12, color: C.text3 }}>{`suggested by ${s.count} DJ${s.count > 1 ? "s" : ""}`}{(s.weight || 0) >= 2 ? " · waiting for validation" : ""}{d.admin && s.verified ? " · ✓ found in catalogues" : d.admin ? " · not found in catalogues" : ""}</div>
                  </div>
                  {!s.mine && <button onClick={async () => { if (await act({ action: "suggest", track_id: t.id, title: s.title, artist: s.artist })) { say("Confirmed 👍"); reload(); } }} style={{ ...ui.pillSmall }}>👍 Confirm</button>}
                  {d.admin && <>
                    <button onClick={async () => { if (await act({ action: "validate", track_id: t.id, key: s.key })) { say("Validated ✓"); reload(); } }} style={{ ...ui.pillSmall, color: C.goldInk, background: C.goldGrad, border: "1px solid transparent" }}>Validate</button>
                    <button onClick={async () => { if (await act({ action: "reject", track_id: t.id, key: s.key })) reload(); }} style={{ ...ui.pillSmall, color: C.text3 }}>Reject</button>
                  </>}
                </div>
              ))}
            </div>
          ))}
          {lockedN > 0 && (
            <div style={{ padding: "12px 0 16px", display: "grid", gap: 10, justifyItems: "center" }}>
              <button onClick={() => openPro("sets")} style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(245,207,104,0.35)", background: "rgba(245,207,104,0.10)", color: C.gold, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                🔒 Unlock the full tracklist · Pro
              </button>
            </div>
          )}
        </section>

        {d.credits.length > 0 && <div style={{ fontSize: 13, color: C.text3, padding: "0 4px" }}>Unlocked by {d.credits.join(", ")}</div>}
        {d.admin && <button onClick={async () => { if (confirm("Delete this set?") && await act({ action: "delete" })) router.push("/sets"); }} style={{ ...ui.more, color: C.danger }}>Delete set</button>}
      </div>

      {setEdit && <SetSheet set={d.set} onClose={() => setSetEdit(false)} act={act} onDone={(m) => { setSetEdit(false); say(m); reload(); }} />}
      {rowEdit && <RowSheet track={rowEdit} onClose={() => setRowEdit(null)} act={act} onDone={(m) => { setRowEdit(null); say(m); reload(); }} />}
      {naming && <NameSheet track={naming} isAdmin={d.admin} onClose={() => setNaming(null)} onDone={(msg) => { setNaming(null); say(msg); reload(); }} act={act} />}
    </main>
  );
}

function NameSheet({ track, isAdmin, onClose, onDone, act }: { track: SetTrack; isAdmin: boolean; onClose: () => void; onDone: (m: string) => void; act: (b: any) => Promise<any> }) {
  const [title, setTitle] = useState(""); const [artist, setArtist] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...glass, background: "rgba(20,20,20,0.97)", width: "100%", maxWidth: 520, borderRadius: "24px 24px 0 0", padding: "18px 18px calc(22px + env(safe-area-inset-bottom))", display: "grid", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>✏️ Name this ID · {fmtTime(track.start_sec)}</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ ...ui.input, fontWeight: 600 }} />
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" style={ui.input} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ ...ui.pill, flex: 1, justifyContent: "center" }}>Cancel</button>
          <button disabled={busy || !title.trim() || !artist.trim()} onClick={async () => {
            setBusy(true);
            const j = await act(isAdmin ? { action: "name", track_id: track.id, title, artist } : { action: "suggest", track_id: track.id, title, artist });
            setBusy(false);
            if (j) onDone(isAdmin ? "Named ✓" : "Thanks — your name is in");
          }} style={{ ...ui.cta, flex: 1 }}>{busy ? "…" : isAdmin ? "Validate" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}

/** Admins: fix one row of the tracklist — time, artist, title — or remove it. */
function RowSheet({ track, onClose, onDone, act }: { track: SetTrack; onClose: () => void; onDone: (m: string) => void; act: (b: any) => Promise<any> }) {
  const [time, setTime] = useState(fmtTime(track.start_sec) || "");
  const [artist, setArtist] = useState(track.artist || "");
  const [title, setTitle] = useState(track.title || "");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const badTime = time.trim() !== "" && parseTime(time) == null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...glass, background: "rgba(20,20,20,0.97)", width: "100%", maxWidth: 520, borderRadius: "24px 24px 0 0", padding: "18px 18px calc(22px + env(safe-area-inset-bottom))", display: "grid", gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Edit track {String(track.position).padStart(2, "0")}</div>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: C.text3 }}>Start time (m:ss or h:mm:ss)
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="12:25" inputMode="numeric" style={{ ...ui.input, borderColor: badTime ? C.danger : undefined }} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: C.text3 }}>Artist
          <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" style={ui.input} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: C.text3 }}>Title — leave empty to make it an ID
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ ...ui.input, fontWeight: 600 }} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...ui.pill, flex: 1, justifyContent: "center" }}>Cancel</button>
          <button disabled={busy || badTime} onClick={async () => {
            setBusy(true);
            const j = await act({ action: "edit_track", track_id: track.id, start_sec: time.trim() ? parseTime(time) : null, title, artist });
            setBusy(false); if (j) onDone("Saved ✓");
          }} style={{ ...ui.cta, flex: 1 }}>{busy ? "…" : "Save"}</button>
        </div>
        <button onClick={async () => {
          if (!confirmDel) { setConfirmDel(true); return; }
          setBusy(true); const j = await act({ action: "delete_track", track_id: track.id }); setBusy(false);
          if (j) onDone("Removed");
        }} style={{ ...ui.more, color: C.danger }}>{confirmDel ? "Tap again to remove this track" : "Remove this track"}</button>
      </div>
    </div>
  );
}

/** Admins: fix the set's details — DJs, venue, date, link. */
function SetSheet({ set, onClose, onDone, act }: { set: Data["set"]; onClose: () => void; onDone: (m: string) => void; act: (b: any) => Promise<any> }) {
  const [title, setTitle] = useState(set.title || "");
  const [venue, setVenue] = useState(set.venue || "");
  const [date, setDate] = useState((set.played_on || "").slice(0, 10));
  const [url, setUrl] = useState(set.source_url || "");
  const [busy, setBusy] = useState(false);
  const lab: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, color: C.text3 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...glass, background: "rgba(20,20,20,0.97)", width: "100%", maxWidth: 520, borderRadius: "24px 24px 0 0", padding: "18px 18px calc(22px + env(safe-area-inset-bottom))", display: "grid", gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Edit the set</div>
        <label style={lab}>DJs<input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...ui.input, fontWeight: 600 }} /></label>
        <label style={lab}>Venue<input value={venue} onChange={(e) => setVenue(e.target.value)} style={ui.input} /></label>
        <label style={lab}>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={ui.input} /></label>
        <label style={lab}>Link<input value={url} onChange={(e) => setUrl(e.target.value)} style={ui.input} /></label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...ui.pill, flex: 1, justifyContent: "center" }}>Cancel</button>
          <button disabled={busy || !title.trim()} onClick={async () => {
            setBusy(true);
            const j = await act({ action: "edit_set", title, venue, played_on: date, source_url: url });
            setBusy(false); if (j) onDone("Saved ✓");
          }} style={{ ...ui.cta, flex: 1 }}>{busy ? "…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
