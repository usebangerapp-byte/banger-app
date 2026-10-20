"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const HIDDEN_PATHS = ["/", "/login", "/unlock", "/onboarding", "/auth/callback", "/privacy", "/terms", "/contact"];

export default function TopBar() {
  const pathname = usePathname();
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
          // role can be "pro" or anything else (public/free)
          const isPro = p?.role === "pro" || p?.role === "dj" || p?.role === "label";
          setPlan(isPro ? "PRO" : "Free");
          if (p?.genre) setGenre(p.genre);
          if (p?.notifs_enabled === false) setNotifsEnabled(false);
        });
    });
  }, []);

  // ── Notifications: loaded through the API, refreshed on every page change + every 30s ──
  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const sb = createSupabaseBrowser();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;
    return fetch(url, { ...init, headers: { ...(init?.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
  }, []);

  const loadNotifs = useCallback(async () => {
    try {
      const res = await authedFetch("/api/notifications", { cache: "no-store" });
      if (!res || !res.ok) return;
      const j = await res.json();
      const list = Array.isArray(j?.notifications) ? j.notifications : [];
      setNotifs(list);
      setNotifCount(list.length);
    } catch {}
  }, [authedFetch]);

  useEffect(() => { loadNotifs(); }, [pathname, loadNotifs]);
  useEffect(() => {
    const t = window.setInterval(loadNotifs, 30000);
    return () => window.clearInterval(t);
  }, [loadNotifs]);

  async function markRead(id?: string) {
    await authedFetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "read", id }) }).catch(() => {});
  }

  function openNotif(n: any) {
    markRead(n.id);
    setNotifs(p => p.filter(x => x.id !== n.id));
    setNotifCount(c => Math.max(0, c - 1));
    setShowNotifs(false);
    if (n.type === "message" && n.actor_id) window.location.href = `/profile?tab=messages&with=${n.actor_id}`;
    else if (n.type === "message") window.location.href = "/profile?tab=messages";
    else if (n.type === "follow" && n.actor_id) window.location.href = `/dj/${n.actor_id}`;
    else if (n.type === "track_released" || n.type === "new_track") window.location.href = "/radar";
  }

  if (HIDDEN_PATHS.includes(pathname)) return null;

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
        <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: "0.22em", color: "#fff",
          textShadow: "0 0 18px rgba(255,255,255,0.25)" }}>BANGER</span>

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

      {/* Settings panel — 3 lignes */}
      {showSettings && (
        <div style={panelStyle}>
          <button onClick={() => setShowSettings(false)} style={closeBtn}>✕</button>

          {/* Ligne 1: email + plan */}
          <div style={settingsRow}>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.55)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, maxWidth:"65%" }}>{email || "—"}</span>
            <span style={{ fontSize:12, fontWeight:800, color: plan==="PRO" ? "#fff" : "rgba(255,255,255,0.40)",
              border: plan==="PRO" ? "1px solid rgba(255,255,255,0.30)" : "1px solid rgba(255,255,255,0.12)",
              borderRadius:999, padding:"3px 10px", flexShrink:0 }}>
              {plan==="PRO" ? "✦ PRO" : "Free"}
            </span>
          </div>

          {/* Ligne 2: Notifications toggle */}
          <div style={settingsRow}>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.55)" }}>Notifications</span>
            <button onClick={async () => {
              const next = !notifsEnabled; setNotifsEnabled(next);
              const sb = createSupabaseBrowser();
              if (sb && userId) await sb.from("profiles").update({ notifs_enabled: next }).eq("id", userId);
            }} style={{ width:46, height:26, borderRadius:13, border:"none", cursor:"pointer", flexShrink:0,
              background: notifsEnabled ? "#fff" : "rgba(255,255,255,0.15)",
              position:"relative" as const, transition:"background 0.2s" }}>
              <span style={{ position:"absolute" as const, top:3, left: notifsEnabled ? 23 : 3,
                width:20, height:20, borderRadius:"50%", transition:"left 0.2s",
                background: notifsEnabled ? "#000" : "rgba(255,255,255,0.55)" }}/>
            </button>
          </div>

          {/* Ligne 3: Sign out */}
          <button onClick={async () => { const sb = createSupabaseBrowser(); if (sb) await sb.auth.signOut(); window.location.href = "/"; }}
            style={{ fontSize:14, fontWeight:700, color:"rgba(255,70,70,0.80)", background:"none", border:"none", cursor:"pointer", padding:"12px 0 2px", textAlign:"left" as const }}>
            Sign out
          </button>
        </div>
      )}

      {/* Notifications panel */}
      {showNotifs && (
        <div style={panelStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={panelTitle}>NOTIFICATIONS</div>
            <button onClick={() => setShowNotifs(false)} style={closeBtn}>✕</button>
          </div>
          {notifs.length === 0 ? (
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", padding:"8px 0", letterSpacing:"0.03em" }}>Nothing new.</div>
          ) : (<>
            <div style={{ display:"grid", gap:1 }}>
              {notifs.map(n => (
                <div key={n.id} onClick={() => openNotif(n)} style={{ padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer" }}>
                  {n.track_title && (
                    <div style={{ fontSize:14, fontWeight:800, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{n.track_title}</div>
                  )}
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:3, letterSpacing:"0.02em" }}>
                    {n.message || (n.type==="track_released" ? "Released — available now" : "New notification")}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={async () => {
              await markRead();
              setNotifs([]); setNotifCount(0); setShowNotifs(false);
            }} style={{ fontSize:11, color:"rgba(255,255,255,0.30)", background:"none", border:"none", cursor:"pointer", padding:"10px 0 2px", letterSpacing:"0.10em", fontWeight:700, textAlign:"left" as const }}>
              MARK ALL READ
            </button>
          </>)}
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
  borderRadius: 20, padding: "16px 16px 14px", display: "grid", gap: 4,
  maxHeight: "80vh", overflowY: "auto" as const, overflowX: "hidden" as const,
  boxSizing: "border-box" as const,
};
const settingsRow: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
  minWidth: 0, overflow: "hidden",
};
const actionRow: React.CSSProperties = {
  display: "block", width: "100%", padding: "11px 0", background: "none", border: "none",
  textAlign: "left" as const, fontSize: 13, fontWeight: 700, cursor: "pointer",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};
// keep old names for compat
const settingsSection: React.CSSProperties = { display: "grid", gap: 8 };
const settingsSectionTitle: React.CSSProperties = { fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: "rgba(255,255,255,0.30)" };
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
