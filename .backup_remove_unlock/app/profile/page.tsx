"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import AppGate from "@/components/AppGate";

type FollowRow = {
  id: number;
  track_title: string | null;
  track_subtitle: string | null;
};

type ScanRow = {
  id: number;
  track_title: string | null;
  track_subtitle: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: sessionData } = await supabase!.auth.getSession();
        if (!mounted) return;
        setEmail(sessionData.session?.user?.email || "");

        const [{ data: followRows }, { data: scanRows }] = await Promise.all([
          supabase!
            .from("track_followers")
            .select("id,track_title,track_subtitle")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase!
            .from("scan_events")
            .select("id,track_title,track_subtitle")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        if (!mounted) return;
        setFollows((followRows || []).filter((x: any) => x.track_title) as FollowRow[]);
        setScans((scanRows || []).filter((x: any) => x.track_title) as ScanRow[]);
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

  const headerSubtitle = useMemo(() => (email ? email : "Connected"), [email]);

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "24px 16px 120px" }}>
      <AppGate />
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <Image src="/B-logo.png" alt="Banger" width={80} height={80} style={{ width: 80, height: 80 }} priority />
          <div style={{ fontSize: 30, fontWeight: 900 }}>Profile</div>
          <div style={{ opacity: 0.72 }}>{headerSubtitle}</div>
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
              scans.map((item) => (
                <div key={item.id} style={innerStyle}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{item.track_title || "Untitled"}</div>
                  <div style={{ opacity: 0.72, marginTop: 6 }}>{item.track_subtitle || "unknown"}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={boxStyle}>
          <div style={sectionTitle}>MY UPLOADS</div>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <div style={innerStyle}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>No uploads yet</div>
              <div style={{ opacity: 0.72, marginTop: 6 }}>Upload from BPRO and your tracks will appear here</div>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "18px 16px",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#fff",
            color: "#000",
            fontWeight: 900,
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>
    </main>
  );
}

const boxStyle: React.CSSProperties = {
  border: "1px solid rgba(0,229,255,0.14)",
  borderRadius: 24,
  padding: 18,
  background: "radial-gradient(circle at top right, rgba(0,229,255,0.07), transparent 38%), rgba(255,255,255,0.02)",
};

const sectionTitle: React.CSSProperties = {
  letterSpacing: "0.16em",
  opacity: 0.72,
  fontSize: 15,
};

const innerStyle: React.CSSProperties = {
  borderRadius: 18,
  background: "rgba(255,255,255,0.04)",
  padding: 18,
};
