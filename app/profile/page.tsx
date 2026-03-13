"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type FollowRow = {
  id: number | string;
  track_id?: string | null;
  track_title: string | null;
  track_subtitle: string | null;
};

type ScanRow = {
  id: number | string;
  track_title: string | null;
  track_subtitle: string | null;
  user_id?: string | null;
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
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllScans, setShowAllScans] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: userData } = await supabase!.auth.getUser();
        const userEmail = userData.user?.email?.toLowerCase() || "";
        const userId = userData.user?.id || "";
        if (!mounted) return;
        setEmail(userEmail);

        let followRows: any[] = [];
        let scanRows: any[] = [];
        let uploadRows: any[] = [];

        try {
          const { data } = await supabase!
            .from("track_followers")
            .select("id,track_id,track_title,track_subtitle,user_email")
            .eq("user_email", userEmail)
            .order("id", { ascending: false })
            .limit(20);
          followRows = data || [];
        } catch {}

        try {
          const { data } = await supabase!
            .from("scan_events")
            .select("id,track_title,track_subtitle,user_id")
            .eq("user_id", userId)
            .order("id", { ascending: false })
            .limit(20);
          scanRows = (data || []).filter((row: any) => {
            const title = (row?.track_title || "").trim().toLowerCase();
            return title && title !== "unknown";
          });
        } catch {}

        try {
          const { data } = await supabase!
            .from("unreleased_tracks")
            .select("id,title,artist,uploader_email")
            .eq("uploader_email", userEmail)
            .order("id", { ascending: false })
            .limit(20);
          uploadRows = data || [];
        } catch {}

        if (!mounted) return;
        setFollows(followRows as FollowRow[]);
        setScans(scanRows as ScanRow[]);
        setUploads(uploadRows as UploadRow[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleLogout() {
    try {
      await supabase!.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "24px 16px 120px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image src="/B-logo.png" alt="Banger" width={80} height={80} style={{ width: 80, height: 80 }} priority />
          <div style={{ fontSize: 30, fontWeight: 900 }}>Profile</div>
          <div style={{ opacity: 0.72 }}>{email || "Connected"}</div>
        </div>

        <section style={boxStyle}>
          <div style={sectionTitle}>FOLLOWED IDs</div>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {loading ? (
              <div style={innerStyle}>Loading...</div>
            ) : follows.length === 0 ? (
              <div style={innerStyle}>No followed IDs yet</div>
            ) : (
              follows.map((item) => (
                <div key={item.id} style={innerStyle}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{item.track_title || "Untitled"}</div>
                  <div style={{ opacity: 0.72, marginTop: 6 }}>{item.track_subtitle || "unknown"}</div>
                  <div style={{ color: "#3fe7ff", marginTop: 10, fontWeight: 700 }}>Following ID</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={boxStyle}>
          <div style={sectionTitle}>MY SCANS</div>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {loading ? (
              <div style={innerStyle}>Loading...</div>
            ) : scans.length === 0 ? (
              <div style={innerStyle}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>No scans yet</div>
                <div style={{ opacity: 0.72, marginTop: 6 }}>Scan music around you to build your personal history</div>
              </div>
            ) : (
              <>
                {(showAllScans ? scans : scans.slice(0, 3)).map((item) => (
                  <div key={item.id} style={innerStyle}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{item.track_title || "Untitled"}</div>
                    <div style={{ opacity: 0.72, marginTop: 6 }}>{item.track_subtitle || "unknown"}</div>
                  </div>
                ))}
                {!showAllScans && scans.length > 3 && (
                  <button
                    onClick={() => setShowAllScans(true)}
                    style={{
                      marginTop: 10,
                      padding: "10px 14px",
                      background: "#111",
                      border: "1px solid #333",
                      borderRadius: 10,
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    See all scans
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section style={boxStyle}>
          <div style={sectionTitle}>MY UPLOADS</div>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {loading ? (
              <div style={innerStyle}>Loading...</div>
            ) : uploads.length === 0 ? (
              <div style={innerStyle}>No uploads yet</div>
            ) : (
              uploads.map((item) => (
                <div key={item.id} style={innerStyle}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title || "Untitled"}</div>
                  <div style={{ opacity: 0.72, marginTop: 6 }}>{item.artist || "unknown"}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <button onClick={handleLogout} style={logoutBtnStyle}>
          Logout
        </button>
      </div>
    </main>
  );
}

const boxStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
};

const innerStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 18,
  padding: 16,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: "0.18em",
  opacity: 0.75,
};

const logoutBtnStyle: React.CSSProperties = {
  marginTop: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0f0f0f",
  color: "#fff",
  borderRadius: 16,
  padding: "14px 16px",
  fontWeight: 900,
  cursor: "pointer",
};
