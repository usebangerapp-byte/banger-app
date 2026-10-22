"use client";

export const dynamic = "force-dynamic";

import { fmtTitle, fmtArtist } from "@/lib/format";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import PageHeader from "@/components/PageHeader";
import { PeopleSearch, PeopleSheet } from "@/components/People";
import { ui, C, glass, tag, TAG_TEXT } from "@/lib/ui";
import { promoSummary } from "@/lib/feedback";
import MarqueeText from "@/components/MarqueeText";
import TrackRow from "@/components/TrackRow";
import { usePreviewIndex, PreviewButton, trackKey, trackHref } from "@/lib/preview";
import Link from "next/link";
import { Skeleton, SkeletonTrackRow, SkeletonStyles } from "@/components/Skeleton";

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

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={{ ...sectionStyle, scrollMarginTop: 80 }}>
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
  const previews = usePreviewIndex();
  const [tracks,   setTracks]   = useState<any[]>([]);
  const [sparkData,setSparkData]= useState<number[]>([]);
  const [dropped, setDropped] = useState<{ title: string; artist: string; at: string }[]>([]);
  const [topScan,  setTopScan]  = useState<{ title: string; subtitle?: string; n: number } | null>(null);
  const [promoLine, setPromoLine] = useState<string | null>(null);
  const [proStats, setProStats] = useState<{ uploadScans7d: number; topUpload: { title: string; scans: number } | null } | null>(null);
  const [shared,   setShared]   = useState(false);
  const [tab,      setTab]      = useState<"profile"|"messages">("profile");
  // The lists under the profile card: one at a time
  const [list,     setList]     = useState<"scans"|"follows"|"uploads">("scans");
  const [showSearch, setShowSearch] = useState(false);
  const [showMoreTracks, setShowMoreTracks] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string; artist: string; busy?: boolean; error?: string } | null>(null);
  const lastMsgTap = useRef<{ id: any; t: number }>({ id: null, t: 0 });

  // Double-tap a message you received to like it (tap twice again to remove)
  function tapMessage(msg: any) {
    if (msg.sender_id === userId) return;
    const now = Date.now();
    const isDouble = lastMsgTap.current.id === msg.id && now - lastMsgTap.current.t < 320;
    lastMsgTap.current = { id: msg.id, t: now };
    if (!isDouble) return;
    const like = !msg.liked_at;
    setMessages((p: any[]) => p.map((m: any) => m.id === msg.id ? { ...m, liked_at: like ? new Date().toISOString() : null } : m));
    try { navigator.vibrate?.(12); } catch {}
    authFetch("/api/messages/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: msg.id, like }) }).catch(() => {});
  }
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
      if (sp.get("edit") === "1") setEditing(true);
      const l = sp.get("list"); if (l === "scans" || l === "follows" || l === "uploads") setList(l);
    } catch {}
    // the ✉️ button in the top bar, when already on this page
    const open = () => { setTab("messages"); setActiveConv(null); };
    window.addEventListener("banger:messages", open);
    return () => window.removeEventListener("banger:messages", open);
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

        const fRes = await authFetch(`/api/follow-track?user_id=${uid}`, { cache: "no-store" });
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
          // The track you scanned the most (recent history)
          const tally = new Map<string, { title: string; subtitle?: string; n: number }>();
          for (const s of scanData as any[]) {
            const key = (s.track_title || "").toLowerCase().trim();
            if (!key) continue;
            const cur = tally.get(key) || { title: s.track_title, subtitle: s.track_subtitle, n: 0 };
            cur.n += 1; tally.set(key, cur);
          }
          const best = Array.from(tally.values()).sort((a, b) => b.n - a.n)[0];
          setTopScan(best && best.n > 1 ? best : null);
        }

        if (email) {
          const { data: bpro } = await supabase.from("bpro_tracks")
            .select("id,title,artist,release_status,is_released")
            .eq("uploader_email", email).order("created_at", { ascending: false }).limit(200);
          if (mounted) setTracks(bpro || []);
        }
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  useEffect(() => {
    if (!userId || tab !== "messages") return;
    const loadConvs = () => authFetch(`/api/messages/list`)
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
          map.set(other, { user_id: other, display_name, avatar_url, last: rawLast, lastAt: msg.created_at,
            unread: msg.receiver_id === userId && !msg.read ? (map.get(other)?.unread||0)+1 : (map.get(other)?.unread||0) });
        }
        // most recent conversation on top
        setConvs(Array.from(map.values()).sort((a: any, b: any) => String(b.lastAt).localeCompare(String(a.lastAt))));
      }).catch(() => {});
    loadConvs();
    const t = window.setInterval(loadConvs, 10000);
    return () => window.clearInterval(t);
  }, [userId, tab]);

  useEffect(() => {
    if (!activeConv || !userId) return;
    let alive = true;
    const loadThread = () => authFetch(`/api/messages/list?other_id=${activeConv}`)
      .then(r => r.json())
      .then(j => {
        if (!alive || !Array.isArray(j?.messages)) return;
        const next = j.messages;
        setMessages(prev => {
          const sig = (l: any[]) => l.map(m => `${m.id}:${m.read ? 1 : 0}`).join(",");
          return sig(prev) === sig(next) ? prev : next;
        });
      }).catch(() => {});
    loadThread();
    const t = window.setInterval(loadThread, 4000);
    return () => { alive = false; window.clearInterval(t); };
  }, [activeConv, userId]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Followed tracks that just came out (from my "is out now" notifications, last 30 days)
  useEffect(() => {
    if (!userId) return;
    authFetch("/api/notifications").then(r => r.json()).then(j => {
      const since = Date.now() - 30 * 86400000;
      const rows = (j?.notifications || []).filter((n: any) => n.type === "track_released" && n.track_title && new Date(n.created_at).getTime() >= since);
      const seen = new Set<string>();
      setDropped(rows.filter((n: any) => { const k = String(n.track_title).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, 5).map((n: any) => ({ title: n.track_title, artist: String(n.message || "").split(" — ")[0].replace(/^Out now.*/, ""), at: n.created_at })));
    }).catch(() => {});
  }, [userId]);

  // PRO: how your uploaded IDs were scanned this week
  useEffect(() => {
    if (role !== "pro" || !userId) return;
    authFetch("/api/profile/stats").then(r => r.json())
      .then(j => { if (j?.ok) setProStats({ uploadScans7d: j.uploadScans7d || 0, topUpload: j.topUpload || null }); })
      .catch(() => {});
    // Promo feedback, all promos together ("5 DJs · 3 listened · 🔥 2 …")
    authFetch("/api/promo/list").then(r => r.json())
      .then(j => { const all = (j?.promos || []).flatMap((p: any) => p.recipients || []); if (all.length) setPromoLine(promoSummary(all)); })
      .catch(() => {});
  }, [role, userId]);

  async function shareProfile() {
    const url = `https://usebanger.com/dj/${userId}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${name} on BANGER`, url }); return; }
      await navigator.clipboard.writeText(url);
      setShared(true); window.setTimeout(() => setShared(false), 1600);
    } catch { /* user cancelled */ }
  }

  async function deleteConversation(otherUserId: string) {
    if (!userId) return;
    // Delete the whole conversation server-side (works whatever the database access rules are)
    await authFetch("/api/messages/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ other_id: otherUserId }),
    }).catch(() => {});
    setConvs(p => p.filter(c => c.user_id !== otherUserId));
    setConvToDelete(null);
  }

  async function saveProfile() {
    if (!userId) return;
    setSaving(true);
    try {
      await authFetch("/api/profile/update", {
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
    await authFetch("/api/messages/send", { method:"POST", headers:{"Content-Type":"application/json"},
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
      const sendRes = await authFetch("/api/messages/send", {
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
  const showUploads = role === "pro" || tracks.length > 0;
  function openList(l: "scans"|"follows"|"uploads") {
    setList(l);
    setTimeout(() => document.getElementById("lists")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  const shareUrl = `https://usebanger.com/dj/${userId}`;

  if (loading) return (
    <main style={pageStyle}>
      <SkeletonStyles />
      <div style={shellStyle}>
        <div style={{ ...identityCard, gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <Skeleton width={56} height={56} radius={999} />
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:8 }}>
              <Skeleton width="55%" height={18} />
              <Skeleton width="35%" height={12} />
            </div>
          </div>
          <Skeleton width="80%" height={12} />
        </div>
        <SkeletonTrackRow /><SkeletonTrackRow /><SkeletonTrackRow />
      </div>
    </main>
  );

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>

        <PageHeader title={tab==="messages" ? "Messages" : "Profile"}
          code={tab==="messages"
            ? <button onClick={() => { setTab("profile"); setActiveConv(null); try { window.history.replaceState(null, "", "/profile"); } catch {} }} style={{ ...backBtn, fontSize:13 }}>Profile ›</button>
            : <span style={{ color: role==="pro" ? C.gold : undefined }}>{role==="pro" ? "PRO" : "Free"}</span>} />

        {tab==="profile" && (<>

          {/* ── IDENTITY: avatar + stats side by side, name, links, actions — compact ── */}
          <section style={{ ...glass, borderRadius:24, padding:"16px 16px 14px", display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:12, minWidth:0 }}>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display:"none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value=""; }} />

            <div style={{ display:"flex", alignItems:"center", gap:14, minWidth:0 }}>
              {/* Avatar — tap to change the photo */}
              <div onClick={() => avatarInputRef.current?.click()}
                style={{ ...avatarStyle, width:74, height:74, fontSize:24, ...(role==="pro" ? { border:"2px solid #e9b844", boxShadow:"0 0 18px rgba(245,207,104,0.35)" } : {}), cursor:"pointer", position:"relative", overflow:"hidden", flexShrink:0 }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} />
                  : <span>{name.charAt(0).toUpperCase()}</span>}
                {avatarUploading && (
                  <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>…</div>
                )}
              </div>
              {/* Stats in columns — followers / following / follows open their list */}
              <div style={{ flex:1, minWidth:0, display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:2, textAlign:"center" }}>
                {[
                  { n: scans.length, l: "Scans", on: () => openList("scans") },
                  { n: profile?.follower_count||0, l: "Followers", on: () => setPeopleList("followers") },
                  { n: profile?.following_count||0, l: "Following", on: () => setPeopleList("following") },
                  { n: follows.length, l: "Follows", on: () => openList("follows") },
                ].map((x) => (
                  <button key={x.l} onClick={x.on} disabled={!x.on} style={{ ...statBtn, display:"grid", gap:2, cursor: x.on ? "pointer" : "default", minWidth:0 }}>
                    <span style={{ fontSize:19, fontWeight:800, color:"#fff", lineHeight:1.1 }}>{x.n}</span>
                    <span style={{ fontSize:11, color:C.text3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{x.l}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"grid", gap:4, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, minWidth:0 }}>
                <span style={{ fontSize:18, fontWeight:800, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 }}>{name}</span>
                {profile?.genre && <span style={{ fontSize:13, color:C.text3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0 }}>{profile.genre}</span>}
              </div>
              {profile?.bio && <div style={{ fontSize:14, color:C.text2, lineHeight:1.5 }}>{profile.bio}</div>}
              {(profile?.instagram || profile?.soundcloud) && (
                <div style={{ display:"flex", gap:14, flexWrap:"wrap" as const, fontSize:13 }}>
                  {profile?.instagram && (
                    <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, color:C.text2, textDecoration:"none" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>
                      {profile.instagram.replace("@","")}
                    </a>
                  )}
                  {profile?.soundcloud && (
                    <a href={`https://soundcloud.com/${profile.soundcloud.replace("@","")}`} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, color:C.text2, textDecoration:"none" }}>
                      <svg width="15" height="10" viewBox="0 0 30 20" fill="currentColor" aria-hidden="true"><path d="M0 13.5c0 2 1.6 3.5 3.5 3.5H22c2.8 0 5-2.2 5-5 0-2.6-2-4.8-4.5-5-.3-4-3.7-7-7.8-6.4C13.3.8 12 2.5 12 4.5v9H0v0z" opacity="0.9"/></svg>
                      {profile.soundcloud.replace("@","")}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Actions — one row, same height */}
            <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) 40px", gap:8 }}>
              <button onClick={() => setEditing(v=>!v)} style={{ ...ui.pill, justifyContent:"center", padding:"9px 10px", fontSize:14 }}>{editing ? "Cancel" : "Edit profile"}</button>
              <button onClick={shareProfile} style={{ ...ui.pill, justifyContent:"center", padding:"9px 10px", fontSize:14 }}>{shared ? "Link copied ✓" : "Share"}</button>
              <button onClick={() => setShowSearch(v => !v)} aria-label="Find people"
                style={{ height:40, borderRadius:999, cursor:"pointer", border:`1px solid ${showSearch ? "rgba(245,207,104,0.4)" : C.glassBorder}`,
                  background: showSearch ? "rgba(245,207,104,0.12)" : "rgba(255,255,255,0.06)", color: showSearch ? C.gold : C.text2, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              </button>
            </div>
            {!loading && role !== "pro" && (
              <button onClick={() => router.push("/upgrade")} style={{ ...ui.pillSolid, justifyContent:"center", width:"100%", padding:"11px" }}>Go Pro</button>
            )}
          </section>

          {/* ── FIND PEOPLE (discreet) ── */}
          {showSearch && <PeopleSearch selfId={userId} />}
          {peopleList && userId && (
            <PeopleSheet userId={userId} list={peopleList} onClose={() => setPeopleList(null)} />
          )}

          {editing && (
            <Section title="Edit profile">
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:10 }}>
                {[{label:"Display name",value:editName,set:setEditName,ph:"DJ Banger"},
                  {label:"Genre",value:editGenre,set:setEditGenre,ph:"Techno · House · Melodic"},
                  {label:"Instagram",value:editIG,set:setEditIG,ph:"@yourdj"},
                  {label:"SoundCloud",value:editSC,set:setEditSC,ph:"soundcloud.com/yourdj"}
                ].map(({label,value,set,ph})=>(
                  <label key={label} style={{ fontSize:13, color:C.text3 }}>
                    {label}
                    <input value={value} onChange={e=>set(e.target.value)} placeholder={ph} style={inputStyle} />
                  </label>
                ))}
                <label style={{ fontSize:13, color:C.text3 }}>Bio
                  <textarea value={editBio} onChange={e=>setEditBio(e.target.value)} placeholder="Tell your story…" rows={3} style={{ ...inputStyle, resize:"none" as const }} />
                </label>
                <button onClick={saveProfile} disabled={saving} style={saveBtn}>{saving?"Saving…":"Save Profile"}</button>
              </div>
            </Section>
          )}

          {/* ── JUST DROPPED: tracks I followed that came out (last 30 days) — only when there are some ── */}
          {dropped.length > 0 && (
            <Section title="Just dropped">
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)" }}>
                {dropped.map((d, i) => (
                  <TrackRow key={d.title + i} title={d.title} artist={d.artist} released status="rel"
                    meta={timeAgoShort(d.at)} last={i === dropped.length - 1} />
                ))}
              </div>
            </Section>
          )}

          {/* ── STUDIO (Pro): send a demo (Set mode lives in the Sets tab) ── */}
          {!loading && role === "pro" && (
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

          {/* ── MY LISTS: Scans · Follows · Uploads, one at a time ── */}
          <div id="lists" style={{ ...tabBarStyle, gridTemplateColumns: showUploads ? "1fr 1fr 1fr" : "1fr 1fr", scrollMarginTop:72 }}>
            {(showUploads ? (["scans","follows","uploads"] as const) : (["scans","follows"] as const)).map((l) => (
              <button key={l} onClick={() => setList(l)} style={{ ...tabBtn, ...(list===l?tabActive:{}) }}>
                {l==="scans" ? `Scans · ${scans.length}` : l==="follows" ? `Follows · ${follows.length}` : `Uploads · ${tracks.length}`}
              </button>
            ))}
          </div>

          {/* ── YOUR TRACKS (Pro): how often others scanned my uploads ── */}
          {list==="uploads" && proStats && (
            <div style={weekCard}>
              <div style={{ ...sectionTitleStyle, padding:"0 0 10px" }}>Your tracks</div>
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

          {/* ── SCANS LIST ── */}
          {list==="scans" && scans.length === 0 && <div style={emptyStyle}>No scans yet.</div>}
          {list==="scans" && scans.length > 0 && (
            <Section title="Recent scans">
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:2 }}>
                {(showMoreScans ? scans : scans.slice(0,10)).map((s,i) => (
                  <TrackRow key={i} title={s.track_title || "Unknown"} artist={s.track_subtitle} released={s.result_type !== "recognized_unreleased"}
                    status={s.result_type === "recognized_unreleased" ? "unrel" : "rel"} />
                ))}
                {scans.length > 10 && (
                  <button onClick={()=>setShowMoreScans(v=>!v)} style={showMoreBtn}>
                    {showMoreScans ? "Show less" : `Show ${scans.length-10} more`}
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* ── FOLLOWS LIST ── */}
          {list==="follows" && follows.length === 0 && <div style={emptyStyle}>No followed tracks yet.</div>}
          {list==="follows" && follows.length > 0 && (
            <Section title="Followed tracks" id="followed-tracks">
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:2 }}>
                {(showMoreFollows ? follows : follows.slice(0,10)).map((f,i) => (
                  <TrackRow key={f.track_title || i} title={f.track_title || "Unknown"} artist={f.track_subtitle} released={!!f.is_released}
                    status={f.is_released ? "rel" : "unrel"}
                    onFollowChange={(on) => { if (!on) setFollows((p: any[]) => p.filter((x: any) => x.track_title !== f.track_title)); }} />
                ))}
                {follows.length > 10 && (
                  <button onClick={()=>setShowMoreFollows(v=>!v)} style={showMoreBtn}>
                    {showMoreFollows ? "Show less" : `Show ${follows.length-10} more`}
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* ── MES TRACKS (en dernier) ── */}
          {list==="uploads" && tracks.length === 0 && <div style={emptyStyle}>No uploads yet.</div>}
          {list==="uploads" && tracks.length > 0 && (
            <Section title="My uploads">
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
                  <button onClick={()=>setShowMoreTracks(v=>!v)} style={showMoreBtn}>
                    {showMoreTracks ? "Show less" : `Show ${tracks.length-10} more`}
                  </button>
                )}
              </div>
            </Section>
          )}

        </>)}

        {tab==="messages" && (
          <div style={{ ...glass, borderRadius:24, padding:"14px 16px 16px", display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:12, minWidth:0 }}>
            {!activeConv ? (<>
              <div style={{ ...sectionTitleStyle, padding:"0 0 10px" }}>Conversations</div>
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
                        <div style={ui.rowTitle}>{c.display_name||c.user_id.slice(0,8)}</div>
                        <div style={ui.rowSub}>{c.last}</div>
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
                  <div style={{ ...glass, background:"rgba(30,30,30,0.85)",
                    borderRadius:24, padding:"24px 20px", maxWidth:300, width:"90%", textAlign:"center" as const }}
                    onClick={e=>e.stopPropagation()}>
                    <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>Supprimer la conversation ?</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginBottom:20 }}>
                      Tous les messages seront effacés définitivement.
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={()=>setConvToDelete(null)}
                        style={{ flex:1, padding:"11px 0", borderRadius:999, border:"1px solid rgba(255,255,255,0.12)",
                          background:"rgba(255,255,255,0.08)", color:"#fff", fontSize:14, cursor:"pointer" }}>Annuler</button>
                      <button onClick={()=>deleteConversation(convToDelete)}
                        style={{ flex:1, padding:"11px 0", borderRadius:999, border:"none",
                          background:"#e5484d", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>Supprimer</button>
                    </div>
                  </div>
                </div>
              )}
            </>) : (<>
              <button onClick={()=>setActiveConv(null)} style={backBtn}>← Back</button>
              {/* Conversation header — tap to open their profile */}
              {(() => {
                const conv = convs.find(c => c.user_id === activeConv);
                const other = messages.find(m => m.sender_id === activeConv);
                const otherName = conv?.display_name || other?.sender_name || pendingName || activeConv?.slice(0,8) || "";
                const otherAvatar = conv?.avatar_url || other?.sender_avatar || null;
                return (
                  <button onClick={() => router.push(`/dj/${activeConv}`)} style={chatHeader}>
                    <div style={{ ...avatarSmall, width:30, height:30, fontSize:12 }}>
                      {otherAvatar
                        ? <img src={otherAvatar} alt="" style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }} />
                        : otherName.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize:16, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{otherName}</span>
                    <span style={{ color:"rgba(255,255,255,0.3)", fontSize:13 }}>›</span>
                  </button>
                );
              })()}
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:6, maxHeight:"50vh", overflowY:"auto" as const }}>
                {messages.map((msg, idx)=>{
                  const isMine = msg.sender_id===userId;
                  const lastMineIdx = (() => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].sender_id === userId) return i; return -1; })();
                  const next = messages[idx + 1];
                  // show the time when the next message is from someone else or > 5 min later
                  const showTime = !next || next.sender_id !== msg.sender_id ||
                    (new Date(next.created_at).getTime() - new Date(msg.created_at).getTime()) > 5 * 60 * 1000;
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
                        <div onClick={() => tapMessage(msg)} style={{ position:"relative", maxWidth:"75%", minWidth:0, marginBottom: msg.liked_at ? 10 : 0, padding: msg.file_url && !msg.content ? "8px" : "10px 14px", fontSize:14, lineHeight:1.4,
                          borderRadius:isMine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                          background:isMine?C.goldGrad:"rgba(255,255,255,0.10)",
                          border:isMine?"none":"1px solid rgba(255,255,255,0.08)",
                          color:isMine?C.goldInk:"#fff", wordBreak:"break-word", overflowWrap:"anywhere" }}>
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
                            // Private promo track → listen card
                            const promoMatch = msg.content?.match(/^🔒 Private track: (.+?) — (\S*\/listen\/[A-Za-z0-9]+)(?:\n([\s\S]*))?$/);
                            if (promoMatch) {
                              const path = promoMatch[2].replace(/^https?:\/\/[^/]+/, "");
                              return (
                                <a href={path}
                                  // so "Back" on the track returns to this exact conversation
                                  onClick={() => { try { window.history.replaceState(null, "", `/profile?tab=messages&with=${activeConv}`); } catch {} }}
                                  style={{ display:"grid", gap:6, textDecoration:"none", color:"inherit", minWidth:180 }}>
                                  <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", opacity:0.75 }}>🔒 PRIVATE TRACK</span>
                                  <span style={{ fontSize:15, fontWeight:700, lineHeight:1.3 }}>{promoMatch[1]}</span>
                                  {promoMatch[3] && <span style={{ fontSize:13, opacity:0.8 }}>{promoMatch[3]}</span>}
                                  <span style={{ justifySelf:"start", marginTop:2, padding:"6px 12px", borderRadius:999, fontSize:12, fontWeight:700,
                                    background: isMine ? "rgba(0,0,0,0.18)" : C.goldGrad, color: isMine ? C.goldInk : C.goldInk }}>▶ Listen</span>
                                </a>
                              );
                            }
                            // Regular text message
                            if (msg.content && !fallbackMatch) return <span>{msg.content}</span>;
                            return null;
                          })()}
                          {msg.liked_at && (
                            <span aria-label="Liked" style={{ position:"absolute", bottom:-11, [isMine ? "left" : "right"]: 8, fontSize:12, lineHeight:1,
                              padding:"3px 5px", borderRadius:999, background:"rgb(30,30,30)", border:"1px solid rgba(255,255,255,0.14)", color:"#e9b844" } as any}>♥</span>
                          )}
                        </div>
                        {isMine && (
                          <button onClick={async()=>{
                            await authFetch("/api/messages/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message_id:msg.id})});
                            setMessages(p=>p.filter(m=>m.id!==msg.id));
                          }} style={{ background:"none",border:"none",color:"rgba(255,80,80,0.5)",fontSize:14,cursor:"pointer",padding:"0 2px",flexShrink:0 }}>✕</button>
                        )}
                      </div>
                      {(showTime || (isMine && idx === lastMineIdx)) && (
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:3, padding: isMine ? "0 26px 0 0" : "0 0 0 40px" }}>
                          {showTime ? formatMsgTime(msg.created_at) : ""}
                          {isMine && idx === lastMineIdx && msg.read ? `${showTime ? " · " : ""}Seen` : ""}
                        </div>
                      )}
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
                  style={{ ...ui.input, flex:1, minWidth:0, borderRadius:999, padding:"11px 16px", marginTop:0 }} />
                <button onClick={sendMsg} disabled={!msgInput.trim()} style={sendMsgBtn}>↑</button>
              </div>
            </>)}
          </div>
        )}

      </div>
    </main>
  );
}

const weekCard: React.CSSProperties = { ...glass, borderRadius:24, padding:"14px 16px 16px", display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:0 };
const weekLine: React.CSSProperties = { display:"flex", alignItems:"center", gap:10, fontSize:14, color:C.text2, minWidth:0, borderTop:`1px solid ${C.lineSoft}`, paddingTop:14, marginTop:14 };

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return hm;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${hm}`;
}
const chatHeader: React.CSSProperties = { display:"flex", alignItems:"center", gap:10, justifyContent:"center", background:"none", border:"none", color:"#fff", cursor:"pointer", padding:"2px 0 8px", minWidth:0, maxWidth:"100%" };

const pageStyle: React.CSSProperties = { ...ui.page };
const shellStyle: React.CSSProperties = { ...ui.shell, gap:16 };
const sectionStyle: React.CSSProperties = { ...ui.section, paddingBottom:4 };
const sectionTitleStyle: React.CSSProperties = { ...ui.label };
// identity card replaces old headerStyle
const identityCard: React.CSSProperties = { ...glass, borderRadius:24, padding:18, display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:12, boxSizing:"border-box", overflow:"hidden" };
const statsRow: React.CSSProperties = { display:"flex", background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"10px 0", overflow:"hidden", boxSizing:"border-box" };
const avatarStyle: React.CSSProperties = { width:64, height:64, boxSizing:"border-box", borderRadius:"50%", background:"rgba(255,255,255,0.08)", border:`1px solid ${C.line}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, flexShrink:0 };
const statsLine: React.CSSProperties = { display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", fontSize:13, color:C.text3 };
const statBtn: React.CSSProperties = { background:"none", border:"none", padding:0, color:"inherit", font:"inherit", cursor:"pointer" };
const statNum: React.CSSProperties = { color:"#fff", fontWeight:700, fontSize:15, marginRight:3 };
const avatarSmall: React.CSSProperties = { width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, flexShrink:0 };
const proBadge: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.14em", border:"1px solid rgba(255,255,255,0.30)", borderRadius:999, padding:"3px 9px", color:"#fff" };
const socialLink: React.CSSProperties = { display:"inline-flex", alignItems:"center", gap:5, whiteSpace:"nowrap", fontSize:11, color:"rgba(255,255,255,0.55)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:999, padding:"3px 9px", textDecoration:"none", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis" };
const shareBtn: React.CSSProperties = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"9px 14px", color:"rgba(255,255,255,0.40)", fontSize:12, cursor:"pointer", textAlign:"left" as const };
const editBtn: React.CSSProperties = { padding:"5px 12px", borderRadius:999, background:"transparent", border:"1px solid rgba(255,255,255,0.16)", color:"rgba(255,255,255,0.8)", fontWeight:700, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" };
const upgradeBtn: React.CSSProperties = { padding:"5px 12px", borderRadius:999, background:"rgba(255,255,255,0.92)", border:"1px solid transparent", color:"#000", fontWeight:800, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" };
const downgradeBtn: React.CSSProperties = { padding:"11px 16px", borderRadius:14, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.35)", fontWeight:600, fontSize:13, cursor:"pointer" };
const inputStyle: React.CSSProperties = { ...ui.input, display:"block", marginTop:6 };
const saveBtn: React.CSSProperties = { ...ui.pillSolid, justifySelf:"start", padding:"12px 22px" };
const tabBarStyle: React.CSSProperties = { ...glass, display:"grid", gridTemplateColumns:"1fr 1fr", padding:4, borderRadius:999 };
const tabBtn: React.CSSProperties = { padding:"9px 0", background:"transparent", border:"none", borderRadius:999, color:C.text3, fontWeight:500, fontSize:14, cursor:"pointer", fontFamily:"inherit" };
const tabActive: React.CSSProperties = { color:"#fff", fontWeight:600, background:"rgba(255,255,255,0.16)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.15)" };
const convRow: React.CSSProperties = { display:"flex", gap:14, alignItems:"center", padding:"13px 0", background:"none", border:"none", color:"#fff", cursor:"pointer", borderBottom:`1px solid ${C.lineSoft}`, width:"100%", minWidth:0, overflow:"hidden", boxSizing:"border-box", textAlign:"left" };
const unreadBadge: React.CSSProperties = { minWidth:20, height:20, padding:"0 5px", boxSizing:"border-box", borderRadius:999, background:C.goldGrad, color:C.goldInk, fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" };
const sendMsgBtn: React.CSSProperties = { width:44, height:44, borderRadius:"50%", background:C.goldGrad, color:C.goldInk, border:"none", fontSize:18, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };
const backBtn: React.CSSProperties = { background:"none", border:"none", color:C.gold, fontSize:15, fontWeight:500, cursor:"pointer", padding:0, textAlign:"left" as const, fontFamily:"inherit" };
const emptyStyle: React.CSSProperties = { ...ui.empty };
const showMoreBtn: React.CSSProperties = { ...ui.more };
// 1781652265

function timeAgoShort(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "Out today" : d === 1 ? "Out yesterday" : `Out ${d} days ago`;
}
