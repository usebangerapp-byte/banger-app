"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getBrowserRole } from "@/lib/auth/getBrowserRole";

type FollowRow = {
  id: number | string;
  track_title: string | null;
  track_subtitle: string | null;
};

type ScanRow = {
  id: number | string;
  track_title: string | null;
  track_subtitle: string | null;
};

type UploadRow = {
  id: number | string;
  title: string | null;
  artist: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(Date.now());

  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [role, setRole] = useState<"public" | "dj" | "label">("public");

  const avatarUrl = useMemo(() => {
  if (!userId) return "";
  const { data } = 
supabase!.storage.from("bpro_uploads").getPublicUrl(`artwork/profile_${userId}.png`);
  return data.publicUrl + "?v=" + avatarVersion;
}, [userId, avatarVersion]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: userData } = await supabase!.auth.getUser();
        const currentEmail = userData.user?.email?.toLowerCase() || "";
        const currentUserId = userData.user?.id || "";

        if (!mounted) return;

        setEmail(currentEmail);
        setUserId(currentUserId);

        const resolvedRole = await getBrowserRole();
        if (!mounted) return;
        setRole(resolvedRole);

        const { data: followData } = await supabase!
          .from("track_followers")
          .select("id,track_title,track_subtitle")
          .eq("user_id", currentUserId)
          .order("id", { ascending: false })
          .limit(20);

        const { data: scanData } = await supabase!
          .from("scan_events")
          .select("id,track_title,track_subtitle")
          .eq("user_id", currentUserId)
          .order("id", { ascending: false })
          .limit(20);

        const { data: uploadData } = await supabase!
          .from("bpro_tracks")
          .select("id,title,artist,uploader_email")
          .eq("uploader_email", currentEmail)
          .order("id", { ascending: false })
          .limit(20);

        if (!mounted) return;

        const rawFollows = (followData || []) as FollowRow[];

const uniqueFollows = Array.from(
  new Map(
    rawFollows.map((item) => [
      `${item.track_title || ""}|${item.track_subtitle || ""}`,
      item,
    ])
  ).values()
);

setFollows(uniqueFollows);
        const rawScans = ((scanData || []) as ScanRow[]).filter((row) => {
  const title = (row.track_title || "").trim().toLowerCase();
  return title && title !== "unknown";
});

const uniqueScans = Array.from(
  new Map(
    rawScans.map((item) => [
      `${item.track_title || ""}|${item.track_subtitle || ""}`,
      item,
    ])
  ).values()
);

setScans(uniqueScans);
        setUploads((uploadData || []) as UploadRow[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file || !userId) return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("userId", userId);

  const { data } = await supabase!.auth.getSession();
  const accessToken = data.session?.access_token || "";

  await fetch("/api/upload-avatar", {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });

  setAvatarVersion(Date.now());
}

async function logout() {
    await supabase!.auth.signOut();
    try{
      localStorage.removeItem("banger_plan");
      localStorage.removeItem("banger_role");
    }catch{}
    router.replace("/");
    router.refresh();
  }

  function TrackRow({
    title,
    artist,
  }: {
    title: string | null | undefined;
    artist: string | null | undefined;
  }) {
    return (
      <div style={trackRowStyle}>
        <div style={trackTextWrapStyle}>
          <div style={trackTitleStyle}>{title || "Untitled"}</div>
          <div style={trackArtistStyle}>{artist || "Unknown"}</div>
        </div>
      </div>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <section style={heroStyle}>
          <div style={heroTopStyle}>
            <div>
              <div style={titleStyle}>Profile</div>
              <div style={emailStyle}>{email || "Connected"}</div>
            </div>
          </div>

          <div style={avatarWrapStyle}>
            {userId ? (
              <img
                src={avatarUrl}
                alt="Profile"
                style={avatarStyle}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <div style={avatarFallbackStyle}>{(email[0] || "B").toUpperCase()}</div>
          </div>

          <div style={actionsStyle}>
            <label style={actionBtnStyle}>
              Add photo
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={uploadAvatar}
              />
            </label>

            <button style={actionBtnStyle} onClick={logout}>
              Log out
            </button>
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>FOLLOWED ID</div>
          <div style={listStyle}>
            {loading ? (
              <div style={emptyStyle}>Loading...</div>
            ) : follows.length === 0 ? (
              <div style={emptyStyle}>No followed IDs yet</div>
            ) : (
              follows.slice(0, 3).map((item) => (
                <TrackRow
                  key={item.id}
                  title={item.track_title}
                  artist={item.track_subtitle}
                />
              ))
            )}
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>MY SCANS</div>
          <div style={listStyle}>
            {loading ? (
              <div style={emptyStyle}>Loading...</div>
            ) : scans.length === 0 ? (
              <div style={emptyStyle}>No scans yet</div>
            ) : (
              scans.slice(0, 3).map((item) => (
                <TrackRow
                  key={item.id}
                  title={item.track_title}
                  artist={item.track_subtitle}
                />
              ))
            )}
          </div>
        </section>

        {role !== "public" && (
<section style={sectionStyle}>
  <div style={sectionTitleStyle}>MY UPLOADS</div>
  <div style={listStyle}>
    {loading ? (
      <div style={emptyStyle}>Loading...</div>
    ) : uploads.length === 0 ? (
      <div style={emptyStyle}>No uploads yet</div>
    ) : (
      uploads.slice(0, 3).map((item) => (
        <TrackRow key={item.id} title={item.title} artist={item.artist} />
      ))
    )}
  </div>
</section>
)}

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>ANALYTICS</div>
          <div style={analyticsGridStyle}>
            <div style={analyticsCardStyle}>
              <div style={analyticsNumberStyle}>{scans.length}</div>
              <div style={analyticsLabelStyle}>Scans</div>
            </div>
            <div style={analyticsCardStyle}>
              <div style={analyticsNumberStyle}>{follows.length}</div>
              <div style={analyticsLabelStyle}>Followed</div>
            </div>
            {role !== "public" && (
<div style={analyticsCardStyle}>
  <div style={analyticsNumberStyle}>{uploads.length}</div>
  <div style={analyticsLabelStyle}>Uploads</div>
</div>
)}
          </div>
        </section>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
  padding: "28px 18px 120px",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  display: "grid",
  gap: 26,
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 8,
};

const heroTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: "-0.03em",
};

const emailStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  opacity: 0.62,
  wordBreak: "break-word",
};

const avatarWrapStyle: React.CSSProperties = {
  position: "relative",
  width: 78,
  height: 78,
};

const avatarStyle: React.CSSProperties = {
  width: 78,
  height: 78,
  borderRadius: "999px",
  objectFit: "cover",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#111",
  position: "absolute",
  inset: 0,
  zIndex: 2,
};

const avatarFallbackStyle: React.CSSProperties = {
  width: 78,
  height: 78,
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0d0d0d",
  display: "grid",
  placeItems: "center",
  fontSize: 24,
  fontWeight: 800,
  color: "#fff",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const actionBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#fff",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.24em",
  opacity: 0.68,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  borderTop: "1px solid rgba(255,255,255,0.08)",
};

const trackRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "14px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const trackTextWrapStyle: React.CSSProperties = {
  minWidth: 0,
};

const trackTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const trackArtistStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.56,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const analyticsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const analyticsCardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  padding: "16px 14px",
  background: "rgba(255,255,255,0.02)",
};

const analyticsNumberStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
};

const analyticsLabelStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.58,
};

const emptyStyle: React.CSSProperties = {
  padding: "14px 0",
  opacity: 0.56,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};
