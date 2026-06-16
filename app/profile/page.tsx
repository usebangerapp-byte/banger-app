"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";
import { SkeletonTrackRow, SkeletonStyles } from "@/components/Skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────
type Profile = {
  id: string; email: string; display_name: string | null;
  bio: string | null; genre: string | null;
  instagram: string | null; soundcloud: string | null;
  role: string; avatar_url: string | null;
  follower_count: number; following_count: number;
};
type TrackStat = {
  id: string; title: string | null; artist: string | null;
  release_status: string; total_scans: number; recent_scans: number;
  trend: number; unique_users: number; total_follows: number;
  top_countries: { country: string; count: number }[];
  top_regions:   { region: string; count: number }[];
};
type Message = { id: number; created_at: string; sender_id: string; receiver_id: string; content: string; read: boolean };
type Conversation = { user_id: string; display_name: string | null; last_message: string; unread: number };

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </section>
  );
}

// ─── Geo bar chart ───────────────────────────────────────────────────────────
function GeoBar({ data }: { data: { country: string; count: number }[] }) {
  if (!data.length) return <div style={emptyStyle}>No geo data yet</div>;
  const max = data[0].count;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.slice(0, 5).map(({ country, count }) => (
        <div key={country} style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ opacity: 0.8 }}>{country}</span>
            <span style={{ opacity: 0.5 }}>{count}</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(count / max) * 100}%`, borderRadius: 999, background: "linear-gradient(90deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3))", transition: "width 0.8s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sparkline 7 jours ───────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const W = 120; const H = 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => v > 0 && (
        <circle key={i} cx={(i / (data.length - 1)) * W} cy={H - (v / max) * H} r="2" fill="#fff" />
      ))}
    </svg>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router  = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [userId,   setUserId]   = useState("");
  const [role,     setRole]     = useState<"public" | "pro">("public");
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);

  // Edit fields
  const [editName,       setEditName]       = useState("");
  const [editBio,        setEditBio]        = useState("");
  const [editGenre,      setEditGenre]      = useState("");
  const [editInstagram,  setEditInstagram]  = useState("");
  const [editSoundcloud, setEditSoundcloud] = useState("");
  const [savingProfile,  setSavingProfile]  = useState(false);

  // Data
  const [trackStats,   setTrackStats]   = useState<TrackStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [follows,      setFollows]      = useState<{ track_title: string; track_subtitle: string | null }[]>([]);
  const [scans,        setScans]        = useState<{ track_title: string | null; created_at: string | null }[]>([]);
  const [sparkData,    setSparkData]    = useState<number[]>([]);

  // Messages
  const [tab,          setTab]          = useState<"profile" | "messages">("profile");
  const [conversations, setConvs]       = useState<Conversation[]>([]);
  const [activeConv,   setActiveConv]   = useState<string | null>(null);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [msgInput,     setMsgInput]     = useState("");
  const [msgLoading,   setMsgLoading]   = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  // Load profile
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

        const resolvedRole = await getBrowserRole();
        if (mounted) setRole(resolvedRole);

        // Charger profil
        const res = await fetch(`/api/profile/get?user_id=${uid}`);
        const j   = await res.json().catch(() => null);
        if (j?.ok && mounted) {
          setProfile(j.profile);
          setEditName(j.profile.display_name || "");
          setEditBio(j.profile.bio || "");
          setEditGenre(j.profile.genre || "");
          setEditInstagram(j.profile.instagram || "");
          setEditSoundcloud(j.profile.soundcloud || "");
        }

        // Follows tracks
        const fRes = await fetch(`/api/follow-track?user_id=${uid}`, { cache: "no-store" });
        const fj   = await fRes.json().catch(() => null);
        if (mounted) setFollows(Array.isArray(fj?.followed) ? fj.followed : []);

        // Scans récents
        const { data: scanData } = await supabase
          .from("scan_events").select("track_title,created_at")
          .eq("user_id", uid).order("created_at", { ascending: false }).limit(50);
        if (mounted) setScans(scanData || []);

        // Sparkline 7 jours
        if (scanData) {
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split("T")[0];
          });
          const counts = days.map(day => scanData.filter(s => s.created_at?.startsWith(day)).length);
          if (mounted) setSparkData(counts);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  // Analytics PRO
  useEffect(() => {
    if (!profile?.email || role !== "pro") return;
    setStatsLoading(true);
    fetch(`/api/profile-data?email=${encodeURIComponent(profile.email)}`)
      .then(r => r.json())
      .then(j => { if (j?.ok) setTrackStats(j.tracks || []); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [profile?.email, role]);

  // Conversations
  useEffect(() => {
    if (!userId || tab !== "messages") return;
    fetch(`/api/messages/list?user_id=${userId}`)
      .then(r => r.json())
      .then(j => {
        if (!j?.messages) return;
        // Grouper par conversation
        const convMap = new Map<string, Conversation>();
        for (const msg of j.messages) {
          const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
          const existing = convMap.get(otherId);
          if (!existing || new Date(msg.created_at) > new Date(existing.last_message)) {
            convMap.set(otherId, {
              user_id: otherId,
              display_name: null,
              last_message: msg.content,
              unread: msg.receiver_id === userId && !msg.read ? (existing?.unread || 0) + 1 : (existing?.unread || 0),
            });
          }
        }
        setConvs(Array.from(convMap.values()));
      })
      .catch(() => {});
  }, [userId, tab]);

  // Messages d'une conversation
  useEffect(() => {
    if (!activeConv || !userId) return;
    setMsgLoading(true);
    fetch(`/api/messages/list?user_id=${userId}&other_id=${activeConv}`)
      .then(r => r.json())
      .then(j => { if (j?.messages) setMessages(j.messages); })
      .catch(() => {})
      .finally(() => setMsgLoading(false));
  }, [activeConv, userId]);

  // Scroll messages
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function saveProfile() {
    if (!userId) return;
    setSavingProfile(true);
    try {
      await fetch("/api/profile/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, display_name: editName, bio: editBio, genre: editGenre, instagram: editInstagram, soundcloud: editSoundcloud }),
      });
      setProfile(prev => prev ? { ...prev, display_name: editName, bio: editBio, genre: editGenre, instagram: editInstagram, soundcloud: editSoundcloud } : prev);
      setEditing(false);
    } finally { setSavingProfile(false); }
  }

  async function switchRole(newRole: "public" | "pro") {
    if (!supabase || !userId) return;
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    setRole(newRole);
    setProfile(prev => prev ? { ...prev, role: newRole } : prev);
  }

  async function sendMessage() {
    if (!msgInput.trim() || !activeConv || !userId) return;
    const content = msgInput.trim();
    setMsgInput("");
    await fetch("/api/messages/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_id: userId, receiver_id: activeConv, content }),
    });
    setMessages(prev => [...prev, { id: Date.now(), created_at: new Date().toISOString(), sender_id: userId, receiver_id: activeConv, content, read: false }]);
  }

  const displayName = profile?.display_name || profile?.email?.split("@")[0] || "You";
  const shareUrl    = `https://usebanger.com/dj/${encodeURIComponent((profile?.display_name || "").toLowerCase().replace(/\s+/g, "-"))}`;

  if (loading) return (
    <main style={pageStyle}>
      <SkeletonStyles />
      <div style={shellStyle}>
        {Array.from({ length: 5 }).map((_, i) => <SkeletonTrackRow key={i} />)}
      </div>
    </main>
  );

  return (
    <main style={pageStyle}>
      <SkeletonStyles />
      <div style={shellStyle}>

        {/* ── Tabs ── */}
        <div style={tabBarStyle}>
          {(["profile", "messages"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...tabBtnStyle, ...(tab === t ? tabActivStyle : {}) }}>
              {t === "profile" ? "PROFILE" : `MESSAGES${conversations.reduce((a, c) => a + c.unread, 0) > 0 ? ` (${conversations.reduce((a, c) => a + c.unread, 0)})` : ""}`}
            </button>
          ))}
        </div>

        {/* ══ PROFILE TAB ══ */}
        {tab === "profile" && (<>

          {/* Header profil */}
          <div style={profileHeaderStyle}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Avatar */}
              <div style={avatarStyle}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{displayName}</div>
                  {role === "pro" && <span style={proBadgeStyle}>✦ PRO</span>}
                </div>
                {profile?.genre && <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>{profile.genre}</div>}
                {profile?.bio && <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6, lineHeight: 1.4 }}>{profile.bio}</div>}
                {/* Réseaux sociaux */}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" as const }}>
                  {profile?.instagram && (
                    <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={socialLinkStyle}>
                      IG @{profile.instagram.replace("@","")}
                    </a>
                  )}
                  {profile?.soundcloud && (
                    <a href={`https://soundcloud.com/${profile.soundcloud.replace("@","")}`} target="_blank" rel="noreferrer" style={socialLinkStyle}>
                      SC {profile.soundcloud}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Stats ligne */}
            <div style={statsRowStyle}>
              {[
                { label: "SCANS",     value: scans.length },
                { label: "FOLLOWERS", value: profile?.follower_count || 0 },
                { label: "FOLLOWING", value: profile?.following_count || 0 },
                { label: "FOLLOWS",   value: follows.length },
              ].map(({ label, value }) => (
                <div key={label} style={statItemStyle}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
                  <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.14em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Sparkline scans 7j */}
            {sparkData.some(v => v > 0) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, opacity: 0.4, letterSpacing: "0.14em", marginBottom: 6 }}>SCANS THIS WEEK</div>
                <Sparkline data={sparkData} />
              </div>
            )}

            {/* Lien partageable */}
            {profile?.display_name && (
              <button onClick={() => { navigator.clipboard?.writeText(shareUrl); }} style={shareBtnStyle}>
                🔗 {shareUrl.replace("https://","")}
              </button>
            )}

            {/* Boutons action */}
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <button onClick={() => setEditing(v => !v)} style={editBtnStyle}>
                {editing ? "Cancel" : "Edit Profile"}
              </button>
              {role === "public" ? (
                <button onClick={() => router.push("/onboarding")} style={upgradeBtnStyle}>
                  ✦ Upgrade to PRO — €9.99/mo
                </button>
              ) : (
                <button onClick={() => switchRole("public")} style={downgradeBtnStyle}>
                  Switch to Public (Free)
                </button>
              )}
              <button onClick={async () => {
                if (!supabase) return;
                await supabase.auth.signOut();
                router.push("/");
              }} style={signOutStyle}>Sign out</button>
            </div>
          </div>

          {/* ── Edit form ── */}
          {editing && (
            <Section title="EDIT PROFILE">
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { label: "Display name", value: editName, set: setEditName, placeholder: "DJ Banger" },
                  { label: "Genre", value: editGenre, set: setEditGenre, placeholder: "Techno · House · Melodic" },
                  { label: "Instagram", value: editInstagram, set: setEditInstagram, placeholder: "@yourdj" },
                  { label: "SoundCloud", value: editSoundcloud, set: setEditSoundcloud, placeholder: "soundcloud.com/yourdj" },
                ].map(({ label, value, set, placeholder }) => (
                  <label key={label} style={{ fontSize: 12, opacity: 0.6 }}>
                    {label}
                    <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                      style={inputStyle} />
                  </label>
                ))}
                <label style={{ fontSize: 12, opacity: 0.6 }}>
                  Bio
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell your story…"
                    rows={3} style={{ ...inputStyle, resize: "none" as const }} />
                </label>
                <button onClick={saveProfile} disabled={savingProfile} style={saveBtnStyle}>
                  {savingProfile ? "Saving…" : "Save Profile"}
                </button>
              </div>
            </Section>
          )}

          {/* ── TRACK ANALYTICS (PRO) ── */}
          {role === "pro" && (
            <Section title="TRACK ANALYTICS">
              {statsLoading ? (
                <div style={{ display: "grid" }}><SkeletonTrackRow /><SkeletonTrackRow /></div>
              ) : trackStats.length === 0 ? (
                <div style={emptyStyle}>Upload tracks to see analytics.</div>
              ) : trackStats.map(t => (
                <div key={t.id} style={trackCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title || "Untitled"}</div>
                      <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{t.artist}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                      color: t.release_status === "released" ? "#1db954" : "rgba(255,255,255,0.6)",
                      border: `1px solid ${t.release_status === "released" ? "rgba(29,185,84,0.4)" : "rgba(255,255,255,0.15)"}`,
                      borderRadius: 999, padding: "3px 8px" }}>
                      {t.release_status === "released" ? "RELEASED" : "UNRELEASED"}
                    </span>
                  </div>
                  {/* Mini stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 10 }}>
                    {[
                      { l: "SCANS",     v: t.total_scans },
                      { l: "WEEK",      v: t.recent_scans },
                      { l: "LISTENERS", v: t.unique_users },
                      { l: "FOLLOWS",   v: t.total_follows },
                    ].map(({ l, v }) => (
                      <div key={l} style={miniStatStyle}>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{v}</div>
                        <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.1em" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  {/* Tendance */}
                  {t.trend !== 0 && (
                    <div style={{ fontSize: 12, marginTop: 6, color: t.trend > 0 ? "#1db954" : "#ff6b6b" }}>
                      {t.trend > 0 ? `▲ +${t.trend}` : `▼ ${t.trend}`} vs last week
                    </div>
                  )}
                  {/* Carte géo */}
                  {t.top_countries.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, opacity: 0.4, letterSpacing: "0.14em", marginBottom: 6 }}>WHERE IT'S PLAYING</div>
                      <GeoBar data={t.top_countries} />
                    </div>
                  )}
                  {/* Top régions */}
                  {t.top_regions.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      {t.top_regions.map(({ region, count }) => (
                        <span key={region} style={regionTagStyle}>{region} · {count}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* ── FOLLOWED TRACKS ── */}
          <Section title={`FOLLOWED TRACKS (${follows.length})`}>
            {follows.length === 0 ? (
              <div style={emptyStyle}>No followed tracks yet. Follow tracks in Charts.</div>
            ) : follows.slice(0, 5).map((f, i) => (
              <div key={i} style={rowStyle}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.track_title || "Unknown"}</div>
                {f.track_subtitle && <div style={{ fontSize: 12, opacity: 0.5 }}>{f.track_subtitle}</div>}
              </div>
            ))}
            {follows.length > 5 && (
              <div style={emptyStyle}>+{follows.length - 5} more tracks followed</div>
            )}
          </Section>

          {/* ── RECENT SCANS ── */}
          <Section title={`MY SCANS (${scans.length})`}>
            {scans.length === 0 ? (
              <div style={emptyStyle}>No scans yet. Go scan!</div>
            ) : scans.slice(0, 5).map((s, i) => (
              <div key={i} style={rowStyle}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.track_title || "Unknown"}</div>
                {s.created_at && (
                  <div style={{ fontSize: 11, opacity: 0.4 }}>
                    {new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            ))}
          </Section>

        </>)}

        {/* ══ MESSAGES TAB ══ */}
        {tab === "messages" && (
          <div style={{ display: "grid", gap: 12 }}>
            {!activeConv ? (
              <>
                <div style={sectionTitleStyle}>CONVERSATIONS</div>
                {conversations.length === 0 ? (
                  <div style={emptyStyle}>No messages yet. Visit a DJ's profile to send a message.</div>
                ) : conversations.map(conv => (
                  <button key={conv.user_id} onClick={() => setActiveConv(conv.user_id)} style={convRowStyle}>
                    <div style={avatarSmallStyle}>{(conv.display_name || "?").charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, textAlign: "left" as const }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{conv.display_name || conv.user_id.slice(0, 8)}</div>
                      <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{conv.last_message}</div>
                    </div>
                    {conv.unread > 0 && <div style={unreadBadgeStyle}>{conv.unread}</div>}
                  </button>
                ))}
              </>
            ) : (
              <>
                <button onClick={() => setActiveConv(null)} style={backBtnStyle}>← Back</button>
                <div style={{ display: "grid", gap: 8, maxHeight: "50vh", overflowY: "auto" as const }}>
                  {msgLoading ? (
                    <div style={emptyStyle}>Loading…</div>
                  ) : messages.map(msg => (
                    <div key={msg.id} style={{
                      display: "flex", justifyContent: msg.sender_id === userId ? "flex-end" : "flex-start",
                    }}>
                      <div style={{
                        maxWidth: "75%", padding: "10px 14px", borderRadius: msg.sender_id === userId ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: msg.sender_id === userId ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                        fontSize: 14, lineHeight: 1.4,
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={msgEndRef} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    placeholder="Message…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={sendMessage} disabled={!msgInput.trim()} style={sendBtnStyle}>↑</button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#000", color: "#fff", padding: "0 0 120px" };
const shellStyle: React.CSSProperties = { maxWidth: 680, margin: "0 auto", padding: "24px 18px", display: "grid", gap: 16 };
const sectionStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 16, display: "grid", gap: 12 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: "0.20em", opacity: 0.5 };
const profileHeaderStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 20, display: "grid", gap: 14, background: "rgba(255,255,255,0.02)" };
const avatarStyle: React.CSSProperties = { width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, flexShrink: 0 };
const avatarSmallStyle: React.CSSProperties = { width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, flexShrink: 0 };
const proBadgeStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "3px 8px" };
const statsRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, paddingTop: 4 };
const statItemStyle: React.CSSProperties = { display: "grid", gap: 2, textAlign: "center" as const };
const socialLinkStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "4px 10px", textDecoration: "none" };
const shareBtnStyle: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "8px 12px", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textAlign: "left" as const };
const editBtnStyle: React.CSSProperties = { padding: "11px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const upgradeBtnStyle: React.CSSProperties = { padding: "13px 16px", borderRadius: 14, background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" };
const downgradeBtnStyle: React.CSSProperties = { padding: "11px 16px", borderRadius: 14, background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const signOutStyle: React.CSSProperties = { padding: "11px 16px", borderRadius: 14, background: "transparent", border: "1px solid rgba(255,80,80,0.2)", color: "rgba(255,100,100,0.7)", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const inputStyle: React.CSSProperties = { display: "block", width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontSize: 14 };
const saveBtnStyle: React.CSSProperties = { padding: "13px 16px", borderRadius: 14, background: "#fff", color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer", border: "none" };
const trackCardStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 14, display: "grid", gap: 0, background: "rgba(255,255,255,0.02)" };
const miniStatStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 6px", textAlign: "center" as const, background: "rgba(255,255,255,0.02)" };
const regionTagStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" };
const rowStyle: React.CSSProperties = { padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 2 };
const emptyStyle: React.CSSProperties = { fontSize: 13, opacity: 0.45, padding: "4px 0" };
const tabBarStyle: React.CSSProperties = { display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" };
const tabBtnStyle: React.CSSProperties = { flex: 1, padding: "14px 0", background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", cursor: "pointer" };
const tabActivStyle: React.CSSProperties = { color: "#fff", borderBottom: "2px solid #fff" };
const convRowStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", padding: "12px 0", background: "none", border: "none", color: "#fff", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", width: "100%" };
const unreadBadgeStyle: React.CSSProperties = { width: 20, height: 20, borderRadius: "50%", background: "#fff", color: "#000", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" };
const sendBtnStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: "50%", background: "#fff", color: "#000", border: "none", fontSize: 18, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const backBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer", padding: 0, textAlign: "left" as const };
