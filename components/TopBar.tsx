"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const HIDDEN_PATHS = ["/", "/login", "/unlock", "/onboarding", "/auth/callback", "/privacy", "/terms", "/contact"];

export default function TopBar() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.includes(pathname)) return null;
  const [showSettings,   setShowSettings]   = useState(false);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [notifCount,     setNotifCount]     = useState(0);
  const [notifs,         setNotifs]         = useState<any[]>([]);
  const [plan,           setPlan]           = useState<string>("Free");
  const [email,          setEmail]          = useState<string>("");
  const [userId,         setUserId]         = useState<string>("");
  const [notifsEnabled,  setNotifsEnabled]  = useState(true);
  const [genre,          setGenre]          = useState("");
  const [showDeleteConf, setShowDeleteConf] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (!user) return;
      setEmail(user.email || "");
      setUserId(user.id);
      sb.from("profiles").select("role,genre,notifs_enabled").eq("id", user.id).maybeSingle()
        .then(({ data: p }) => {
          if (p?.role === "pro") setPlan("PRO");
          if (p?.genre) setGenre(p.genre);
          if (p?.notifs_enabled === false) setNotifsEnabled(false);
        });
      // fetch unread notifications with content
      sb.from("notifications").select("id,message,type,track_title,created_at,read")
        .eq("user_id", user.id).eq("read", false)
        .order("created_at", { ascending: false }).limit(20)
        .then(({ data: n }) => {
          if (n) { setNotifs(n); setNotifCount(n.length); }
        });
    });
  }, []);

  return (
    <>
      {/* TopBar strip */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 52,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 18px",
      }}>
        {/* Settings — left */}
        <button onClick={() => { setShowSettings(v => !v); setShowNotifs(false); }} style={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Logo center */}
        <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.18em", opacity: 0.9 }}>BANGER</span>

        {/* Notifications — right */}
        <button onClick={() => { setShowNotifs(v => !v); setShowSettings(false); }} style={{ ...iconBtn, position: "relative" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {notifCount > 0 && (
            <span style={{ position:"absolute", top:0, right:0, width:16, height:16, borderRadius:"50%",
              background:"#fff", color:"#000", fontSize:9, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </button>
      </div>

      {/* Spacer so content doesn't hide under TopBar */}
      <div style={{ height: 52 }} />

      {/* Settings panel */}
      {showSettings && (
        <div style={panelStyle}>
          <div style={panelTitle}>SETTINGS</div>
          <button onClick={() => setShowSettings(false)} style={closeBtn}>✕</button>

          {/* 1 — Account */}
          <div style={settingsSection}>
            <div style={settingsSectionTitle}>ACCOUNT</div>
            <div style={panelRow}>
              <span style={panelLabel}>Email</span>
              <span style={{ ...panelValue, fontSize:12, opacity:0.6 }}>{email || "—"}</span>
            </div>
            <div style={panelRow}>
              <span style={panelLabel}>Plan</span>
              <span style={{ ...panelValue, color: plan === "PRO" ? "#fff" : "rgba(255,255,255,0.45)" }}>
                {plan === "PRO" ? "✦ PRO" : "Free"}
              </span>
            </div>
            {plan === "Free" && (
              <a href="/upgrade" onClick={() => setShowSettings(false)} style={{ ...settingsBtn, background:"rgba(255,255,255,0.08)", borderColor:"rgba(255,255,255,0.20)", fontWeight:800 }}>
                ✦ Upgrade to PRO
              </a>
            )}
          </div>

          {/* 2 — Notifications */}
          <div style={settingsSection}>
            <div style={settingsSectionTitle}>NOTIFICATIONS</div>
            <div style={{ ...panelRow, borderBottom:"none" }}>
              <span style={panelLabel}>Track drops</span>
              <button onClick={async () => {
                const next = !notifsEnabled;
                setNotifsEnabled(next);
                const sb = createSupabaseBrowser();
                if (sb && userId) await sb.from("profiles").update({ notifs_enabled: next }).eq("id", userId);
              }} style={{
                width:44, height:26, borderRadius:13, border:"none", cursor:"pointer",
                background: notifsEnabled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.15)",
                position:"relative" as const, transition:"background 0.2s", flexShrink:0,
              }}>
                <span style={{
                  position:"absolute" as const, top:3, left: notifsEnabled ? 21 : 3,
                  width:20, height:20, borderRadius:"50%",
                  background: notifsEnabled ? "#000" : "rgba(255,255,255,0.6)",
                  transition:"left 0.2s",
                }}/>
              </button>
            </div>
            <div style={{ fontSize:11, opacity:0.38, paddingTop:2 }}>
              {notifsEnabled ? "You'll be notified when followed tracks drop" : "Notifications off"}
            </div>
          </div>

          {/* 3 — Profile */}
          <div style={settingsSection}>
            <div style={settingsSectionTitle}>MY PROFILE</div>
            <div style={panelRow}>
              <span style={panelLabel}>Genre</span>
              <input value={genre} onChange={e => setGenre(e.target.value)}
                onBlur={async () => {
                  const sb = createSupabaseBrowser();
                  if (sb && userId) await sb.from("profiles").update({ genre }).eq("id", userId);
                }}
                placeholder="House, Techno…"
                style={{ background:"transparent", border:"none", color:"#fff", fontSize:13, fontWeight:700, textAlign:"right" as const, outline:"none", width:140 }} />
            </div>
            <a href="/profile" onClick={() => setShowSettings(false)} style={settingsBtn}>
              Edit full profile →
            </a>
          </div>

          {/* 4 — Danger zone */}
          <div style={settingsSection}>
            <div style={settingsSectionTitle}>ACCOUNT ACTIONS</div>
            <button onClick={async () => {
              const sb = createSupabaseBrowser();
              if (sb) await sb.auth.signOut();
              window.location.href = "/";
            }} style={{ ...settingsBtn, color:"rgba(255,100,100,0.8)", border:"1px solid rgba(255,80,80,0.18)", background:"transparent" }}>
              Sign out
            </button>
            {!showDeleteConf ? (
              <button onClick={() => setShowDeleteConf(true)}
                style={{ ...settingsBtn, color:"rgba(255,60,60,0.5)", border:"1px solid rgba(255,60,60,0.10)", background:"transparent", fontSize:12 }}>
                Delete my account
              </button>
            ) : (
              <div style={{ display:"grid", gap:8 }}>
                <div style={{ fontSize:12, color:"rgba(255,100,100,0.8)", textAlign:"center" as const }}>
                  This is permanent. All your data will be deleted.
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => setShowDeleteConf(false)} style={{ ...settingsBtn, flex:1, textAlign:"center" as const }}>Cancel</button>
                  <button onClick={async () => {
                    const sb = createSupabaseBrowser();
                    if (sb && userId) {
                      await fetch("/api/profile/delete", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ user_id: userId }) });
                      await sb.auth.signOut();
                      window.location.href = "/";
                    }
                  }} style={{ ...settingsBtn, flex:1, textAlign:"center" as const, color:"#fff", background:"rgba(255,50,50,0.3)", border:"1px solid rgba(255,80,80,0.35)" }}>
                    Confirm delete
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Notifications panel */}
      {showNotifs && (
        <div style={panelStyle}>
          <div style={panelTitle}>NOTIFICATIONS</div>
          {notifs.length === 0 ? (
            <div style={{ fontSize:13, opacity:0.45, padding:"8px 0" }}>No new notifications.</div>
          ) : (
            <div style={{ display:"grid", gap:8 }}>
              {notifs.map(n => (
                <div key={n.id} style={{ fontSize:13, padding:"10px 12px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                  {n.track_title && <div style={{ fontWeight:700, marginBottom:3 }}>{n.track_title}</div>}
                  <div style={{ opacity:0.7 }}>{n.message || (n.type === "track_released" ? "A track you follow just dropped! 🎉" : n.type || "New notification")}</div>
                </div>
              ))}
              <button onClick={async () => {
                const sb = createSupabaseBrowser();
                if (sb && userId) { await sb.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false); }
                setNotifs([]); setNotifCount(0); setShowNotifs(false);
              }} style={{ ...settingsBtn, fontSize:12, opacity:0.55, textAlign:"center" as const }}>
                Mark all as read
              </button>
            </div>
          )}
          <button onClick={() => setShowNotifs(false)} style={closeBtn}>✕</button>
        </div>
      )}

      {/* Backdrop */}
      {(showSettings || showNotifs) && (
        <div onClick={() => { setShowSettings(false); setShowNotifs(false); }} style={backdrop} />
      )}
    </>
  );
}

const iconBtn: React.CSSProperties = {
  background: "none", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer",
  padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
};
const panelStyle: React.CSSProperties = {
  position: "fixed", top: 58, left: 12, right: 12, zIndex: 200,
  background: "#111", border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20, padding: "20px 18px 16px", display: "grid", gap: 10,
  maxHeight: "80vh", overflowY: "auto" as const,
};
const settingsSection: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, display: "grid", gap: 8,
};
const settingsSectionTitle: React.CSSProperties = {
  fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: "rgba(255,255,255,0.30)", marginBottom: 2,
};
const panelTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: "0.20em", opacity: 0.45, marginBottom: 4,
};
const panelRow: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
};
const panelLabel: React.CSSProperties = { fontSize: 13, opacity: 0.55 };
const panelValue: React.CSSProperties = { fontSize: 13, fontWeight: 700 };
const settingsBtn: React.CSSProperties = {
  display: "block", padding: "11px 14px", borderRadius: 12,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none",
  textAlign: "left" as const,
};
const closeBtn: React.CSSProperties = {
  position: "absolute" as const, top: 14, right: 14,
  background: "none", border: "none", color: "rgba(255,255,255,0.4)",
  fontSize: 16, cursor: "pointer", padding: 4,
};
const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.4)",
};
