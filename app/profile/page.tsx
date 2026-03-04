"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BottomNav from "@/components/BottomNav";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function ProfilePage() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email || "");
    })();
  }, [supabase]);

  return (
    <AuthGate>
      <main style={S.page}>
        <div style={S.phone}>
          <div style={S.center}>
            <h1 style={S.h}>Profile</h1>
            <p style={S.p}>{email || "—"}</p>
            <p style={S.p2}>Logout plus tard (pour la présentation).</p>
          </div>
          <BottomNav />
        </div>
      </main>
    </AuthGate>
  );
}

const S: any = {
  page: { minHeight: "100vh", background: "#0b0b0c", color: "#fff", display: "flex", justifyContent: "center" },
  phone: { width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column" },
  center: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 24, textAlign: "center" },
  h: { letterSpacing: "0.10em" },
  p: { opacity: 0.85, marginTop: 10 },
  p2: { opacity: 0.55, marginTop: 8, fontSize: 12 },
};
