"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";

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

export default function ProfilePage() {
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
        if (mounted) setFollows(Array.isArray(fj?.followed) ? fj.followed : []);

        const { data: scanData } = await supabase
          .from("scan_events").select("track_title,created_at")
          .eq("user_id", uid).order("created_at", { ascending: false }).limit(50);
        if (mounted && scanData) {
          setScans(scanData);
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split("T")[0];
          });
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
        const map = new Map<string, any>();
        for (const msg of j.messages) {
          const other = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
          map.set(other, { user_id: other, last: msg.content,
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

        <div style={tabBarStyle}>
          {(["profile","messages"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, ...(tab===t?tabActive:{}) }}>
              {t==="profile" ? "PROFILE" : `MESSAGES${convs.reduce((a,c)=>a+c.unread,0)>0?` (${convs.reduce((a,c)=>a+c.unread,0)})`:""}`}
            </button>
          ))}
        </div>

        {tab==="profile" && (<>
          <div style={headerStyle}>
            <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
              <div style={avatarStyle}>{name.charAt(0).toUpperCase()}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:20, fontWeight:900 }}>{name}</div>
                  {role==="pro" && <span style={proBadge}>✦ PRO</span>}
                </div>
                {profile?.genre && <div style={{ fontSize:13, opacity:0.55, marginTop:2 }}>{profile.genre}</div>}
                {profile?.bio   && <div style={{ fontSize:13, opacity:0.75, marginTop:6, lineHeight:1.4 }}>{profile.bio}</div>}
                <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" as const }}>
                  {profile?.instagram  && <a href={`https://instagram.com/${profile.instagram.replace("@","")}`}  target="_blank" rel="noreferrer" style={socialLink}>IG @{profile.instagram.replace("@","")}</a>}
                  {profile?.soundcloud && <a href={`https://soundcloud.com/${profile.soundcloud.replace("@","")}`} target="_blank" rel="noreferrer" style={socialLink}>SC {profile.soundcloud}</a>}
                </div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {[{l:"SCANS",v:scans.length},{l:"FOLLOWERS",v:profile?.follower_count||0},{l:"FOLLOWING",v:profile?.following_count||0},{l:"FOLLOWS",v:follows.length}].map(({l,v})=>(
                <div key={l} style={{ textAlign:"center" as const }}>
                  <div style={{ fontSize:20, fontWeight:900 }}>{v}</div>
                  <div style={{ fontSize:9, opacity:0.45, letterSpacing:"0.14em" }}>{l}</div>
                </div>
              ))}
            </div>
            {sparkData.some(v=>v>0) && (
              <div>
                <div style={{ fontSize:10, opacity:0.4, letterSpacing:"0.14em", marginBottom:6 }}>SCANS THIS WEEK</div>
                <Sparkline data={sparkData} />
              </div>
            )}
            {profile?.display_name && (
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={shareBtn}>
                🔗 {shareUrl.replace("https://","")}
              </button>
            )}
            <div style={{ display:"grid", gap:8 }}>
              <button onClick={() => setEditing(v=>!v)} style={editBtn}>{editing?"Cancel":"Edit Profile"}</button>
              {role==="public"
                ? <button onClick={() => router.push("/onboarding")} style={upgradeBtn}>✦ Upgrade to PRO — €9.99/mo</button>
                : <button onClick={() => switchRole("public")} style={downgradeBtn}>Switch to Public (Free)</button>}
              <button onClick={async()=>{ if(supabase){await supabase.auth.signOut();router.push("/");} }} style={signOutBtn}>Sign out</button>
            </div>
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
              {tracks.map(t=>(
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{t.title||"Untitled"}</div>
                    {t.artist && <div style={{ fontSize:12, opacity:0.5 }}>{t.artist}</div>}
                  </div>
                  <span style={{ fontSize:10, fontWeight:800, color:t.is_released?"#1db954":"rgba(255,255,255,0.55)", border:`1px solid ${t.is_released?"rgba(29,185,84,0.35)":"rgba(255,255,255,0.12)"}`, borderRadius:999, padding:"3px 8px" }}>
                    {t.is_released?"RELEASED":"UNRELEASED"}
                  </span>
                </div>
              ))}
            </Section>
          )}

          <Section title={`FOLLOWED TRACKS (${follows.length})`}>
            {follows.length===0
              ? <div style={emptyStyle}>No followed tracks yet.</div>
              : follows.slice(0,5).map((f:any,i:number)=>(
                <div key={i} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{f.track_title||"Unknown"}</div>
                  {f.track_subtitle && <div style={{ fontSize:12, opacity:0.5 }}>{f.track_subtitle}</div>}
                </div>
              ))}
          </Section>

          <Section title={`MY SCANS (${scans.length})`}>
            {scans.length===0
              ? <div style={emptyStyle}>No scans yet.</div>
              : scans.slice(0,5).map((s:any,i:number)=>(
                <div key={i} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{s.track_title||"Unknown"}</div>
                  {s.created_at && <div style={{ fontSize:11, opacity:0.4 }}>{new Date(s.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>}
                </div>
              ))}
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
              <div style={{ display:"grid", gap:8, maxHeight:"50vh", overflowY:"auto" as const }}>
                {messages.map(msg=>(
                  <div key={msg.id} style={{ display:"flex", justifyContent:msg.sender_id===userId?"flex-end":"flex-start" }}>
                    <div style={{ maxWidth:"75%", padding:"10px 14px", fontSize:14, lineHeight:1.4,
                      borderRadius:msg.sender_id===userId?"18px 18px 4px 18px":"18px 18px 18px 4px",
                      background:msg.sender_id===userId?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.06)" }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
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
const shellStyle: React.CSSProperties = { maxWidth:680, margin:"0 auto", padding:"24px 18px", display:"grid", gap:16 };
const sectionStyle: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:16, display:"grid", gap:12 };
const sectionTitleStyle: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.20em", opacity:0.5 };
const headerStyle: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.08)", borderRadius:24, padding:20, display:"grid", gap:14, background:"rgba(255,255,255,0.02)" };
const avatarStyle: React.CSSProperties = { width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))", border:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:900, flexShrink:0 };
const avatarSmall: React.CSSProperties = { width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, flexShrink:0 };
const proBadge: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.14em", border:"1px solid rgba(255,255,255,0.25)", borderRadius:999, padding:"3px 8px" };
const socialLink: React.CSSProperties = { fontSize:12, color:"rgba(255,255,255,0.6)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:999, padding:"4px 10px", textDecoration:"none" };
const shareBtn: React.CSSProperties = { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"8px 12px", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer", textAlign:"left" as const };
const editBtn: React.CSSProperties = { padding:"11px 16px", borderRadius:14, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" };
const upgradeBtn: React.CSSProperties = { padding:"13px 16px", borderRadius:14, background:"linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))", border:"1px solid rgba(255,255,255,0.22)", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" };
const downgradeBtn: React.CSSProperties = { padding:"11px 16px", borderRadius:14, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)", fontWeight:600, fontSize:13, cursor:"pointer" };
const signOutBtn: React.CSSProperties = { padding:"11px 16px", borderRadius:14, background:"transparent", border:"1px solid rgba(255,80,80,0.2)", color:"rgba(255,100,100,0.7)", fontWeight:600, fontSize:13, cursor:"pointer" };
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
