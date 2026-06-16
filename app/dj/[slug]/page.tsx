"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { SkeletonTrackRow, SkeletonStyles } from "@/components/Skeleton";

type Profile = {
  id: string; email: string; display_name: string | null;
  bio: string | null; genre: string | null;
  instagram: string | null; soundcloud: string | null;
  role: string; avatar_url: string | null;
  follower_count: number; following_count: number;
};
type Track = { id: string; title: string | null; artist: string | null; release_status: string; is_released: boolean | null };

export default function DJProfilePage() {
  const params   = useParams();
  const router   = useRouter();
  const slug     = decodeURIComponent((params?.slug as string) || "");
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [tracks,     setTracks]     = useState<Track[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [myUserId,   setMyUserId]   = useState<string | null>(null);
  const [following,  setFollowing]  = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [msgText,    setMsgText]    = useState("");
  const [msgSent,    setMsgSent]    = useState(false);
  const [msgBusy,    setMsgBusy]    = useState(false);
  const [notFound,   setNotFound]   = useState(false);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    fetch(`/api/profile/get?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(j => {
        if (!mounted) return;
        if (!j.ok) { setNotFound(true); setLoading(false); return; }
        setProfile(j.profile);
        setTracks(j.tracks || []);
        setLoading(false);
      })
      .catch(() => { if (mounted) { setNotFound(true); setLoading(false); } });
    return () => { mounted = false; };
  }, [slug]);

  useEffect(() => {
    if (!supabase || !profile) return;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data?.session?.user?.id || null;
      setMyUserId(uid);
      if (!uid) return;
      fetch(`/api/profile/follow?user_id=${uid}`)
        .then(r => r.json())
        .then(j => {
          const list = Array.isArray(j?.following) ? j.following : [];
          setFollowing(list.includes(profile.id));
        }).catch(() => {});
    });
  }, [supabase, profile]);

  async function toggleFollow() {
    if (!myUserId || !profile) return;
    setFollowBusy(true);
    try {
      const action = following ? "unfollow" : "follow";
      const res = await fetch("/api/profile/follow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, follower_id: myUserId, following_id: profile.id }),
      });
      const j = await res.json();
      if (j.ok) {
        setFollowing(!following);
        setProfile(prev => prev ? { ...prev, follower_count: prev.follower_count + (following ? -1 : 1) } : prev);
      }
    } finally { setFollowBusy(false); }
  }

  async function sendMessage() {
    if (!myUserId || !profile || !msgText.trim()) return;
    setMsgBusy(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: myUserId, receiver_id: profile.id, content: msgText.trim() }),
      });
      const j = await res.json();
      if (j.ok) { setMsgSent(true); setMsgText(""); }
    } finally { setMsgBusy(false); }
  }

  if (loading) return (
    <main style={pageStyle}><SkeletonStyles />
      <div style={shellStyle}>{Array.from({ length: 4 }).map((_, i) => <SkeletonTrackRow key={i} />)}</div>
    </main>
  );

  if (notFound) return (
    <main style={pageStyle}>
      <div style={{ ...shellStyle, textAlign: "center" as const, paddingTop: 80 }}>
        <div style={{ fontSize: 48 }}>🎧</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 16 }}>DJ not found</div>
        <div style={{ fontSize: 14, opacity: 0.5, marginTop: 8 }}>No profile found for "{slug}"</div>
        <button onClick={() => router.push("/home")} style={{ ...followBtnBase, marginTop: 24, background: "#fff", color: "#000", border: "none" }}>Go scan</button>
      </div>
    </main>
  );

  const displayName  = profile?.display_name || slug;
  const isOwnProfile = myUserId === profile?.id;

  return (
    <main style={pageStyle}>
      <SkeletonStyles />
      <div style={shellStyle}>
        <button onClick={() => router.back()} style={backStyle}>← Back</button>

        <div style={headerStyle}>
          <div style={avatarStyle}>{displayName.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{displayName}</h1>
              {profile?.role === "pro" && <span style={proBadge}>✦ PRO</span>}
            </div>
            {profile?.genre && <div style={{ fontSize: 13, opacity: 0.55, marginTop: 4 }}>{profile.genre}</div>}
            {profile?.bio   && <div style={{ fontSize: 14, opacity: 0.8, marginTop: 8, lineHeight: 1.5 }}>{profile.bio}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" as const }}>
              {profile?.instagram  && <a href={`https://instagram.com/${profile.instagram.replace("@","")}`}  target="_blank" rel="noreferrer" style={socialStyle}>IG @{profile.instagram.replace("@","")}</a>}
              {profile?.soundcloud && <a href={`https://soundcloud.com/${profile.soundcloud.replace("@","")}`} target="_blank" rel="noreferrer" style={socialStyle}>SC {profile.soundcloud}</a>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[{ v: profile?.follower_count||0, l:"FOLLOWERS" }, { v: profile?.following_count||0, l:"FOLLOWING" }, { v: tracks.length, l:"TRACKS" }].map(({v,l}) => (
              <div key={l} style={{ textAlign: "center" as const }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{v}</div>
                <div style={{ fontSize: 9, opacity: 0.45, letterSpacing: "0.14em" }}>{l}</div>
              </div>
            ))}
          </div>
          {!isOwnProfile && myUserId && (
            <button onClick={toggleFollow} disabled={followBusy} style={{ ...followBtnBase, background: following ? "rgba(255,255,255,0.08)" : "#fff", color: following ? "#fff" : "#000", border: following ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
              {followBusy ? "…" : following ? "Following ✓" : `Follow ${displayName}`}
            </button>
          )}
          {isOwnProfile && (
            <button onClick={() => router.push("/profile")} style={{ background:"none", border:"1px solid rgba(255,255,255,0.10)", borderRadius:14, padding:"11px 16px", color:"rgba(255,255,255,0.6)", fontSize:13, cursor:"pointer" }}>
              Edit your profile →
            </button>
          )}
          {!myUserId && (
            <button onClick={() => router.push("/")} style={{ ...followBtnBase, background:"#fff", color:"#000", border:"none" }}>
              Sign in to follow & message
            </button>
          )}
        </div>

        {tracks.length > 0 && (
          <div style={sectionStyle}>
            <div style={secTitle}>TRACKS</div>
            {tracks.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{t.title||"Untitled"}</div>
                  {t.artist && <div style={{ fontSize:12, opacity:0.5, marginTop:2 }}>{t.artist}</div>}
                </div>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.12em", color:t.is_released?"#1db954":"rgba(255,255,255,0.55)", border:`1px solid ${t.is_released?"rgba(29,185,84,0.35)":"rgba(255,255,255,0.12)"}`, borderRadius:999, padding:"3px 8px", whiteSpace:"nowrap" as const }}>
                  {t.is_released ? "RELEASED" : "UNRELEASED"}
                </span>
              </div>
            ))}
          </div>
        )}

        {!isOwnProfile && myUserId && (
          <div style={sectionStyle}>
            <div style={secTitle}>SEND A MESSAGE</div>
            {msgSent ? (
              <div style={{ fontSize:14, color:"#1db954" }}>Message sent ✓</div>
            ) : (
              <div style={{ display:"grid", gap:10 }}>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder={`Message ${displayName}…`} rows={3}
                  style={{ width:"100%", padding:"12px", borderRadius:14, background:"#0d0d0d", border:"1px solid rgba(255,255,255,0.10)", color:"#fff", fontSize:14, resize:"none" as const }} />
                <button onClick={sendMessage} disabled={!msgText.trim()||msgBusy}
                  style={{ padding:"13px 16px", borderRadius:14, background:"#fff", color:"#000", fontWeight:800, fontSize:15, border:"none", cursor:"pointer" }}>
                  {msgBusy ? "Sending…" : "Send"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", background:"#000", color:"#fff", padding:"0 0 120px" };
const shellStyle: React.CSSProperties = { maxWidth:680, margin:"0 auto", padding:"20px 18px", display:"grid", gap:16 };
const backStyle: React.CSSProperties = { background:"none", border:"none", color:"rgba(255,255,255,0.55)", fontSize:14, cursor:"pointer", padding:0, textAlign:"left" as const };
const headerStyle: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.08)", borderRadius:24, padding:20, display:"grid", gap:16, background:"rgba(255,255,255,0.02)" };
const avatarStyle: React.CSSProperties = { width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.04))", border:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:900 };
const proBadge: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.14em", border:"1px solid rgba(255,255,255,0.25)", borderRadius:999, padding:"3px 8px" };
const socialStyle: React.CSSProperties = { fontSize:12, color:"rgba(255,255,255,0.55)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:999, padding:"4px 10px", textDecoration:"none" };
const followBtnBase: React.CSSProperties = { width:"100%", padding:"13px 16px", borderRadius:14, fontWeight:800, fontSize:15, cursor:"pointer" };
const sectionStyle: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:16, display:"grid", gap:12 };
const secTitle: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.20em", opacity:0.45 };
