"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { authFetch } from "@/lib/authFetch";
import { fmtTitle, fmtArtist } from "@/lib/format";
import { promoSummary } from "@/lib/feedback";
import { trackHref } from "@/lib/preview";
import MarqueeText from "@/components/MarqueeText";
import { ui, C, glass, tag, TAG_TEXT } from "@/lib/ui";

/**
 * Your uploaded tracks (lives in the Upload tab): Send a demo, how they were scanned this week,
 * and the list — rename, Released / Unreleased, delete.
 */
export default function MyUploads({ pro, onCount }: { pro: boolean; onCount?: (n: number) => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [proStats, setProStats] = useState<{ uploadScans7d: number; topUpload: { title: string; scans: number } | null } | null>(null);
  const [promoLine, setPromoLine] = useState<string | null>(null);
  const [showMoreTracks, setShowMoreTracks] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string; artist: string; busy?: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data?.session?.user?.email || "";
      if (!email) { setLoaded(true); return; }
      const { data: bpro } = await supabase.from("bpro_tracks")
        .select("id,title,artist,release_status,is_released")
        .eq("uploader_email", email).order("created_at", { ascending: false }).limit(300);
      if (alive) { setTracks(bpro || []); setLoaded(true); }
    })().catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [supabase]);
  useEffect(() => { onCount?.(tracks.length); }, [tracks.length, onCount]);

  useEffect(() => {
    if (!pro) return;
    authFetch("/api/profile/stats").then(r => r.json())
      .then(j => { if (j?.ok) setProStats({ uploadScans7d: j.uploadScans7d || 0, topUpload: j.topUpload || null }); })
      .catch(() => {});
    authFetch("/api/promo/list").then(r => r.json())
      .then(j => { const all = (j?.promos || []).flatMap((p: any) => p.recipients || []); if (all.length) setPromoLine(promoSummary(all)); })
      .catch(() => {});
  }, [pro]);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:16 }}>
          {/* ── STUDIO (Pro): send a demo (Set mode lives in the Sets tab) ── */}
          {pro && (
            <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:10 }}>
              {[
                { href:"/promo", label:"Send a demo", icon:<path d="M4 12l16-8-6 16-2.5-6.5L4 12z" /> },
              ].map((t) => (
                <button key={t.href} onClick={() => router.push(t.href)}
                  style={{ ...glass, borderRadius:20, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", color:"#fff", fontFamily:"inherit", textAlign:"left" }}>
                  <span style={{ width:36, height:36, borderRadius:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    background:"rgba(245,207,104,0.12)", border:"1px solid rgba(245,207,104,0.25)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
                  </span>
                  <span style={{ fontSize:15, fontWeight:600 }}>{t.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── YOUR TRACKS (Pro): how often others scanned my uploads ── */}
          {proStats && (
            <div style={weekCard}>
              <div style={{ ...ui.label, padding:"0 0 10px" }}>Your tracks</div>
              <div style={{ display:"grid", gap:4, paddingTop:14 }}>
                <div style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1 }}>
                  {proStats.uploadScans7d} <span style={{ fontSize:14, fontWeight:500, color:C.text3 }}>scan{proStats.uploadScans7d === 1 ? "" : "s"}</span>
                </div>
                <div style={{ fontSize:12, color:C.text4 }}>last 7 days</div>
              </div>
              {promoLine && (
                <button onClick={() => router.push("/promo")} style={{ ...weekLine, width:"100%", background:"none", border:"none", borderTop: (weekLine as any).borderTop, paddingLeft:0, paddingRight:0, paddingBottom:0, cursor:"pointer", color:"#fff", fontFamily:"inherit", textAlign:"left" }}>
                  <span style={{ color:C.gold, flexShrink:0 }}>Demos</span>
                  <span style={{ flex:1, minWidth:0, fontSize:13, color:C.text2 }}>{promoLine}</span>
                  <span style={{ color:C.text4, flexShrink:0 }}>›</span>
                </button>
              )}
              {proStats.topUpload && (
                <div style={weekLine}>
                  <span style={{ color:C.gold, flexShrink:0 }}>Top</span>
                  <span style={{ flex:1, minWidth:0 }}><MarqueeText text={proStats.topUpload.title} style={{ fontWeight:600 }} /></span>
                  <span style={{ color:C.text3, flexShrink:0 }}>{proStats.topUpload.scans}×</span>
                </div>
              )}
            </div>
          )}

          {/* ── MES TRACKS (en dernier) ── */}
          {loaded && tracks.length === 0 && <div style={ui.empty}>No uploads yet.</div>}
          {tracks.length > 0 && (
            <section style={{ ...ui.section, paddingBottom:4 }}>
              <div style={ui.label}>My uploads</div>
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:4 }}>
                {(showMoreTracks ? tracks : tracks.slice(0,10)).map((t) => renaming?.id === t.id ? (
                  <div key={t.id} style={{ display:"grid", gap:8, padding:"14px 0", borderBottom:`1px solid ${C.lineSoft}` }}>
                    <input value={renaming!.title} onChange={(e) => setRenaming({ ...renaming!, title: e.target.value, error: "" })} placeholder="Title"
                      style={{ ...ui.input, padding:"9px 12px", fontSize:14, fontWeight:600 }} />
                    <input value={renaming!.artist} onChange={(e) => setRenaming({ ...renaming!, artist: e.target.value, error: "" })} placeholder="Artist"
                      style={{ ...ui.input, padding:"9px 12px", fontSize:13 }} />
                    {renaming!.error && <div style={{ fontSize:12, color:C.danger }}>{renaming!.error}</div>}
                    <div style={{ display:"flex", gap:8 }}>
                      <button disabled={renaming!.busy || !renaming!.title.trim() || !renaming!.artist.trim()} onClick={async () => {
                        setRenaming({ ...renaming!, busy: true, error: "" });
                        const res = await authFetch("/api/bpro/rename", { method:"POST", headers:{"Content-Type":"application/json"},
                          body: JSON.stringify({ track_id: t.id, title: renaming!.title, artist: renaming!.artist }) }).catch(() => null);
                        const j = await res?.json().catch(() => null);
                        if (res?.ok && j?.ok) {
                          setTracks((prev: any[]) => prev.map((x: any) => x.id === t.id ? { ...x, title: renaming!.title.trim(), artist: renaming!.artist.trim() } : x));
                          setRenaming(null);
                        } else setRenaming({ ...renaming!, busy: false, error: j?.error || "Couldn't rename. Try again." });
                      }} style={{ ...ui.pillSmall, flex:1, justifyContent:"center", color:C.goldInk, background:C.goldGrad, border:"1px solid transparent" }}>
                        {renaming!.busy ? "…" : "Save"}
                      </button>
                      <button onClick={() => setRenaming(null)} style={{ ...ui.pillSmall, flex:1, justifyContent:"center" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 0", borderBottom:`1px solid ${C.lineSoft}` }}>
                    <div style={{ flex:1, minWidth:0, overflow:"hidden" }}>
                      <MarqueeText text={fmtTitle(t.title) || "Untitled"} style={ui.rowTitle} />
                      <Link href={trackHref(t.title || "", t.artist)} style={{ ...ui.rowSub, display:"block", textDecoration:"none" }}>{t.artist ? fmtArtist(t.artist) : "Open"} <span style={{ color:C.gold }}>›</span></Link>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = !t.is_released;
                        setTracks((prev: any[]) => prev.map((x: any) => x.id === t.id ? { ...x, is_released: newVal, release_status: newVal ? "released" : "unreleased" } : x));
                        try {
                          const res = await authFetch("/api/bpro/set-release", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ track_id: t.id, is_released: newVal }) });
                          if (!res.ok) throw new Error("failed");
                        } catch {
                          setTracks((prev: any[]) => prev.map((x: any) => x.id === t.id ? { ...x, is_released: !newVal, release_status: !newVal ? "released" : "unreleased" } : x));
                        }
                      }}
                      style={{ ...tag(t.is_released ? "rel" : "unrel"), border:"none", cursor:"pointer" }}
                    >
                      {t.is_released ? TAG_TEXT.rel : TAG_TEXT.unrel}
                    </button>
                    <button onClick={() => { setConfirmDel(null); setRenaming({ id: t.id, title: t.title || "", artist: t.artist || "" }); }} aria-label="Edit name"
                      style={{ background:"none", border:"none", padding:4, cursor:"pointer", color:C.text4, display:"flex", flexShrink:0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" />
                      </svg>
                    </button>
                    {confirmDel === t.id ? (
                      <button onClick={async () => {
                        setConfirmDel(null);
                        const res = await authFetch("/api/bpro/delete", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ track_id: t.id }) }).catch(() => null);
                        if (res?.ok) setTracks((prev: any[]) => prev.filter((x: any) => x.id !== t.id));
                        else alert("Couldn't delete this upload. Try again.");
                      }} style={{ ...tag("neutral"), border:"none", cursor:"pointer", background:"#e5484d", color:"#fff" }}>Delete</button>
                    ) : (
                      <button onClick={() => setConfirmDel(t.id)} aria-label="Delete upload"
                        style={{ background:"none", border:"none", padding:4, cursor:"pointer", color:C.text4, display:"flex", flexShrink:0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {tracks.length > 10 && (
                  <button onClick={()=>setShowMoreTracks(v=>!v)} style={ui.more}>
                    {showMoreTracks ? "Show less" : `Show ${tracks.length-10} more`}
                  </button>
                )}
              </div>
            </section>
          )}

    </div>
  );
}

const weekCard: React.CSSProperties = { ...glass, borderRadius:24, padding:"14px 16px 16px", display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:0 };
const weekLine: React.CSSProperties = { display:"flex", alignItems:"center", gap:10, fontSize:14, color:C.text2, minWidth:0, borderTop:`1px solid ${C.lineSoft}`, paddingTop:14, marginTop:14 };
