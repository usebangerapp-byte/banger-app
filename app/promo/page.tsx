"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import { authFetch } from "@/lib/authFetch";
import { ui, C, glass } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";
import MarqueeText from "@/components/MarqueeText";

type Person = { id: string; display_name: string; avatar_url?: string | null };
type Sent = {
  id: string; title: string; artist: string | null; created_at: string;
  recipients: { id: string; name: string; avatar: string | null; listened_at: string | null; plays: number }[];
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
  const [busy, setBusy] = useState(false);
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
    const base = f.name.replace(/\.[^.]+$/, "").trim();
    const sep = base.indexOf(" - ");
    if (!title && !artist && sep > 0) { setArtist(base.slice(0, sep).trim()); setTitle(base.slice(sep + 3).trim()); }
    else if (!title) setTitle(base);
  }

  function togglePerson(p: Person) {
    setPicked((cur) => cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]);
  }

  async function send() {
    if (!file || !title.trim() || picked.length === 0) return;
    setBusy(true); setError("");
    try {
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
      const r1 = await authFetch("/api/promo/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ext }) });
      const u = await r1.json().catch(() => ({}));
      if (!r1.ok || !u.ok) throw new Error(u.error || "Upload not available");
      const sb = createSupabaseBrowser()!;
      const { error: upErr } = await sb.storage.from("promos").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || "audio/mpeg" });
      if (upErr) throw new Error(upErr.message);
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
    } finally { setBusy(false); }
  }

  if (!ready) return <main style={ui.page} />;
  const canSend = !!file && !!title.trim() && picked.length > 0 && !busy;

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader title="Promo" sub="Send an unreleased track privately to DJs." />

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
            style={{ border: "1px dashed rgba(245,207,104,0.40)", borderRadius: 18, padding: "20px 14px", background: "rgba(245,207,104,0.06)",
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
          <div style={{ fontSize: 13, color: C.text3, paddingTop: 4 }}>Send to</div>
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
                      <MarqueeText text={p.artist ? `${p.artist} - ${p.title}` : p.title} style={ui.rowTitle} />
                      <div style={ui.rowSub}>{new Date(p.created_at).toLocaleDateString([], { day: "numeric", month: "short" })}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: heard ? C.gold : C.text3, flexShrink: 0 }}>
                      {heard}/{p.recipients.length} listened
                    </span>
                  </div>
                  {open && (
                    <div style={{ display: "grid", gap: 8, padding: "0 0 14px" }}>
                      {p.recipients.map((r) => (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={r.name} url={r.avatar} size={28} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                          <span style={{ fontSize: 12, color: r.listened_at ? C.rel : C.text4, flexShrink: 0 }}>
                            {r.listened_at ? `Listened${r.plays > 1 ? ` · ${r.plays}×` : ""}` : "Not yet"}
                          </span>
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
