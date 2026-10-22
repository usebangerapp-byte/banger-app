"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import SettingsPanel from "@/components/SettingsPanel";
import { ProSheetHost } from "@/components/ProSheet";
import { C, glass } from "@/lib/ui";

const HIDDEN_PATHS = ["/", "/login", "/unlock", "/onboarding", "/auth/callback", "/privacy", "/terms", "/contact"];

export default function TopBar() {
  const pathname = usePathname();
  const [showSettings,   setShowSettings]   = useState(false);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [notifCount,     setNotifCount]     = useState(0);
  const [notifs,         setNotifs]         = useState<any[]>([]);
  const [notifDiag,      setNotifDiag]      = useState<string>("");
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
      if (!res) { setNotifDiag("no session"); return; }
      const j = await res.json().catch(() => null);
      if (!res.ok) { setNotifDiag(`HTTP ${res.status}${j?.error ? ` — ${j.error}` : ""}`); return; }
      const list = Array.isArray(j?.notifications) ? j.notifications : [];
      setNotifs(list);
      setNotifCount(typeof j?.unread === "number" ? j.unread : list.filter((n: any) => !n.read).length);
      setNotifDiag(j?.diag || "");
    } catch (e: any) { setNotifDiag(e?.message || "network error"); }
  }, [authedFetch]);

  useEffect(() => { loadNotifs(); }, [pathname, loadNotifs]);
  useEffect(() => {
    const t = window.setInterval(loadNotifs, 30000);
    return () => window.clearInterval(t);
  }, [loadNotifs]);

  async function markRead(id?: string) {
    await authedFetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "read", id }) }).catch(() => {});
  }

  async function deleteNotif(n: any) {
    setNotifs((list) => list.filter((x) => x.id !== n.id));
    if (!n.read) setNotifCount((c) => Math.max(0, c - 1));
    await authedFetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "delete", ids: n.ids || [n.id] }) }).catch(() => {});
  }

  function openNotif(n: any) {
    if (!n.read) markRead(n.id);
    setShowNotifs(false);
    if (n.type === "message" && n.actor_id) window.location.href = `/profile?tab=messages&with=${n.actor_id}`;
    else if (n.type === "message") window.location.href = "/profile?tab=messages";
    else if (n.type === "follow" && n.actor_id) window.location.href = `/dj/${n.actor_id}`;
    else if (n.type === "weekly_ids") window.location.href = "/radar";
    else if (n.type === "promo_listened" || n.type === "promo_liked" || n.type === "promo_downloaded") window.location.href = "/promo";
    else if (n.type === "track_released" || n.type === "new_track") {
      // Open the track itself (preview, Spotify, Beatport). Older rows wrote the title as  🔥 "TITLE" is out
      const raw = String(n.track_title || "");
      const quoted = raw.match(/[“"](.+?)[”"]/);
      const title = (quoted ? quoted[1] : raw).trim();
      const artist = String(n.message || "").split(/\s+[—-]\s+/)[0].replace(/^(out now|released).*$/i, "").trim();
      window.location.href = title ? `/track?t=${encodeURIComponent(title)}${artist && artist !== n.message ? `&a=${encodeURIComponent(artist)}` : ""}` : "/charts";
    }
  }

  if (HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <>
      <ProSheetHost />
      {/* TopBar strip */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "calc(56px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)",
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingLeft: 16, paddingRight: 16, boxSizing: "border-box",
      }}>
        {/* Settings — left */}
        <button aria-label="Settings" onClick={() => { setShowSettings(v => !v); setShowNotifs(false); }} style={iconBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Logo center */}
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.24em", color: "#fff" }}>BANGER</span>
        </span>

        {/* Notifications — right */}
        <button onClick={() => {
          const opening = !showNotifs;
          setShowNotifs(opening); setShowSettings(false);
          if (opening && notifCount > 0) {
            setNotifCount(0);
            markRead();
            // keep the "new" dots visible while the panel is open, they disappear next time
          }
        }} aria-label="Notifications" style={{ ...iconBtn, position: "relative" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {notifCount > 0 && (
            <span style={{ position:"absolute", top:-3, right:-3, minWidth:17, height:17, padding:"0 4px", boxSizing:"border-box", borderRadius:999,
              background:C.goldGrad, color:C.goldInk, fontSize:10, fontWeight:800, boxShadow:"0 0 10px rgba(245,207,104,0.6)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </button>
      </div>

      {/* Spacer so content doesn't hide under TopBar */}
      <div style={{ height: "calc(56px + env(safe-area-inset-top))" }} />

      {/* Settings — full-screen panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Notifications panel */}
      {showNotifs && (
        <div style={panelStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={panelTitle}>Notifications</div>
            <button aria-label="Close" onClick={() => setShowNotifs(false)} style={closeBtn}>✕</button>
          </div>
          {notifs.length === 0 ? (
            <div style={{ display:"grid", gap:6, padding:"8px 0" }}>
              <div style={{ fontSize:14, color:C.text3 }}>No notifications yet.</div>
              {notifDiag && (
                <div style={{ fontSize:10, color:"rgba(255,120,120,0.6)", overflowWrap:"anywhere" as const }}>
                  {notifDiag}
                </div>
              )}
            </div>
          ) : (<>
            <div style={{ display:"grid", gap:0 }}>
              {notifs.map(n => (
                <SwipeRow key={n.id} onOpen={() => openNotif(n)} onDelete={() => deleteNotif(n)}>
                  <div style={notifRow}>
                  <div style={notifAvatar}>
                    {n.actor_avatar
                      ? <img src={n.actor_avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : n.type === "message" || n.type === "follow"
                      ? (n.track_title || "?").charAt(0).toUpperCase()
                      : <img src="/icon-192.png" alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                      <span style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, flex:1, minWidth:0 }}>
                        {n.track_title || "BANGER"}
                      </span>
                      <span style={{ fontSize:12, color:C.text4, flexShrink:0 }}>{timeAgo(n.created_at)}</span>
                    </div>
                    <div style={{ fontSize:13, color:C.text2, marginTop:2, lineHeight:1.4 }}>
                      {n.message || (n.type==="track_released" ? "Released — available now" : "New notification")}
                    </div>
                  </div>
                  {!n.read && <span style={unreadDot} />}
                  </div>
                </SwipeRow>
              ))}
            </div>
          </>)}
        </div>
      )}

      {/* Backdrop */}
      {showNotifs && (
        <div onClick={() => { setShowSettings(false); setShowNotifs(false); }} style={backdrop} />
      )}
    </>
  );
}

/** Swipe a row to the left to delete it (a red "Delete" shows underneath). A tap still opens it. */
function SwipeRow({ children, onOpen, onDelete }: { children: React.ReactNode; onOpen: () => void; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const horizontal = useRef<boolean | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    moved.current = false; horizontal.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!start.current) return;
    const ddx = e.touches[0].clientX - start.current.x, ddy = e.touches[0].clientY - start.current.y;
    if (horizontal.current === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) horizontal.current = Math.abs(ddx) > Math.abs(ddy);
    if (!horizontal.current) return;
    moved.current = true;
    setDx(Math.min(0, ddx));
  }
  function onTouchEnd() {
    start.current = null;
    if (dx < -90) { setLeaving(true); setDx(-500); window.setTimeout(onDelete, 220); }
    else setDx(0);
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", maxHeight: leaving ? 0 : 200, transition: leaving ? "max-height .25s ease .15s" : undefined }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end",
        paddingRight: 18, background: "#e5484d", color: "#fff", fontSize: 14, fontWeight: 700, opacity: dx < 0 ? 1 : 0 }}>Delete</div>
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={() => { if (!moved.current) onOpen(); }}
        style={{ position: "relative", transform: `translateX(${dx}px)`, transition: start.current ? "none" : "transform .22s ease",
          background: "rgb(30,30,30)", touchAction: "pan-y" }}>
        {children}
      </div>
    </div>
  );
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}
const notifRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "13px 0",
  borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", minWidth: 0,
};
const notifAvatar: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900,
};
const unreadDot: React.CSSProperties = { width: 7, height: 7, borderRadius: "50%", background: C.gold, boxShadow: "0 0 8px rgba(245,207,104,0.8)", flexShrink: 0 };

const iconBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer",
  padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
};
const panelStyle: React.CSSProperties = {
  position: "fixed", top: "calc(64px + env(safe-area-inset-top))", left: 12, right: 12, zIndex: 200,
  ...glass, background: "rgba(28,28,28,0.72)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)",
  borderRadius: 26, padding: "18px 18px 10px", display: "grid", gap: 4, maxWidth: 520, margin: "0 auto",
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
  fontSize: 17, fontWeight: 700, marginBottom: 4,
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
  width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.10)",
  border: "none", color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer", padding: 0,
};
const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.35)",
};
