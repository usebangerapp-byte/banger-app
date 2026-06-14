"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";

type FollowRow = { id: number | string; track_title: string | null; track_subtitle: string | null };
type ScanRow   = { id: number | string; track_title: string | null; track_subtitle: string | null };
type UploadRow = { id: number | string; title: string | null; artist: string | null };

function ShowMore<T>({ items, renderItem }: { items: T[]; renderItem: (item: T) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      {open && <div style={{ display: "grid" }}>{items.map(renderItem)}</div>}
      <button style={showMoreStyle} onClick={() => setOpen((v) => !v)}>
        {open ? "Show less" : `Show more (${items.length})`}
      </button>
    </>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [email, setEmail]               = useState("");
  const [userId, setUserId]             = useState("");
  const [avatarUrl, setAvatarUrl]       = useState("");
  const [avatarVersion, setAvatarVersion] = useState(Date.now());
  const [follows, setFollows]           = useState<FollowRow[]>([]);
  const [scans, setScans]               = useState<ScanRow[]>([]);
  const [uploads, setUploads]           = useState<UploadRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [role, setRole]                 = useState<"public" | "pro">("public");

  useEffect(() => {
    if (!userId || !supabase) return;
    const { data } = supabase.storage.from("bpro_uploads").getPublicUrl(`artwork/profile_${userId}.png`);
    setAvatarUrl(data.publicUrl + "?v=" + avatarVersion);
  }, [userId, avatarVersion, supabase]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentEmail  = userData.user?.email?.toLowerCase() || "";
        const currentUserId = userData.user?.id || "";
        if (!mounted) return;
        setEmail(currentEmail);
        setUserId(currentUserId);

        const resolvedRole = await getBrowserRole();
        if (!mounted) return;
        setRole(resolvedRole === "public" ? "public" : "pro");

        const [followRes, scanRes, uploadRes] = await Promise.all([
          supabase.from("track_followers").select("id,track_title,track_subtitle").eq("user_id", currentUserId).order("id", { ascending: false }).limit(50),
          supabase.from("scan_events").select("id,track_title,track_subtitle").eq("user_id", currentUserId).order("id", { ascending: false }).limit(50),
          supabase.from("bpro_tracks").select("id,title,artist,uploader_email").eq("uploader_email", currentEmail).order("id", { ascending: false }).limit(50),
        ]);
        if (!mounted) return;

        const rawFollows = (followRes.data || []) as FollowRow[];
        setFollows(Array.from(new Map(rawFollows.map((r) => [`${r.track_title||""}|${r.track_subtitle||""}`, r])).values()));

        const rawScans = ((scanRes.data || []) as ScanRow[]).filter((r) => { const t = (r.track_title||"").trim().toLowerCase(); return t && t !== "unknown"; });
        setScans(Array.from(new Map(rawScans.map((r) => [`${r.track_title||""}|${r.track_subtitle||""}`, r])).values()));

        setUploads((uploadRes.data || []) as UploadRow[]);
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [supabase]);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId || !supabase) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token || "";
    await fetch("/api/upload-avatar", { method: "POST", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, body: formData });
    setAvatarVersion(Date.now());
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    try { localStorage.removeItem("banger_plan"); localStorage.removeItem("banger_role"); } catch {}
    router.replace("/");
    router.refresh();
  }

  function TrackRow({ title, artist }: { title?: string | null; artist?: string | null }) {
    return (
      <div style={trackRowStyle}>
        <div style={trackTitleStyle}>{title || "Untitled"}</div>
        <div style={trackArtistStyle}>{artist || "Unknown"}</div>
      </div>
    );
  }

  const followsTop = follows.slice(0, 3); const followsMore = follows.slice(3);
  const scansTop   = scans.slice(0, 3);   const scansMore   = scans.slice(3);
  const uploadsTop = uploads.slice(0, 3); const uploadsMore = uploads.slice(3);

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>

        <section style={heroStyle}>
          <div style={heroTopStyle}>
            <div>
              <div style={titleStyle}>MY PROFILE</div>
              <div style={emailStyle}>{email || "Connected"}</div>
            </div>
            <div style={avatarWrapStyle}>
              {avatarUrl && (
                <img src={avatarUrl} alt="Profile" style={avatarImgStyle}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              )}
              <div style={avatarFallbackStyle}>{(email[0] || "B").toUpperCase()}</div>
            </div>
          </div>
          <div style={actionsStyle}>
            <label style={actionBtnStyle}>
              Change photo
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={uploadAvatar} />
            </label>
            <button style={actionBtnStyle} onClick={signOut}>Sign out</button>
          </div>
          <div style={planBadgeStyle}>{role === "pro" ? "✦ PRO" : "PUBLIC"}</div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>ANALYTICS</div>
          <div style={analyticsGridStyle}>
            <div style={analyticsCardStyle}><div style={analyticsNumberStyle}>{scans.length}</div><div style={analyticsLabelStyle}>SCANS</div></div>
            <div style={analyticsCardStyle}><div style={analyticsNumberStyle}>{follows.length}</div><div style={analyticsLabelStyle}>FOLLOWING</div></div>
            {role === "pro" && <div style={analyticsCardStyle}><div style={analyticsNumberStyle}>{uploads.length}</div><div style={analyticsLabelStyle}>UPLOADS</div></div>}
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>FOLLOWED IDS</div>
          <div style={listStyle}>
            {loading ? <div style={emptyStyle}>Loading…</div>
              : follows.length === 0 ? <div style={emptyStyle}>No IDs followed yet. Scan something.</div>
              : <>{followsTop.map((item) => <TrackRow key={item.id} title={item.track_title} artist={item.track_subtitle} />)}
                  <ShowMore items={followsMore} renderItem={(item) => <TrackRow key={(item as FollowRow).id} title={(item as FollowRow).track_title} artist={(item as FollowRow).track_subtitle} />} /></>}
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>MY SCANS</div>
          <div style={listStyle}>
            {loading ? <div style={emptyStyle}>Loading…</div>
              : scans.length === 0 ? <div style={emptyStyle}>No scans yet. Drop it.</div>
              : <>{scansTop.map((item) => <TrackRow key={item.id} title={item.track_title} artist={item.track_subtitle} />)}
                  <ShowMore items={scansMore} renderItem={(item) => <TrackRow key={(item as ScanRow).id} title={(item as ScanRow).track_title} artist={(item as ScanRow).track_subtitle} />} /></>}
          </div>
        </section>

        {role === "pro" && (
          <section style={sectionStyle}>
            <div style={sectionTitleStyle}>MY UPLOADS</div>
            <div style={listStyle}>
              {loading ? <div style={emptyStyle}>Loading…</div>
                : uploads.length === 0 ? <div style={emptyStyle}>No uploads yet.</div>
                : <>{uploadsTop.map((item) => <TrackRow key={item.id} title={item.title} artist={item.artist} />)}
                    <ShowMore items={uploadsMore} renderItem={(item) => <TrackRow key={(item as UploadRow).id} title={(item as UploadRow).title} artist={(item as UploadRow).artist} />} /></>}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#000", color: "#fff", padding: "28px 18px 120px" };
const containerStyle: React.CSSProperties = { maxWidth: 760, margin: "0 auto", display: "grid", gap: 26 };
const heroStyle: React.CSSProperties = { display: "grid", gap: 16, paddingBottom: 8 };
const heroTopStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 };
const titleStyle: React.CSSProperties = { fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em" };
const emailStyle: React.CSSProperties = { marginTop: 8, fontSize: 14, opacity: 0.62, wordBreak: "break-word" };
const avatarWrapStyle: React.CSSProperties = { position: "relative", width: 78, height: 78 };
const avatarImgStyle: React.CSSProperties = { width: 78, height: 78, borderRadius: "999px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.14)", background: "#111", position: "absolute", inset: 0, zIndex: 2 };
const avatarFallbackStyle: React.CSSProperties = { width: 78, height: 78, borderRadius: "999px", border: "1px solid rgba(255,255,255,0.14)", background: "#0d0d0d", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 800, color: "#fff" };
const actionsStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const actionBtnStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 999, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const planBadgeStyle: React.CSSProperties = { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", opacity: 0.62, paddingTop: 4 };
const sectionStyle: React.CSSProperties = { display: "grid", gap: 12 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", opacity: 0.68 };
const listStyle: React.CSSProperties = { display: "grid", gap: 0, borderTop: "1px solid rgba(255,255,255,0.08)" };
const trackRowStyle: React.CSSProperties = { display: "grid", gap: 4, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" };
const trackTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const trackArtistStyle: React.CSSProperties = { fontSize: 13, opacity: 0.56, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const analyticsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const analyticsCardStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: "16px 14px", background: "rgba(255,255,255,0.02)" };
const analyticsNumberStyle: React.CSSProperties = { fontSize: 24, fontWeight: 900, lineHeight: 1 };
const analyticsLabelStyle: React.CSSProperties = { marginTop: 8, fontSize: 11, opacity: 0.58, letterSpacing: "0.14em", fontWeight: 800 };
const emptyStyle: React.CSSProperties = { padding: "14px 0", opacity: 0.56, borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 14 };
const showMoreStyle: React.CSSProperties = { background: "transparent", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "12px 0", letterSpacing: "0.06em" };
