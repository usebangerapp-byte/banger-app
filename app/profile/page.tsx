"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import PageHeader from "@/components/PageHeader";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </section>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const W = 120; const H = 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProfilePageV2() {
  const router   = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [userId,   setUserId]   = useState("");
  const [role,     setRole]     = useState<"public"|"pro">("public");
  const [loading,  setLoading]  = useState(true);
  const [profile,  setProfile]  = useState<any>(null);
  const [editing,  setEditing]  = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio,  setEditBio]  = useState("");
  const [editGenre,setEditGenre]= useState("");
  const [editIG,   setEditIG]   = useState("");
  const [editSC,   setEditSC]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [follows,  setFollows]  = useState<any[]>([]);
  const [scans,    setScans]    = useState<any[]>([]);
  const [tracks,   setTracks]   = useState<any[]>([]);
  const [sparkData,setSparkData]= useState<number[]>([]);
  const [tab,      setTab]      = useState<"profile"|"messages">("profile");
  const [showMoreTracks, setShowMoreTracks] = useState(false);
  const [showMoreFollows, setShowMoreFollows] = useState(false);
  const [showMoreScans,  setShowMoreScans]  = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [convs,    setConvs]    = useState<any[]>([]);
  const [activeConv,setActiveConv]=useState<string|null>(null);
  const [msgInput, setMsgInput] = useState("");
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        const uid   = authData?.session?.user?.id || "";
        const email = authData?.session?.user?.email || "";
        if (!uid) { router.push("/"); return; }
        if (mounted) setUserId(uid);
        const r = await getBrowserRole();
        if (mounted) setRole(r);

        const res = await fetch(`/api/profile/get?user_id=${uid}`);
        const j   = await res.json().catch(() => null);
        if (j?.ok && mounted) {
          setProfile(j.profile);
          setEditName(j.profile.display_name || "");
          setEditBio(j.profile.bio || "");
          setEditGenre(j.profile.genre || "");
          setEditIG(j.profile.instagram || "");
          setEditSC(j.profile.soundcloud || "");
        }

        const fRes = await fetch(`/api/follow-track?user_id=${uid}`, { cache: "no-store" });
        const fj   = await fRes.json().catch(() => null);
        if (mounted) {
          const rawFollows = Array.isArray(fj?.followed) ? fj.followed : [];
          // Deduplicate by track_title
          const seenF = new Set<string>();
          const uniqueFollows = rawFollows.filter((f: any) => {
            const key = (f.track_title || "").toLowerCase().trim();
            if (seenF.has(key)) return false;
            seenF.add(key);
            return true;
          });
          setFollows(uniqueFollows);
        }

        const { data: scanData } = await supabase
          .from("scan_events").select("track_title,created_at,result_type")
          .eq("user_id", uid)
          .neq("result_type", "not_found")
          .order("created_at", { ascending: false }).limit(50);
        if (mounted && scanData) {
          // Deduplicate: keep only the most recent scan per track_title
          const seen = new Set<string>();
          const unique = scanData.filter((s: any) => {
            const key = (s.track_title || "").toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setScans(unique);
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split("T")[0];
          });
          // Use raw scanData (not deduplicated) for accurate daily counts
          setSparkData(days.map(day => scanData.filter((s:any) => s.created_at?.startsWith(day)).length));
        }

        if (r === "pro" && email) {
          const { data: bpro } = await supabase.from("bpro_tracks")
            .select("id,title,artist,release_status,is_released")
            .eq("uploader_email", email).order("created_at", { ascending: false }).limit(20);
          if (mounted) setTracks(bpro || []);
        }
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  useEffect(() => {
    if (!userId || tab !== "messages") return;
    fetch(`/api/messages/list?user_id=${userId}`)
      .then(r => r.json())
      .then(j => {
        if (!j?.messages) return;
        const profileMap = j.profiles || {};
        const map = new Map<string, any>();
        for (const msg of j.messages) {
          const other = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
          const p = profileMap[other];
          const display_name = p?.display_name || p?.email?.split("@")[0] || other.slice(0,8);
          map.set(other, { user_id: other, display_name, last: msg.content,
            unread: msg.receiver_id === userId && !msg.read ? (map.get(other)?.unread||0)+1 : (map.get(other)?.unread||0) });
        }
        setConvs(Array.from(map.values()));
      }).catch(() => {});
  }, [userId, tab]);

  useEffect(() => {
    if (!activeConv || !userId) return;
    fetch(`/api/messages/list?user_id=${userId}&other_id=${activeConv}`)
      .then(r => r.json()).then(j => { if (j?.messages) setMessages(j.messages); }).catch(() => {});
  }, [activeConv, userId]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function saveProfile() {
    if (!userId) return;
    setSaving(true);
    try {
      await fetch("/api/profile/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, display_name: editName, bio: editBio, genre: editGenre, instagram: editIG, soundcloud: editSC }),
      });
      setProfile((p:any) => p ? { ...p, display_name: editName, bio: editBio, genre: editGenre, instagram: editIG, soundcloud: editSC } : p);
      setEditing(false);
    } finally { setSaving(false); }
  }

  async function switchRole(r: "public"|"pro") {
    if (!supabase || !userId) return;
    await supabase.from("profiles").update({ role: r }).eq("id", userId);
    setRole(r);
  }

  async function sendMsg() {
    if (!msgInput.trim() || !activeConv || !userId) return;
    const content = msgInput.trim(); setMsgInput("");
    await fetch("/api/messages/send", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ sender_id: userId, receiver_id: activeConv, content }) });
    setMessages(p => [...p, { id: Date.now(), created_at: new Date().toISOString(), sender_id: userId, receiver_id: activeConv, content, read: false }]);
  }

  const name     = profile?.display_name || profile?.email?.split("@")[0] || "You";
  const shareUrl = `https://usebanger.com/dj/${encodeURIComponent((profile?.display_name||"").toLowerCase().replace(/\s+/g,"-"))}`;

  if (loading) return <main style={pageStyle}><div style={shellStyle}><div style={emptyStyle}>Loading…</div></div></main>;

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>

        <PageHeader title="PROFILE" />

        <div style={tabBarStyle}>
          {(["profile","messages"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, ...(tab===t?tabActive:{}) }}>
              {t==="profile" ? "PROFILE" : `CHAT${convs.reduce((a,c)=>a+c.unread,0)>0?` (${convs.reduce((a,c)=>a+c.unread,0)})`:""}`}
            </button>
          ))}
        </div>

        {tab==="profile" && (<>

          {/* ── IDENTITY CARD ── */}
          <div style={identityCard}>
            {/* Avatar + name row */}
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={avatarStyle}>{name.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
                  <span style={{ fontSize:22, fontWeight:900, letterSpacing:"-0.01em" }}>{name}</span>
                  {!loading && role==="pro" && <span style={proBadge}>✦ PRO</span>}
                </div>
                {profile?.genre && <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:3, letterSpacing:"0.04em" }}>{profile.genre}</div>}
              </div>
            </div>

            {/* Bio */}
            {profile?.bio && (
              <div style={{ fontSize:14, color:"rgba(255,255,255,0.70)", lineHeight:1.5, borderLeft:"2px solid rgba(255,255,255,0.12)", paddingLeft:12 }}>
                {profile.bio}
              </div>
            )}

            {/* Social links */}
            {(profile?.instagram || profile?.soundcloud) && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                {profile?.instagram  && <a href={`https://instagram.com/${profile.instagram.replace("@","")}`}  target="_blank" rel="noreferrer" style={socialLink}>IG @{profile.instagram.replace("@","")}</a>}
                {profile?.soundcloud && <a href={`https://soundcloud.com/${profile.soundcloud.replace("@","")}`} target="_blank" rel="noreferrer" style={socialLink}>SC {profile.soundcloud}</a>}
              </div>
            )}

            {/* Stats row */}
            <div style={statsRow}>
              {[{l:"SCANS",v:scans.length},{l:"FOLLOWERS",v:profile?.follower_count||0},{l:"FOLLOWING",v:profile?.following_count||0},{l:"FOLLOWS",v:follows.length}].map(({l,v},i)=>(
                <div key={l} style={{ textAlign:"center" as const, flex:1, ...(i<3?{borderRight:"1px solid rgba(255,255,255,0.07)"}:{}) }}>
                  <div style={{ fontSize:22, fontWeight:900 }}>{v}</div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"0.14em", marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Sparkline */}
            {sparkData.some(v=>v>0) && (
              <div style={{ padding:"0 4px" }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.30)", letterSpacing:"0.16em", marginBottom:8 }}>SCANS THIS WEEK</div>
                <Sparkline data={sparkData} />
              </div>
            )}

            {/* Share link */}
            {profile?.display_name && (
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={shareBtn}>
                🔗 {shareUrl.replace("https://","")}
              </button>
            )}
          </div>

          {/* ── ACTION BUTTONS ── */}
          <div style={{ display:"grid", gap:10 }}>
            <button onClick={() => setEditing(v=>!v)} style={editBtn}>{editing ? "↑ Cancel editing" : "Edit Profile"}</button>
            {!loading && role !== "pro" && (
              <button onClick={() => router.push("/onboarding")} style={upgradeBtn}>✦ Upgrade to PRO — €9.99/mo</button>
            )}
          </div>

          {editing && (
            <Section title="EDIT PROFILE">
              <div style={{ display:"grid", gap:10 }}>
                {[{label:"Display name",value:editName,set:setEditName,ph:"DJ Banger"},
                  {label:"Genre",value:editGenre,set:setEditGenre,ph:"Techno · House · Melodic"},
                  {label:"Instagram",value:editIG,set:setEditIG,ph:"@yourdj"},
                  {label:"SoundCloud",value:editSC,set:setEditSC,ph:"soundcloud.com/yourdj"}
                ].map(({label,value,set,ph})=>(
                  <label key={label} style={{ fontSize:12, opacity:0.6 }}>
                    {label}
                    <input value={value} onChange={e=>set(e.target.value)} placeholder={ph} style={inputStyle} />
                  </label>
                ))}
                <label style={{ fontSize:12, opacity:0.6 }}>Bio
                  <textarea value={editBio} onChange={e=>setEditBio(e.target.value)} placeholder="Tell your story…" rows={3} style={{ ...inputStyle, resize:"none" as const }} />
                </label>
                <button onClick={saveProfile} disabled={saving} style={saveBtn}>{saving?"Saving…":"Save Profile"}</button>
              </div>
            </Section>
          )}

          {role==="pro" && tracks.length>0 && (
            <Section title="MY TRACKS">
              {(showMoreTracks ? tracks : tracks.slice(0,4)).map(t=>(
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{t.title||"Untitled"}</div>
                    {t.artist && <div style={{ fontSize:12, opacity:0.5 }}>{t.artist}</div>}
                  </div>
                  <button
                    onClick={async () => {
                      const next = !t.is_released;
                      const res = await fetch("/api/bpro/set-release", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ track_id: t.id, is_released: next }),
                      });
                      if (res.ok) {
                        setTracks(prev => prev.map(x => x.id === t.id ? { ...x, is_released: next, release_status: next ? "released" : "unreleased" } : x));
                      }
                    }}
                    style={{
                      fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "5px 10px",
                      cursor: "pointer", border: "none",
                      background: t.is_released ? "rgba(29,185,84,0.18)" : "rgba(255,255,255,0.08)",
                      color: t.is_released ? "#1db954" : "rgba(255,255,255,0.55)",
                      outline: `1px solid ${t.is_released ? "rgba(29,185,84,0.35)" : "rgba(255,255,255,0.12)"}`,
                    }}
                  >
                    {t.is_released ? "RELEASED" : "UNRELEASED"}
                  </button>
                </div>
              ))}
              {tracks.length > 4 && (
                <button onClick={() => setShowMoreTracks(v=>!v)} style={showMoreBtn}>
                  {showMoreTracks ? "Show less ↑" : `Show all ${tracks.length} tracks ↓`}
                </button>
              )}
              <div style={{ fontSize:11, opacity:0.35, marginTop:2 }}>Tap a badge to toggle released / unreleased</div>
            </Section>
          )}

          <Section title={`FOLLOWED TRACKS (${follows.length})`}>
            {follows.length===0
              ? <div style={emptyStyle}>No followed tracks yet.</div>
              : (showMoreFollows ? follows : follows.slice(0,4)).map((f:any,i:number)=>(
                <div key={i} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{f.track_title||"Unknown"}</div>
                  {f.track_subtitle && <div style={{ fontSize:12, opacity:0.5 }}>{f.track_subtitle}</div>}
                </div>
              ))}
            {follows.length > 4 && (
              <button onClick={() => setShowMoreFollows(v=>!v)} style={showMoreBtn}>
                {showMoreFollows ? "Show less ↑" : `Show all ${follows.length} ↓`}
              </button>
            )}
          </Section>

          <Section title={`MY SCANS (${scans.length})`}>
            {scans.length===0
              ? <div style={emptyStyle}>No scans yet.</div>
              : (showMoreScans ? scans : scans.slice(0,4)).map((s:any,i:number)=>(
                <div key={i} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{s.track_title||"Unknown"}</div>
                  {s.created_at && <div style={{ fontSize:11, opacity:0.4 }}>{new Date(s.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>}
                </div>
              ))}
            {scans.length > 4 && (
              <button onClick={() => setShowMoreScans(v=>!v)} style={showMoreBtn}>
                {showMoreScans ? "Show less ↑" : `Show all ${scans.length} scans ↓`}
              </button>
            )}
          </Section>
        </>)}

        {tab==="messages" && (
          <div style={{ display:"grid", gap:12 }}>
            {!activeConv ? (<>
              <div style={sectionTitleStyle}>CONVERSATIONS</div>
              {convs.length===0
                ? <div style={emptyStyle}>No messages yet.</div>
                : convs.map(c=>(
                  <button key={c.user_id} onClick={()=>setActiveConv(c.user_id)} style={convRow}>
                    <div style={avatarSmall}>{(c.display_name||"?").charAt(0).toUpperCase()}</div>
                    <div style={{ flex:1, textAlign:"left" as const }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{c.display_name||c.user_id.slice(0,8)}</div>
                      <div style={{ fontSize:12, opacity:0.5 }}>{c.last}</div>
                    </div>
                    {c.unread>0 && <div style={unreadBadge}>{c.unread}</div>}
                  </button>
                ))}
            </>) : (<>
              <button onClick={()=>setActiveConv(null)} style={backBtn}>← Back</button>
              {/* Conversation header */}
              <div style={{ textAlign:"center", fontSize:13, fontWeight:700, opacity:0.55, paddingBottom:4 }}>
                {convs.find(c=>c.user_id===activeConv)?.display_name || activeConv?.slice(0,8)}
              </div>
              <div style={{ display:"grid", gap:6, maxHeight:"50vh", overflowY:"auto" as const }}>
                {messages.map(msg=>{
                  const isMine = msg.sender_id===userId;
                  return (
                    <div key={msg.id} style={{ display:"flex", flexDirection:"column", alignItems:isMine?"flex-end":"flex-start" }}>
                      {!isMine && (
                        <div style={{ fontSize:11, fontWeight:700, opacity:0.45, marginBottom:2, paddingLeft:4 }}>{msg.sender_name || "?"}</div>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexDirection:isMine?"row-reverse":"row" }}>
                        <div style={{ maxWidth:"75%", padding:"10px 14px", fontSize:14, lineHeight:1.4,
                          borderRadius:isMine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                          background:isMine?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.06)" }}>
                          {msg.content}
                        </div>
                        {isMine && (
                          <button onClick={async()=>{
                            await fetch("/api/messages/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message_id:msg.id,user_id:userId})});
                            setMessages(p=>p.filter(m=>m.id!==msg.id));
                          }} style={{ background:"none",border:"none",color:"rgba(255,80,80,0.5)",fontSize:14,cursor:"pointer",padding:"0 2px",flexShrink:0 }}>✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={msgInput} onChange={e=>setMsgInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Message…" style={{ ...inputStyle, flex:1 }} />
                <button onClick={sendMsg} disabled={!msgInput.trim()} style={sendMsgBtn}>↑</button>
              </div>
            </>)}
          </div>
        )}

      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", background:"#000", color:"#fff", padding:"0 0 120px" };
const shellStyle: React.CSSProperties = { maxWidth:680, margin:"0 auto", padding:"16px 16px", display:"grid", gap:14 };
const sectionStyle: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:"14px 16px", display:"grid", gap:10 };
const sectionTitleStyle: React.CSSProperties = { fontSize:9, fontWeight:900, letterSpacing:"0.22em", color:"rgba(255,255,255,0.30)" };
// identity card replaces old headerStyle
const identityCard: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.09)", borderRadius:24, padding:"20px 18px", display:"grid", gap:16, background:"linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))" };
const statsRow: React.CSSProperties = { display:"flex", background:"rgba(255,255,255,0.03)", borderRadius:16, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 0" };
const avatarStyle: React.CSSProperties = { width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))", border:"1px solid rgba(255,255,255,0.14)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:900, flexShrink:0 };
const avatarSmall: React.CSSProperties = { width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, flexShrink:0 };
const proBadge: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.14em", border:"1px solid rgba(255,255,255,0.30)", borderRadius:999, padding:"3px 9px", color:"#fff" };
const socialLink: React.CSSProperties = { fontSize:12, color:"rgba(255,255,255,0.55)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:999, padding:"5px 12px", textDecoration:"none" };
const shareBtn: React.CSSProperties = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"9px 14px", color:"rgba(255,255,255,0.40)", fontSize:12, cursor:"pointer", textAlign:"left" as const };
const editBtn: React.CSSProperties = { padding:"13px 16px", borderRadius:14, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" };
const upgradeBtn: React.CSSProperties = { padding:"13px 16px", borderRadius:14, background:"linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.06))", border:"1px solid rgba(255,255,255,0.22)", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" };
const downgradeBtn: React.CSSProperties = { padding:"11px 16px", borderRadius:14, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.35)", fontWeight:600, fontSize:13, cursor:"pointer" };
const inputStyle: React.CSSProperties = { display:"block", width:"100%", marginTop:6, padding:"10px 12px", borderRadius:12, background:"#0d0d0d", border:"1px solid rgba(255,255,255,0.10)", color:"#fff", fontSize:14 };
const saveBtn: React.CSSProperties = { padding:"13px 16px", borderRadius:14, background:"#fff", color:"#000", fontWeight:800, fontSize:14, cursor:"pointer", border:"none" };
const tabBarStyle: React.CSSProperties = { display:"flex", borderBottom:"1px solid rgba(255,255,255,0.08)" };
const tabBtn: React.CSSProperties = { flex:1, padding:"14px 0", background:"none", border:"none", color:"rgba(255,255,255,0.45)", fontWeight:700, fontSize:12, letterSpacing:"0.12em", cursor:"pointer" };
const tabActive: React.CSSProperties = { color:"#fff", borderBottom:"2px solid #fff" };
const convRow: React.CSSProperties = { display:"flex", gap:12, alignItems:"center", padding:"12px 0", background:"none", border:"none", color:"#fff", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.06)", width:"100%" };
const unreadBadge: React.CSSProperties = { width:20, height:20, borderRadius:"50%", background:"#fff", color:"#000", fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" };
const sendMsgBtn: React.CSSProperties = { width:44, height:44, borderRadius:"50%", background:"#fff", color:"#000", border:"none", fontSize:18, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };
const backBtn: React.CSSProperties = { background:"none", border:"none", color:"rgba(255,255,255,0.6)", fontSize:14, cursor:"pointer", padding:0, textAlign:"left" as const };
const emptyStyle: React.CSSProperties = { fontSize:13, opacity:0.45, padding:"4px 0" };
const showMoreBtn: React.CSSProperties = { background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"rgba(255,255,255,0.5)", fontSize:12, fontWeight:700, padding:"8px 12px", cursor:"pointer", width:"100%", marginTop:4 };
// 1781652265
