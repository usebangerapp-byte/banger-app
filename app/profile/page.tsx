"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import PageHeader from "@/components/PageHeader";
import { PeopleSearch, PeopleSheet } from "@/components/People";

// ── Custom inline audio player ──
// Gestionnaire global : une seule lecture à la fois
const activeAudioRef = { current: null as HTMLAudioElement | null };

function AudioPlayer({ src, name }: { src: string; name: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      if (activeAudioRef.current === a) activeAudioRef.current = null;
    } else {
      // Pause tout autre audio en cours
      if (activeAudioRef.current && activeAudioRef.current !== a) {
        activeAudioRef.current.pause();
        activeAudioRef.current.dispatchEvent(new Event("externalpause"));
      }
      activeAudioRef.current = a;
      setLoading(true);
      try { await a.play(); setPlaying(true); } catch {}
      setLoading(false);
    }
  }, [playing]);

  // Écouter la pause externe (quand un autre player démarre)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onExt = () => { setPlaying(false); };
    a.addEventListener("externalpause", onExt);
    return () => a.removeEventListener("externalpause", onExt);
  }, []);

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ width: "100%", minWidth: 180, maxWidth: 240 }}>
      {/* Filename + download */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
        <div style={{ flex:1, fontSize: 11, color: "rgba(255,255,255,0.55)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          🎵 {name}
        </div>
        <button
          onClick={async e => {
            e.stopPropagation();
            try {
              const res = await fetch(src);
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = name;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
            } catch { window.open(src, "_blank"); }
          }}
          style={{ flexShrink:0, color:"rgba(255,255,255,0.40)", lineHeight:1,
            display:"flex", alignItems:"center", background:"none", border:"none",
            cursor:"pointer", padding:2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v13M5 16l7 7 7-7"/><line x1="3" y1="21" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={toggle}
          style={{ width: 32, height: 32, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,0.18)", color: "#fff", fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0 }}>
          {loading ? "⏳" : playing ? "⏸" : "▶"}
        </button>
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2,
          cursor: "pointer", position: "relative" as const }}
          onClick={e => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (audioRef.current) audioRef.current.currentTime = ratio * (audioRef.current.duration || 0);
          }}>
          <div style={{ height: "100%", width: `${progress * 100}%`,
            background: "rgba(255,255,255,0.80)", borderRadius: 2,
            transition: "width 0.1s linear" }} />
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", flexShrink: 0, minWidth: 28 }}>
          {fmt(duration > 0 ? progress * duration : 0)}
        </span>
      </div>
      <audio ref={audioRef} src={src} preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => { const a = audioRef.current; if (a && a.duration) setProgress(a.currentTime / a.duration); }}
        onEnded={() => { setPlaying(false); setProgress(0); activeAudioRef.current = null; }}
        style={{ display: "none" }} />
    </div>
  );
}

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
  const [tab,      setTab]      = useState<"profile"|"messages"|"settings">("profile");
  const [showMoreTracks, setShowMoreTracks] = useState(false);
  const [showMoreFollows, setShowMoreFollows] = useState(false);
  const [showMoreScans,  setShowMoreScans]  = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [convs,    setConvs]    = useState<any[]>([]);
  const [activeConv,setActiveConv]=useState<string|null>(null);
  const [convToDelete, setConvToDelete] = useState<string|null>(null);
  const [pendingName, setPendingName] = useState<string>("");
  const [peopleList, setPeopleList] = useState<"followers"|"following"|null>(null);

  // Deep links: /profile?tab=messages&with=<userId>&name=<displayName>
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("tab");
      if (t === "messages") setTab(t);
      const w = sp.get("with");
      if (w) { setTab("messages"); setActiveConv(w); setPendingName(sp.get("name") || ""); }
    } catch {}
  }, []);
  const [msgInput, setMsgInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
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
          if (j.profile.avatar_url) setAvatarUrl(j.profile.avatar_url);
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
          .from("scan_events").select("track_title,track_subtitle,created_at,result_type")
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

        if (email) {
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
          const avatar_url = p?.avatar_url || null;
          // Aperçu du dernier message : fichier audio ou texte court
          const rawLast = msg.file_name ? `🎵 ${msg.file_name}` :
            msg.content?.startsWith("📎") ? "📎 Fichier audio" :
            msg.content || "";
          map.set(other, { user_id: other, display_name, avatar_url, last: rawLast,
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

  async function deleteConversation(otherUserId: string) {
    if (!userId) return;
    // Supprimer tous les messages entre les deux utilisateurs
    const sb = createSupabaseBrowser();
    if (!sb) return;
    await sb.from("messages")
      .delete()
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`);
    setConvs(p => p.filter(c => c.user_id !== otherUserId));
    setConvToDelete(null);
  }

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

  async function sendFile(file: File) {
    if (!userId || !supabase) { alert("Not logged in"); return; }
    if (!activeConv) { alert("No conversation selected"); return; }
    if (file.size > 52_428_800) { alert("Max 50 MB"); return; }
    setUploading(true);
    try {
      // Upload DIRECT browser → Supabase Storage (no server proxy, no size limit)
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `chat/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("bpro_uploads")
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) { alert("Upload error: " + upErr.message); return; }

      const { data: urlData } = supabase.storage.from("bpro_uploads").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      // Send just the metadata to the API (small JSON, no size issue)
      const sendRes = await fetch("/api/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: userId, receiver_id: activeConv, content: null, file_url: fileUrl, file_name: file.name, file_type: file.type }),
      });
      const sj = await sendRes.json().catch(() => ({ ok: false, error: "Send parse error" }));
      if (!sj.ok) { alert("Send error: " + (sj.error || "unknown")); return; }

      setMessages(p => [...p, { id: Date.now(), created_at: new Date().toISOString(), sender_id: userId, receiver_id: activeConv, content: null, file_url: fileUrl, file_name: file.name, file_type: file.type, read: false }]);
    } catch(e: any) {
      alert("Error: " + (e?.message || "unknown"));
    } finally { setUploading(false); }
  }

  async function uploadAvatar(file: File) {
    if (!userId || !supabase) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${userId}.${ext}`;
      const ab = await file.arrayBuffer();
      const { error } = await supabase.storage.from("bpro_uploads").upload(path, ab, { contentType: file.type, upsert: true });
      if (error) { alert("Avatar upload error: " + error.message); return; }
      const { data } = supabase.storage.from("bpro_uploads").getPublicUrl(path);
      const url = data.publicUrl + "?t=" + Date.now();
      setAvatarUrl(url);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
    } finally { setAvatarUploading(false); }
  }

  const name     = profile?.display_name || profile?.email?.split("@")[0] || "You";
  const shareUrl = `https://usebanger.com/dj/${userId}`;

  if (loading) return <main style={pageStyle}><div style={shellStyle}><div style={emptyStyle}>Loading…</div></div></main>;

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>

        <div style={tabBarStyle}>
          {(["profile","messages"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, ...(tab===t?tabActive:{}) }}>
              {t==="profile" ? "PROFILE" : t==="settings" ? "SETTINGS" : `CHAT${convs.reduce((a,c)=>a+c.unread,0)>0?` (${convs.reduce((a,c)=>a+c.unread,0)})`:""}`}
            </button>
          ))}
        </div>

        {tab==="profile" && (<>

          {/* ── IDENTITY CARD ── */}
          <div style={identityCard}>
            {/* Avatar + name row */}
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              {/* Avatar — cliquable pour changer la photo */}
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value=""; }} />
              <div onClick={() => avatarInputRef.current?.click()}
                style={{ ...avatarStyle, cursor:"pointer", position:"relative", overflow:"hidden", flexShrink:0 }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} />
                  : <span>{name.charAt(0).toUpperCase()}</span>
                }
                {avatarUploading && (
                  <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>⏳</div>
                )}
                {/* Petit badge caméra */}
                <div style={{ position:"absolute", bottom:0, right:0, width:20, height:20, borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>📷</div>
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
                  <span style={{ fontSize:22, fontWeight:900, letterSpacing:"-0.01em" }}>{name}</span>
                  {!loading && role==="pro" && <span style={proBadge}>✦ PRO</span>}
                </div>
                {profile?.genre && <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:3 }}>{profile.genre}</div>}
                {/* Social links avec logos SVG */}
                {(profile?.instagram || profile?.soundcloud) && (
                  <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" as const }}>
                    {profile?.instagram && (
                      <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={socialLink}>
                        {/* Instagram logo SVG */}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ verticalAlign:"middle", marginRight:5 }}>
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>
                        </svg>
                        {profile.instagram.replace("@","")}
                      </a>
                    )}
                    {profile?.soundcloud && (
                      <a href={`https://soundcloud.com/${profile.soundcloud.replace("@","")}`} target="_blank" rel="noreferrer" style={socialLink}>
                        {/* SoundCloud logo SVG */}
                        <svg width="15" height="11" viewBox="0 0 30 20" fill="currentColor" style={{ verticalAlign:"middle", marginRight:5 }}>
                          <path d="M0 13.5c0 2 1.6 3.5 3.5 3.5H22c2.8 0 5-2.2 5-5 0-2.6-2-4.8-4.5-5-.3-4-3.7-7-7.8-6.4C13.3.8 12 2.5 12 4.5v9H0v0z" opacity="0.9"/>
                          <rect x="2" y="10" width="1.5" height="6" rx="0.75"/>
                          <rect x="5" y="8" width="1.5" height="8" rx="0.75"/>
                          <rect x="8" y="9" width="1.5" height="7" rx="0.75"/>
                        </svg>
                        {profile.soundcloud.replace("@","")}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile?.bio && (
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.60)", lineHeight:1.5, borderLeft:"2px solid rgba(255,255,255,0.10)", paddingLeft:12 }}>
                {profile.bio}
              </div>
            )}

            {/* Stats row — compact */}
            <div style={statsRow}>
              {[{l:"SCANS",v:scans.length},{l:"FOLLOWERS",v:profile?.follower_count||0},{l:"FOLLOWING",v:profile?.following_count||0},{l:"FOLLOWS",v:follows.length}].map(({l,v},i)=>(
                <div key={l}
                  onClick={l==="FOLLOWERS" ? () => setPeopleList("followers") : l==="FOLLOWING" ? () => setPeopleList("following") : undefined}
                  style={{ textAlign:"center" as const, flex:1, minWidth:0, boxSizing:"border-box" as const, cursor:(l==="FOLLOWERS"||l==="FOLLOWING")?"pointer":"default", ...(i<3?{borderRight:"1px solid rgba(255,255,255,0.07)"}:{}) }}>
                  <div style={{ fontSize:17, fontWeight:900, lineHeight:1 }}>{v}</div>
                  <div style={{ fontSize:7, color:"rgba(255,255,255,0.35)", letterSpacing:"0.06em", marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── FIND PEOPLE (discreet) ── */}
          <PeopleSearch selfId={userId} />
          {peopleList && userId && (
            <PeopleSheet userId={userId} list={peopleList} onClose={() => setPeopleList(null)} />
          )}

          {/* ── ACTION BUTTONS ── */}
          <div style={{ display:"grid", gap:10 }}>
            <button onClick={() => setEditing(v=>!v)} style={editBtn}>{editing ? "Cancel" : "Edit Profile"}</button>
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

          {/* ── SCANS LIST ── */}
          {scans.length > 0 && (
            <Section title="RECENT SCANS">
              <div style={{ display:"grid", gap:2 }}>
                {(showMoreScans ? scans : scans.slice(0,3)).map((s,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", width:"100%", overflow:"hidden" }}>
                    <div style={{ flex:1, minWidth:0, overflow:"hidden" }}>
                      <div style={{ fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{s.track_title || "Unknown"}</div>
                      {s.track_subtitle && <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, marginTop:2 }}>{s.track_subtitle}</div>}
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, flexShrink:0, whiteSpace:"nowrap" as const, border: s.result_type === "recognized_unreleased" ? "1px solid rgba(255,180,0,0.7)" : "1px solid rgba(29,185,84,0.7)", color: s.result_type === "recognized_unreleased" ? "rgba(255,180,0,1)" : "rgba(29,185,84,1)", borderRadius:5, padding:"2px 6px", letterSpacing:"0.04em" }}>
                      {s.result_type === "recognized_unreleased" ? "UNREL" : "REL"}
                    </span>
                  </div>
                ))}
                {scans.length > 3 && (
                  <button onClick={()=>setShowMoreScans(v=>!v)} style={showMoreBtn}>
                    {showMoreScans ? "Show less" : `+${scans.length-3} more`}
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* ── FOLLOWS LIST ── */}
          {follows.length > 0 && (
            <Section title="TRACK FOLLOWS">
              <div style={{ display:"grid", gap:2 }}>
                {(showMoreFollows ? follows : follows.slice(0,3)).map((f,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", width:"100%", overflow:"hidden" }}>
                    <span style={{ flex:1, fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, minWidth:0 }}>{f.track_title || "Unknown"}</span>
                    <span style={{ fontSize:11, color: f.is_released ? "rgba(29,185,84,0.80)" : "rgba(255,255,255,0.30)", flexShrink:0, letterSpacing:"0.02em", whiteSpace:"nowrap" as const }}>
                      {f.is_released ? "OUT" : "WAITING"}
                    </span>
                  </div>
                ))}
                {follows.length > 3 && (
                  <button onClick={()=>setShowMoreFollows(v=>!v)} style={showMoreBtn}>
                    {showMoreFollows ? "Show less" : `+${follows.length-3} more`}
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* ── MES TRACKS (en dernier) ── */}
          {tracks.length > 0 && (
            <Section title="MY UPLOADS">
              <div style={{ display:"grid", gap:4 }}>
                {(showMoreTracks ? tracks : tracks.slice(0,3)).map((t) => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ flex:1, minWidth:0, overflow:"hidden" }}>
                      <div style={{ fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{t.title}</div>
                      {t.artist && <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, marginTop:2 }}>{t.artist}</div>}
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = !t.is_released;
                        setTracks((prev: any[]) => prev.map((x: any) => x.id === t.id ? { ...x, is_released: newVal, release_status: newVal ? "released" : "unreleased" } : x));
                        try {
                          const res = await fetch("/api/bpro/set-release", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ track_id: t.id, is_released: newVal }) });
                          if (!res.ok) throw new Error("failed");
                        } catch {
                          setTracks((prev: any[]) => prev.map((x: any) => x.id === t.id ? { ...x, is_released: !newVal, release_status: !newVal ? "released" : "unreleased" } : x));
                        }
                      }}
                      style={{ fontSize:9, fontWeight:700, flexShrink:0, cursor:"pointer", border: t.is_released ? "1px solid rgba(29,185,84,0.7)" : "1px solid rgba(255,180,0,0.7)", color: t.is_released ? "rgba(29,185,84,1)" : "rgba(255,180,0,1)", background:"none", borderRadius:5, padding:"3px 8px", letterSpacing:"0.04em", whiteSpace:"nowrap" as const }}
                    >
                      {t.is_released ? "REL" : "UNREL"}
                    </button>
                  </div>
                ))}
                {tracks.length > 3 && (
                  <button onClick={()=>setShowMoreTracks(v=>!v)} style={showMoreBtn}>
                    {showMoreTracks ? "Show less" : `+${tracks.length-3} more`}
                  </button>
                )}
              </div>
            </Section>
          )}

        </>)}

        {tab==="messages" && (
          <div style={{ display:"grid", gap:12 }}>
            {!activeConv ? (<>
              <div style={sectionTitleStyle}>CONVERSATIONS</div>
              {convs.length===0
                ? <div style={emptyStyle}>No messages yet.</div>
                : convs.map(c=>(
                  <div key={c.user_id} style={{ position:"relative" as const }}>
                    <button onClick={()=>setActiveConv(c.user_id)} style={convRow}>
                      <div style={avatarSmall}>
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt="" style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }} />
                          : (c.display_name||"?").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex:1, textAlign:"left" as const, minWidth:0, overflow:"hidden" }}>
                        <div style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.display_name||c.user_id.slice(0,8)}</div>
                        <div style={{ fontSize:12, opacity:0.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.last}</div>
                      </div>
                      {c.unread>0 && <div style={unreadBadge}>{c.unread}</div>}
                    </button>
                    {/* Bouton supprimer */}
                    <button onClick={e=>{ e.stopPropagation(); setConvToDelete(c.user_id); }}
                      style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)",
                        background:"none", border:"none", color:"rgba(255,80,80,0.55)", fontSize:18,
                        cursor:"pointer", padding:"4px 8px", lineHeight:1 }}>×</button>
                  </div>
                ))}
              {/* Modal confirmation suppression */}
              {convToDelete && (
                <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.7)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}
                  onClick={()=>setConvToDelete(null)}>
                  <div style={{ background:"#111", border:"1px solid rgba(255,255,255,0.12)",
                    borderRadius:20, padding:"24px 20px", maxWidth:300, width:"90%", textAlign:"center" as const }}
                    onClick={e=>e.stopPropagation()}>
                    <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>Supprimer la conversation ?</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginBottom:20 }}>
                      Tous les messages seront effacés définitivement.
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={()=>setConvToDelete(null)}
                        style={{ flex:1, padding:"11px 0", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)",
                          background:"none", color:"#fff", fontSize:14, cursor:"pointer" }}>Annuler</button>
                      <button onClick={()=>deleteConversation(convToDelete)}
                        style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none",
                          background:"rgba(255,60,60,0.85)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>Supprimer</button>
                    </div>
                  </div>
                </div>
              )}
            </>) : (<>
              <button onClick={()=>setActiveConv(null)} style={backBtn}>← Back</button>
              {/* Conversation header */}
              <div style={{ textAlign:"center", fontSize:13, fontWeight:700, opacity:0.55, paddingBottom:4 }}>
                {convs.find(c=>c.user_id===activeConv)?.display_name || pendingName || activeConv?.slice(0,8)}
              </div>
              <div style={{ display:"grid", gap:6, maxHeight:"50vh", overflowY:"auto" as const }}>
                {messages.map(msg=>{
                  const isMine = msg.sender_id===userId;
                  return (
                    <div key={msg.id} style={{ display:"flex", flexDirection:"column", alignItems:isMine?"flex-end":"flex-start" }}>
                      {!isMine && (
                        <div style={{ fontSize:11, fontWeight:700, opacity:0.45, marginBottom:2, paddingLeft:44 }}>{msg.sender_name || "?"}</div>
                      )}
                      <div style={{ display:"flex", alignItems:"flex-end", gap:6, flexDirection:isMine?"row-reverse":"row" }}>
                        {/* Avatar mini */}
                        <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, overflow:"hidden",
                          background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:12, fontWeight:900 }}>
                          {isMine
                            ? (avatarUrl ? <img src={avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (profile?.display_name||"?").charAt(0).toUpperCase())
                            : (msg.sender_avatar ? <img src={msg.sender_avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (msg.sender_name||"?").charAt(0).toUpperCase())
                          }
                        </div>
                        <div style={{ maxWidth:"75%", minWidth:0, padding: msg.file_url && !msg.content ? "8px" : "10px 14px", fontSize:14, lineHeight:1.4,
                          borderRadius:isMine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                          background:isMine?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.10)",
                          border:isMine?"none":"1px solid rgba(255,255,255,0.08)",
                          color:"#fff", wordBreak:"break-word", overflowWrap:"anywhere" }}>
                          {(() => {
                            // Detect fallback text pattern: "📎 filename — https://..." (em dash or regular dash)
                            const fallbackMatch = !msg.file_url && msg.content?.match(/^📎\s+(.+?)\s+[—\-–]\s+(https?:\/\/.+)$/);
                            const fileUrl = msg.file_url || (fallbackMatch ? fallbackMatch[2] : null);
                            const fileName = msg.file_name || (fallbackMatch ? fallbackMatch[1] : null);
                            const fileType = msg.file_type || "";
                            const isAudio = fileUrl && (fileType.startsWith("audio/") || /\.(mp3|wav|aif|aiff|flac|ogg|m4a)$/i.test(fileName||"") || /\.(mp3|wav|aif|aiff|flac|ogg|m4a)$/i.test(fileUrl));
                            if (fileUrl && isAudio) return (
                              <AudioPlayer src={fileUrl} name={fileName || "audio"} />
                            );
                            if (fileUrl) return (
                              <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:8, color:"#fff", textDecoration:"none" }}>
                                <span style={{ fontSize:20 }}>📎</span>
                                <span style={{ fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{fileName}</span>
                              </a>
                            );
                            // Regular text message
                            if (msg.content && !fallbackMatch) return <span>{msg.content}</span>;
                            return null;
                          })()}
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
              <div style={{ display:"flex", gap:8, alignItems:"center", overflow:"hidden", boxSizing:"border-box" as const }}>
                {/* Hidden file inputs */}
                <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.aif,.aiff,.flac,.ogg,.m4a"
                  style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value=""; }} />
                {/* Paperclip button */}
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{ width:44, height:44, minWidth:44, borderRadius:"50%", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: uploading ? 0.5 : 1 }}>
                  {uploading ? "⏳" : "📎"}
                </button>
                <input value={msgInput} onChange={e=>setMsgInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Message…"
                  style={{ flex:1, minWidth:0, padding:"10px 12px", borderRadius:12, background:"#0d0d0d", border:"1px solid rgba(255,255,255,0.10)", color:"#fff", fontSize:14, boxSizing:"border-box" as const, marginTop:0 }} />
                <button onClick={sendMsg} disabled={!msgInput.trim()} style={sendMsgBtn}>↑</button>
              </div>
            </>)}
          </div>
        )}

      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", background:"#000", color:"#fff", padding:"0 0 120px", overflowX:"hidden", boxSizing:"border-box" };
const shellStyle: React.CSSProperties = { maxWidth:680, margin:"0 auto", padding:"16px 14px", display:"grid", gap:14, overflowX:"hidden", boxSizing:"border-box", width:"100%" };
const sectionStyle: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:"14px 14px", display:"grid", gap:10, boxSizing:"border-box", overflow:"hidden" };
const sectionTitleStyle: React.CSSProperties = { fontSize:9, fontWeight:900, letterSpacing:"0.22em", color:"rgba(255,255,255,0.30)" };
// identity card replaces old headerStyle
const identityCard: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.09)", borderRadius:24, padding:"18px 14px", display:"grid", gap:14, background:"linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))", boxSizing:"border-box", overflow:"hidden" };
const statsRow: React.CSSProperties = { display:"flex", background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"10px 0", overflow:"hidden", boxSizing:"border-box" };
const avatarStyle: React.CSSProperties = { width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))", border:"1px solid rgba(255,255,255,0.14)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:900, flexShrink:0 };
const avatarSmall: React.CSSProperties = { width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, flexShrink:0 };
const proBadge: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.14em", border:"1px solid rgba(255,255,255,0.30)", borderRadius:999, padding:"3px 9px", color:"#fff" };
const socialLink: React.CSSProperties = { fontSize:12, color:"rgba(255,255,255,0.55)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:999, padding:"5px 12px", textDecoration:"none" };
const shareBtn: React.CSSProperties = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"9px 14px", color:"rgba(255,255,255,0.40)", fontSize:12, cursor:"pointer", textAlign:"left" as const };
const editBtn: React.CSSProperties = { padding:"13px 16px", borderRadius:14, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" };
const upgradeBtn: React.CSSProperties = { padding:"13px 16px", borderRadius:14, background:"linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.06))", border:"1px solid rgba(255,255,255,0.22)", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" };
const downgradeBtn: React.CSSProperties = { padding:"11px 16px", borderRadius:14, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.35)", fontWeight:600, fontSize:13, cursor:"pointer" };
const inputStyle: React.CSSProperties = { display:"block", width:"100%", marginTop:6, padding:"10px 12px", borderRadius:12, background:"#0d0d0d", border:"1px solid rgba(255,255,255,0.10)", color:"#fff", fontSize:14, boxSizing:"border-box", minWidth:0 };
const saveBtn: React.CSSProperties = { padding:"13px 16px", borderRadius:14, background:"#fff", color:"#000", fontWeight:800, fontSize:14, cursor:"pointer", border:"none" };
const tabBarStyle: React.CSSProperties = { display:"flex", width:"100%", borderBottom:"1px solid rgba(255,255,255,0.08)", marginBottom:16 };
const tabBtn: React.CSSProperties = { flex:1, padding:"14px 0", background:"none", border:"none", color:"rgba(255,255,255,0.45)", fontWeight:700, fontSize:12, letterSpacing:"0.12em", cursor:"pointer" };
const tabActive: React.CSSProperties = { color:"#fff", borderBottom:"2px solid #fff" };
const convRow: React.CSSProperties = { display:"flex", gap:12, alignItems:"center", padding:"12px 0", background:"none", border:"none", color:"#fff", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.06)", width:"100%", minWidth:0, overflow:"hidden", boxSizing:"border-box" };
const unreadBadge: React.CSSProperties = { width:20, height:20, borderRadius:"50%", background:"#fff", color:"#000", fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" };
const sendMsgBtn: React.CSSProperties = { width:44, height:44, borderRadius:"50%", background:"#fff", color:"#000", border:"none", fontSize:18, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };
const backBtn: React.CSSProperties = { background:"none", border:"none", color:"rgba(255,255,255,0.6)", fontSize:14, cursor:"pointer", padding:0, textAlign:"left" as const };
const emptyStyle: React.CSSProperties = { fontSize:13, opacity:0.45, padding:"4px 0" };
const showMoreBtn: React.CSSProperties = { background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"rgba(255,255,255,0.5)", fontSize:12, fontWeight:700, padding:"8px 12px", cursor:"pointer", width:"100%", marginTop:4 };
// 1781652265
