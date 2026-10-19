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
          // role can be "pro" or anything else (public/free)
          const isPro = p?.role === "pro";
          setPlan(isPro ? "PRO" : "Free");
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

      {/* Settings panel — épuré */}
      {showSettings && (
        <div style={panelStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={panelTitle}>SETTINGS</div>
            <button onClick={() => setShowSettings(false)} style={closeBtn}>✕</button>
          </div>

          {/* Email + plan sur une ligne */}
          <div style={settingsRow}>
            <span style={panelLabel}>{email || "—"}</span>
            <span style={{ fontSize:12, fontWeight:800, color: plan==="PRO" ? "#fff" : "rgba(255,255,255,0.35)",
              border: plan==="PRO" ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius:999, padding:"2px 8px" }}>
              {plan==="PRO" ? "✦ PRO" : "Free"}
            </span>
          </div>

          {/* Notifications toggle */}
          <div style={settingsRow}>
            <span style={panelLabel}>Notifications</span>
            <button onClick={async () => {
              const next = !notifsEnabled; setNotifsEnabled(next);
              const sb = createSupabaseBrowser();
              if (sb && userId) await sb.from("profiles").update({ notifs_enabled: next }).eq("id", userId);
            }} style={{ width:44, height:26, borderRadius:13, border:"none", cursor:"pointer", flexShrink:0,
              background: notifsEnabled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.15)",
              position:"relative" as const, transition:"background 0.2s" }}>
              <span style={{ position:"absolute" as const, top:3, left: notifsEnabled ? 21 : 3,
                width:20, height:20, borderRadius:"50%", transition:"left 0.2s",
                background: notifsEnabled ? "#000" : "rgba(255,255,255,0.6)" }}/>
            </button>
          </div>

          {/* Genre */}
          <div style={settingsRow}>
            <span style={panelLabel}>Genre</span>
            <input value={genre} onChange={e => setGenre(e.target.value)}
              onBlur={async () => { const sb = createSupabaseBrowser(); if (sb && userId) await sb.from("profiles").update({ genre }).eq("id", userId); }}
              placeholder="House, Techno…"
              style={{ background:"transparent", border:"none", color:"#fff", fontSize:13, fontWeight:700,
                textAlign:"right" as const, outline:"none", maxWidth:150, minWidth:0 }} />
          </div>

          {/* Sign out */}
          <button onClick={async () => { const sb = createSupabaseBrowser(); if (sb) await sb.auth.signOut(); window.location.href = "/"; }}
            style={{ ...actionRow, color:"rgba(255,100,100,0.75)" }}>
            Sign out
          </button>

          {/* Delete */}
          {!showDeleteConf ? (
            <button onClick={() => setShowDeleteConf(true)} style={{ ...actionRow, color:"rgba(255,60,60,0.45)", fontSize:12 }}>
              Delete account
            </button>
          ) : (
            <div style={{ display:"grid", gap:6 }}>
              <div style={{ fontSize:12, color:"rgba(255,100,100,0.8)", textAlign:"center" as const }}>Permanent — all data deleted.</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setShowDeleteConf(false)} style={{ ...settingsBtn, flex:1, textAlign:"center" as const }}>Cancel</button>
                <button onClick={async () => {
                  const sb = createSupabaseBrowser();
                  if (sb && userId) { await fetch("/api/profile/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:userId})}); await sb.auth.signOut(); window.location.href="/"; }
                }} style={{ ...settingsBtn, flex:1, textAlign:"center" as const, color:"#fff", background:"rgba(255,50,50,0.3)", border:"1px solid rgba(255,80,80,0.35)" }}>
                  Confirm
                </button>
              </div>
            </div>
          )}
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
            <div style={{ fontSize:13, opacity:0.38, padding:"4px 0" }}>No new notifications.</div>
          ) : (<>
            <div style={{ display:"grid", gap:6 }}>
              {notifs.map(n => (
                <div key={n.id} onClick={async () => {
                  // mark as read on click
                  const sb = createSupabaseBrowser();
                  if (sb) await sb.from("notifications").update({ read:true }).eq("id", n.id);
                  setNotifs(p => p.filter(x => x.id !== n.id));
                  setNotifCount(c => Math.max(0, c-1));
                  // navigate to relevant content
                  if (n.type === "track_released" || n.type === "new_track") window.location.href = "/radar";
                }} style={{ padding:"10px 12px", borderRadius:12, background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16 }}>{n.type==="track_released"?"🎉":n.type==="new_message"?"💬":"🔔"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      {n.track_title && <div style={{ fontWeight:700, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.track_title}</div>}
                      <div style={{ fontSize:12, opacity:0.6, marginTop:1 }}>{n.message || (n.type==="track_released"?"Just dropped 🎉":"New notification")}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={async () => {
              const sb = createSupabaseBrowser();
              if (sb && userId) await sb.from("notifications").update({read:true}).eq("user_id",userId).eq("read",false);
              setNotifs([]); setNotifCount(0); setShowNotifs(false);
            }} style={{ fontSize:12, opacity:0.45, background:"none", border:"none", color:"#fff", cursor:"pointer", padding:"6px 0", textAlign:"center" as const, width:"100%" }}>
              Mark all as read
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
