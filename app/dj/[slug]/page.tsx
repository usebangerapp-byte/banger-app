"use client";

import { authFetch } from "@/lib/authFetch";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { SkeletonTrackRow, SkeletonStyles } from "@/components/Skeleton";
import { PeopleSheet } from "@/components/People";
import { ui, C, glass, tag, TAG_TEXT, FLAT } from "@/lib/ui";
import MarqueeText from "@/components/MarqueeText";
import SharedTrackRow from "@/components/TrackRow";
import Link from "next/link";
import { trackHref } from "@/lib/preview";

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
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [peopleList, setPeopleList] = useState<"followers" | "following" | null>(null);

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
      authFetch(`/api/profile/follow?user_id=${uid}`)
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
      const res = await authFetch("/api/profile/follow", {
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
      const res = await authFetch("/api/messages/send", {
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
        <button onClick={() => router.push("/home")} style={{ ...ui.pillSolid, marginTop: 24 }}>Go scan</button>
      </div>
    </main>
  );

  const displayName  = profile?.display_name || slug;
  const isOwnProfile = myUserId === profile?.id;

  return (
    <main style={pageStyle}>
      <SkeletonStyles />
      <div style={shellStyle}>
        <div style={ui.catalogue}>
          <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))} aria-label="Back" style={backStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          {profile?.role === "pro" ? <span style={tag("pro")}>PRO</span> : <span>Artist</span>}
        </div>

        <div style={headerStyle}>
          {/* Identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div style={avatarStyle}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                : displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0 }}>{displayName}</h1>
              </div>
              {profile?.genre && <div style={{ fontSize: 13, color: C.text3, marginTop: 4 }}>{profile.genre}</div>}
              {/* Compact stats */}
              <div style={statsLine}>
                <button onClick={() => profile && setPeopleList("followers")} style={statBtn}><b style={statNum}>{profile?.follower_count || 0}</b> followers</button>
                <button onClick={() => profile && setPeopleList("following")} style={statBtn}><b style={statNum}>{profile?.following_count || 0}</b> following</button>
                <span><b style={statNum}>{tracks.length}</b> tracks</span>
              </div>
            </div>
          </div>

          {profile?.bio && <div style={bioStyle}>{profile.bio}</div>}

          {(profile?.instagram || profile?.soundcloud) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {profile?.instagram && (
                <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={socialStyle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>
                  </svg>
                  {profile.instagram.replace("@","")}
                </a>
              )}
              {profile?.soundcloud && (
                <a href={`https://soundcloud.com/${profile.soundcloud.replace("@","")}`} target="_blank" rel="noreferrer" style={socialStyle}>
                  <svg width="15" height="11" viewBox="0 0 30 20" fill="currentColor" aria-hidden="true">
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

          {!isOwnProfile && myUserId && profile && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              <button onClick={toggleFollow} disabled={followBusy} style={following ? pillGhost : pillSolid}>
                {followBusy ? "…" : following ? "Following ✓" : "+ Follow"}
              </button>
              <button
                onClick={() => router.push(`/profile?tab=messages&with=${profile.id}&name=${encodeURIComponent(displayName)}`)}
                style={pillGhost}>
                ✉︎ Message
              </button>
            </div>
          )}
          {isOwnProfile && (
            <button onClick={() => router.push("/profile")} style={{ ...pillGhost, justifySelf: "start" }}>
              Edit your profile →
            </button>
          )}
          {!myUserId && (
            <button onClick={() => router.push("/")} style={{ ...pillSolid, justifySelf: "start" }}>
              Sign in to follow & message
            </button>
          )}
        </div>

        {tracks.length > 0 && (
          <div style={{ ...ui.section, paddingBottom: 4 }}>
            <div style={secTitle}>Tracks</div>
            {(showAllTracks ? tracks : tracks.slice(0, 3)).map(t => (
              <SharedTrackRow key={t.id} title={t.title || "Untitled"} artist={t.artist} released={!!t.is_released} meta={t.is_released ? TAG_TEXT.rel : TAG_TEXT.unrel} />
            ))}
            {tracks.length > 3 && (
              <button onClick={() => setShowAllTracks(v => !v)} style={moreBtn}>
                {showAllTracks ? "Show less" : `Show ${tracks.length - 3} more`}
              </button>
            )}
          </div>
        )}

        {peopleList && profile && (
          <PeopleSheet userId={profile.id} list={peopleList} onClose={() => setPeopleList(null)} />
        )}
      </div>
    </main>
  );
}

const pillBase: React.CSSProperties = {
  padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
  letterSpacing: "0.02em", cursor: "pointer",
};
const pillSolid: React.CSSProperties = { ...ui.pillSolid };
const pillGhost: React.CSSProperties = { ...ui.pill };

const pageStyle: React.CSSProperties = { ...ui.page };
const shellStyle: React.CSSProperties = { ...ui.shell };
const backStyle: React.CSSProperties = { width:38, height:38, borderRadius:"50%", padding:0, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.08)", border:`1px solid ${C.glassBorder}`, color:"#fff" };
const headerStyle: React.CSSProperties = { ...glass, borderRadius:24, padding:18, display:"grid", gap:16, minWidth:0, ...FLAT };
const avatarStyle: React.CSSProperties = { width:64, height:64, borderRadius:"50%", flexShrink:0, overflow:"hidden", background:"rgba(255,255,255,0.08)", border:`1px solid ${C.line}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800 };
const statsLine: React.CSSProperties = { display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", marginTop:8, fontSize:13, color:C.text3 };
const statBtn: React.CSSProperties = { background:"none", border:"none", padding:0, color:"inherit", font:"inherit", cursor:"pointer" };
const statNum: React.CSSProperties = { color:"#fff", fontWeight:700, fontSize:15, marginRight:3 };
const bioStyle: React.CSSProperties = { fontSize:14, color:C.text2, lineHeight:1.55 };
const trackRow: React.CSSProperties = { ...ui.row };
const tagStyle: React.CSSProperties = { fontSize:9, fontWeight:700, letterSpacing:"0.06em", borderRadius:5, padding:"3px 7px", flexShrink:0, whiteSpace:"nowrap" };
const tagRel: React.CSSProperties = { color:"rgba(29,185,84,0.95)", border:"1px solid rgba(29,185,84,0.5)" };
const tagUnrel: React.CSSProperties = { color:"rgba(255,180,0,0.95)", border:"1px solid rgba(255,180,0,0.5)" };
const moreBtn: React.CSSProperties = { ...ui.more };
const proBadge: React.CSSProperties = { fontSize:10, fontWeight:800, letterSpacing:"0.14em", border:"1px solid rgba(255,255,255,0.25)", borderRadius:999, padding:"3px 8px" };
const socialStyle: React.CSSProperties = { ...ui.pillSmall, maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis" };
const followBtnBase: React.CSSProperties = { width:"100%", padding:"13px 16px", borderRadius:14, fontWeight:800, fontSize:15, cursor:"pointer" };
const sectionStyle: React.CSSProperties = { padding:"4px 0", display:"grid", gap:12 };
const secTitle: React.CSSProperties = { ...ui.label };
