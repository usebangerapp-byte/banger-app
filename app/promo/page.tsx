"use client";

import { fmtTitle, fmtArtist } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import { authFetch } from "@/lib/authFetch";
import { ui, C, glass } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";
import { VERDICTS, promoSummary, type Verdict } from "@/lib/feedback";
import MarqueeText from "@/components/MarqueeText";
import { guessTrackName } from "@/lib/trackName";
import { FFmpeg } from "@ffmpeg/ffmpeg";

const MAX_BYTES = 48 * 1024 * 1024; // storage limit is 50 MB per file

type Person = { id: string; display_name: string; avatar_url?: string | null };
type Sent = {
  id: string; title: string; artist: string | null; created_at: string;
  recipients: { id: string; name: string; avatar: string | null; listened_at: string | null; plays: number; liked?: boolean; downloaded?: boolean; verdict?: Verdict | null; tags?: string[]; note?: string | null }[];
};

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span style={{ ...ui.avatar, width: size, height: size, fontSize: size * 0.4 }}>
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function PromoPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person[]>([]);
  const [banger, setBanger] = useState<Person | null>(null);
  useEffect(() => {
    fetch("/api/promo/banger").then((r) => r.json()).then((j) => { if (j?.ok) setBanger({ id: j.id, display_name: j.display_name, avatar_url: j.avatar_url }); }).catch(() => {});
  }, []);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"" | "prepare" | "compress" | "upload" | "send">("");
  const [pct, setPct] = useState(0);
  const [sentBytes, setSentBytes] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(0);
  const [sent, setSent] = useState<Sent[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const role = await getBrowserRole();
      if (role !== "pro") { router.replace("/upgrade"); return; }
      const sb = createSupabaseBrowser();
      const { data } = (await sb?.auth.getSession()) || { data: null as any };
      setMe(data?.session?.user?.id || "");
      setReady(true);
      loadSent();
    })();
  }, [router]);

  async function loadSent() {
    const r = await authFetch("/api/promo/list").catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.promos) setSent(j.promos);
  }

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      const r = await fetch(`/api/profile/search?q=${encodeURIComponent(term)}`, { cache: "no-store" }).catch(() => null);
      const j = await r?.json().catch(() => null);
      setResults((Array.isArray(j?.results) ? j.results : []).filter((p: Person) => p.id !== me));
    }, 250);
  }, [q, me]);

  function pickFile(f: File | undefined) {
    if (!f) return;
    setFile(f); setDone(0); setError("");
    guessTrackName(f).then((g) => { if (g.artist) setArtist(g.artist); if (g.title) setTitle(g.title); }).catch(() => {});
  }

  function togglePerson(p: Person) {
    setPicked((cur) => cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]);
  }

  async function send() {
    if (!file || !title.trim() || picked.length === 0) return;
    setBusy(true); setError(""); setStage("prepare"); setPct(0); setSentBytes(0);
    try {
      // Big / lossless files (WAV, AIFF, FLAC…) are turned into a 320 kbps MP3 on the phone first
      let toSend: File = file;
      const lossless = /\.(wav|aiff?|flac)$/i.test(file.name);
      if (file.size > MAX_BYTES || lossless) {
        setStage("compress"); setPct(0);
        const ff = new FFmpeg();
        ff.on("progress", ({ progress }) => setPct(Math.max(0, Math.min(100, Math.round(progress * 100)))));
        await ff.load();
        const inName = `in.${(file.name.split(".").pop() || "wav").toLowerCase()}`;
        await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
        for (const kbps of ["320k", "192k"]) {
          setPct(0);
          await ff.exec(["-i", inName, "-vn", "-codec:a", "libmp3lame", "-b:a", kbps, "out.mp3"]);
          const data = await ff.readFile("out.mp3");
          const buf = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
          toSend = new File([buf.buffer as ArrayBuffer], file.name.replace(/\.[^.]+$/, "") + ".mp3", { type: "audio/mpeg" });
          try { await ff.deleteFile("out.mp3"); } catch {}
          if (toSend.size <= MAX_BYTES) break;
        }
        try { ff.terminate(); } catch {}
        if (toSend.size > MAX_BYTES) throw new Error("This track is too long to send (over 50 MB even compressed).");
      }
      const ext = (toSend.name.split(".").pop() || "mp3").toLowerCase();
      const r1 = await authFetch("/api/promo/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ext }) });
      const u = await r1.json().catch(() => ({}));
      if (!r1.ok || !u.ok) throw new Error(u.error || "Upload not available");
      // Upload with real progress (same request the Supabase SDK makes, but via XHR so we can follow it)
      setStage("upload");
      await new Promise<void>((resolve, reject) => {
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `${base}/storage/v1/object/upload/sign/promos/${u.path}?token=${encodeURIComponent(u.token)}`);
        xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) { setPct(Math.round((e.loaded / e.total) * 100)); setSentBytes(e.loaded); } };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve()
          : reject(new Error(xhr.status === 413 ? "File too big (max 50 MB). Try an MP3." : `Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error during upload. Check your connection."));
        const fd = new FormData();
        fd.append("cacheControl", "3600");
        fd.append("", toSend, toSend.name);
        xhr.send(fd);
      });
      setStage("send");
      const r2 = await authFetch("/api/promo/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, note, file_path: u.path, recipients: picked.map((p) => p.id) }),
      });
      const s = await r2.json().catch(() => ({}));
      if (!r2.ok || !s.ok) throw new Error(s.error || "Send failed");
      setDone(s.sent || picked.length);
      setFile(null); setTitle(""); setArtist(""); setNote(""); setPicked([]); setQ("");
      loadSent();
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally { setBusy(false); setStage(""); }
  }

  if (!ready) return <main style={ui.page} />;
  const canSend = !!file && !!title.trim() && picked.length > 0 && !busy;

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader back title="Demos" sub="Send an unreleased track privately to DJs." />

        {done > 0 && (
          <section style={{ ...ui.card, textAlign: "center", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Sent to {done} DJ{done > 1 ? "s" : ""}</div>
            <div style={{ fontSize: 13, color: C.text3 }}>You&apos;ll see below when they listen.</div>
          </section>
        )}

        {/* ── New promo ── */}
        <section style={{ ...ui.card, display: "grid", gap: 12 }}>
          <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.aif,.aiff,.flac,.m4a" style={{ display: "none" }}
            onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ minWidth: 0, width: "100%", boxSizing: "border-box", border: "1px dashed rgba(245,207,104,0.40)", borderRadius: 18, padding: "20px 14px", background: "rgba(245,207,104,0.06)",
              color: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file ? file.name : "Choose the track"}
            </div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>
              {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · tap to change` : "Full track · MP3, WAV, AIFF…"}
            </div>
          </button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" style={ui.input} />
          <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" style={ui.input} />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A word for them (optional)" rows={2}
            style={{ ...ui.input, resize: "none" }} />

          {/* Recipients */}
          <div style={{ display: "grid", gap: 2, paddingTop: 4 }}>
            <div style={{ fontSize: 13, color: C.text3 }}>Send to</div>
            <div style={{ fontSize: 12, color: C.text4, lineHeight: 1.4 }}>Pick one or more DJs. You&apos;ll be notified each time one of them listens.</div>
          </div>
          {picked.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {picked.map((p) => (
                <button key={p.id} onClick={() => togglePerson(p)}
                  style={{ ...ui.pillSmall, background: "rgba(245,207,104,0.14)", borderColor: "rgba(245,207,104,0.35)", color: C.gold }}>
                  {p.display_name} ✕
                </button>
              ))}
            </div>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a DJ…" style={{ ...ui.input, borderRadius: 999 }} />
          {/* BANGER itself is always proposed: send your track to the BANGER team */}
          {banger && banger.id !== me && !picked.some((p) => p.id === banger.id) && (
            <button onClick={() => togglePerson(banger)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit",
                textAlign: "left", color: "#fff", background: "rgba(245,207,104,0.08)", border: "1px solid rgba(245,207,104,0.28)" }}>
              <Avatar name={banger.display_name} url={banger.avatar_url} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{banger.display_name}</span>
                <span style={{ display: "block", fontSize: 12, color: C.text3 }}>Send your track to the BANGER team</span>
              </span>
              <span style={{ ...ui.pillSmall, color: C.gold, borderColor: "rgba(245,207,104,0.35)", background: "rgba(245,207,104,0.12)" }}>+ Add</span>
            </button>
          )}
          {results.length > 0 && (
            <div style={{ display: "grid" }}>
              {results.slice(0, 6).map((p) => {
                const on = picked.some((x) => x.id === p.id);
                return (
                  <button key={p.id} onClick={() => togglePerson(p)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", background: "none", border: "none",
                      borderBottom: `1px solid ${C.lineSoft}`, color: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <Avatar name={p.display_name} url={p.avatar_url} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.display_name}</span>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      background: on ? C.goldGrad : "transparent", border: on ? "none" : `1px solid ${C.line}`, color: C.goldInk, fontSize: 12, fontWeight: 800 }}>
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && <div style={{ fontSize: 13, color: C.danger }}>{error}</div>}

          {/* Progress while sending */}
          {busy && (
            <div style={{ display: "grid", gap: 8, padding: "4px 2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#fff", fontWeight: 600 }}>
                  {stage === "prepare" ? "Preparing…" : stage === "compress" ? "Compressing to MP3…" : stage === "upload" ? "Uploading the track…" : `Sending to ${picked.length} DJ${picked.length > 1 ? "s" : ""}…`}
                </span>
                <span style={{ color: C.text3, fontVariantNumeric: "tabular-nums" }}>
                  {stage === "upload" ? `${(sentBytes / 1024 / 1024).toFixed(1)} MB · ${pct}%` : stage === "compress" ? `${pct}%` : ""}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${stage === "send" ? 100 : stage === "upload" || stage === "compress" ? Math.max(2, pct) : 2}%`,
                  background: C.goldGrad, transition: "width .3s ease" }} />
              </div>
            </div>
          )}

          <button onClick={send} disabled={!canSend}
            style={canSend ? { ...ui.cta, marginTop: 4 } : { ...ui.cta, marginTop: 4, background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.45)", boxShadow: "none", cursor: "not-allowed" }}>
            {busy ? "Sending…" : picked.length > 1 ? `Send privately to ${picked.length} DJs` : "Send privately"}
          </button>
        </section>

        {/* ── Sent ── */}
        {sent.length > 0 && (
          <section style={{ ...ui.section, paddingBottom: 4 }}>
            <div style={ui.label}>Sent</div>
            {sent.map((p) => {
              const heard = p.recipients.filter((r) => r.listened_at).length;
              const open = openId === p.id;
              return (
                <div key={p.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div onClick={() => setOpenId(open ? null : p.id)} style={{ ...ui.row, borderBottom: "none", cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <MarqueeText text={p.artist ? `${fmtArtist(p.artist)} - ${fmtTitle(p.title)}` : fmtTitle(p.title)} style={ui.rowTitle} />
                      <div style={{ ...ui.rowSub, whiteSpace: "normal" }}>
                        {new Date(p.created_at).toLocaleDateString([], { day: "numeric", month: "short" })} · <span style={{ color: heard ? C.gold : C.text3, fontWeight: 600 }}>{promoSummary(p.recipients)}</span>
                      </div>
                    </div>
                    <span style={{ color: C.text4, flexShrink: 0, fontSize: 18 }}>{open ? "⌃" : "⌄"}</span>
                  </div>
                  {open && (
                    <div style={{ display: "grid", gap: 8, padding: "0 0 14px" }}>
                      {p.recipients.map((r) => (
                        <div key={r.id} style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={r.name} url={r.avatar} size={28} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                          {r.downloaded && <span style={{ color: C.text2, fontSize: 13, flexShrink: 0 }} aria-label="Downloaded">⬇</span>}
                          {r.liked && <span style={{ color: C.gold, fontSize: 14, flexShrink: 0 }} aria-label="Liked">♥</span>}
                          <span style={{ fontSize: 12, color: r.listened_at ? C.rel : C.text4, flexShrink: 0 }}>
                            {r.listened_at ? `Listened${r.plays > 1 ? ` · ${r.plays}×` : ""}` : "Not yet"}
                          </span>
                          {r.verdict && <span title={VERDICTS[r.verdict].label} style={{ fontSize: 16, flexShrink: 0 }}>{VERDICTS[r.verdict].emoji}</span>}
                        </div>
                        {(r.verdict || r.tags?.length || r.note) && (
                          <div style={{ margin: "-2px 0 4px 38px", display: "grid", gap: 4 }}>
                            {r.verdict && <div style={{ fontSize: 13, fontWeight: 600 }}>{VERDICTS[r.verdict].emoji} {VERDICTS[r.verdict].label}</div>}
                            {!!r.tags?.length && <div style={{ fontSize: 12, color: C.text2 }}>{r.tags.join(" · ")}</div>}
                            {r.note && <div style={{ fontSize: 13, color: C.text2, fontStyle: "italic" }}>“{r.note}”</div>}
                          </div>
                        )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
