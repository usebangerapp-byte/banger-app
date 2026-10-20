"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const MONO = "var(--font-geist-mono), ui-monospace, monospace";


export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (!user) return;
      setEmail(user.email || "");
      setUserId(user.id);
      sb.from("profiles").select("role,notifs_enabled").eq("id", user.id).maybeSingle().then(({ data: p }) => {
        setIsPro(p?.role === "pro" || p?.role === "dj" || p?.role === "label");
        if (p?.notifs_enabled === false) setNotifsEnabled(false);
      });
    });
    // lock page scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  async function toggleNotifs() {
    const next = !notifsEnabled;
    setNotifsEnabled(next);
    const sb = createSupabaseBrowser();
    if (sb && userId) await sb.from("profiles").update({ notifs_enabled: next }).eq("id", userId);
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const sb = createSupabaseBrowser();
      const { data } = (await sb?.auth.getSession()) || { data: null as any };
      const res = await fetch("/api/stripe/portal", {
        method: "POST", headers: { Authorization: `Bearer ${data?.session?.access_token || ""}` },
      });
      const json = await res.json().catch(() => ({}));
      if (json.url) window.location.href = json.url;
      else if (res.status === 404) alert("No Stripe subscription is linked to this account yet.");
      else alert("Could not open billing portal. Try again.");
    } finally { setPortalLoading(false); }
  }

  async function signOut() {
    const sb = createSupabaseBrowser();
    if (sb) await sb.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={overlay}>
      <div style={shell}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={eyebrow}>SETTINGS</div>
          <button onClick={onClose} aria-label="Close" style={closeBtn}>✕</button>
        </div>

        {/* Notifications — first */}
        <section style={section}>
          <div style={row}>
            <div>
              <div style={rowTitle}>Notifications</div>
              <div style={rowSub}>Messages, followers, releases</div>
            </div>
            <button onClick={toggleNotifs} aria-label="Toggle notifications" style={{
              width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", flexShrink: 0,
              background: notifsEnabled ? "#fff" : "rgba(255,255,255,0.15)", position: "relative", transition: "background 0.2s",
            }}>
              <span style={{
                position: "absolute", top: 3, left: notifsEnabled ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
                transition: "left 0.2s", background: notifsEnabled ? "#000" : "rgba(255,255,255,0.55)",
              }} />
            </button>
          </div>
        </section>

        {/* Account */}
        <section style={section}>
          <div style={label}>ACCOUNT</div>
          <div style={row}>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email || "—"}
            </span>
          </div>
          <div style={row}>
            <span style={isPro ? badgePro : badgeFree}>{isPro ? "✦ PRO" : "FREE"}</span>
            {isPro ? (
              <button onClick={openPortal} disabled={portalLoading} style={textLink}>
                {portalLoading ? "Opening…" : "Manage subscription →"}
              </button>
            ) : (
              <button onClick={() => { onClose(); window.location.href = "/upgrade"; }} style={textLink}>
                Upgrade →
              </button>
            )}
          </div>
        </section>

        {/* Sign out */}
        <button onClick={signOut} style={signOutBtn}>Sign out</button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 300, background: "#000", color: "#fff",
  overflowY: "auto", WebkitOverflowScrolling: "touch",
};
const shell: React.CSSProperties = {
  maxWidth: 560, margin: "0 auto",
  padding: "calc(20px + env(safe-area-inset-top)) 22px calc(60px + env(safe-area-inset-bottom))",
  display: "grid", gap: 40,
};
const section: React.CSSProperties = { display: "grid", gap: 14 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minWidth: 0 };
const rowTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700 };
const rowSub: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 };
const textLink: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700,
};
const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.3em", color: "rgba(255,255,255,0.6)" };
const label: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", color: "rgba(255,255,255,0.3)",
  paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)",
};
const closeBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer",
};
const badgeBase: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", borderRadius: 999, padding: "4px 11px", flexShrink: 0 };
const badgePro: React.CSSProperties = { ...badgeBase, color: "#fff", border: "1px solid rgba(255,255,255,0.35)" };
const badgeFree: React.CSSProperties = { ...badgeBase, color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.14)" };
const btnSolid: React.CSSProperties = {
  padding: "17px 16px", borderRadius: 14, background: "#fff", color: "#000", border: "none",
  fontWeight: 900, fontSize: 15, cursor: "pointer", letterSpacing: "0.01em",
};
const btnGhost: React.CSSProperties = {
  padding: "16px", borderRadius: 14, background: "transparent", color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)", fontWeight: 800, fontSize: 14, cursor: "pointer",
};
const hint: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center", lineHeight: 1.5 };
const featureRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "15px 0",
  borderTop: "1px solid rgba(255,255,255,0.05)",
};
const proTag: React.CSSProperties = {
  fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em",
  border: "1px solid rgba(255,180,0,0.4)", color: "rgba(255,180,0,0.85)", borderRadius: 999, padding: "3px 8px", flexShrink: 0,
};
const signOutBtn: React.CSSProperties = {
  justifySelf: "start", background: "none", border: "none", padding: "4px 0",
  color: "rgba(255,80,80,0.75)", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
