"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { authFetch } from "@/lib/authFetch";
import { C, glass, tag } from "@/lib/ui";



export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [username, setUsername] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (!user) return;
      setEmail(user.email || "");
      setUserId(user.id);
      sb.from("profiles").select("role,notifs_enabled,display_name").eq("id", user.id).maybeSingle().then(({ data: p }) => {
        const dn = (p?.display_name || "").trim();
        if (dn && dn !== user.email && !dn.includes("@")) setUsername(dn);
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

  async function saveUsername() {
    const v = nameDraft.trim().replace(/\s+/g, " ");
    if (v.length < 2 || v.length > 24) { setNameMsg("2 to 24 characters."); return; }
    if (v.includes("@")) { setNameMsg("No @ — that looks like an email."); return; }
    setSavingName(true); setNameMsg("");
    try {
      const sb = createSupabaseBrowser();
      if (sb) {
        const { data: taken } = await sb.from("profiles").select("id").ilike("display_name", v).neq("id", userId).limit(1);
        if (taken?.length) { setNameMsg("Already taken — try another one."); return; }
      }
      const res = await authFetch("/api/profile/update", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: v }),
      });
      if (!res.ok) throw new Error("failed");
      setUsername(v); setEditingName(false);
    } catch { setNameMsg("Couldn't save. Try again."); }
    finally { setSavingName(false); }
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

  async function deleteAccount() {
    setDeleting(true); setDeleteError("");
    try {
      const res = await authFetch("/api/profile/delete", { method: "POST" });
      if (!res.ok) throw new Error("failed");
      const sb = createSupabaseBrowser();
      if (sb) await sb.auth.signOut();
      window.location.href = "/";
    } catch {
      setDeleteError("Couldn't delete the account. Try again or contact contact@usebanger.com.");
      setDeleting(false);
    }
  }

  async function signOut() {
    const sb = createSupabaseBrowser();
    if (sb) await sb.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={overlay}>
      <div aria-hidden style={glow} />
      <div style={shell}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={eyebrow}>SETTINGS</div>
          <button onClick={onClose} aria-label="Close" style={closeBtn}>✕</button>
        </div>

        {/* Notifications — first */}
        <section style={group}>
          <div style={{ ...row, borderBottom: "none" }}>
            <div>
              <div style={rowTitle}>Notifications</div>
              <div style={rowSub}>Messages, followers, releases</div>
            </div>
            <button onClick={toggleNotifs} role="switch" aria-checked={notifsEnabled} aria-label="Notifications" style={{
              width: 51, height: 31, borderRadius: 16, border: "none", cursor: "pointer", flexShrink: 0,
              background: notifsEnabled ? C.goldGrad : "rgba(255,255,255,0.16)", position: "relative", transition: "background 0.2s",
            }}>
              <span style={{
                position: "absolute", top: 2, left: notifsEnabled ? 22 : 2, width: 27, height: 27, borderRadius: "50%",
                transition: "left 0.2s", background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
              }} />
            </button>
          </div>
        </section>

        {/* Account */}
        <div style={groupLabel}>Account</div>
        <section style={group}>
          {!editingName ? (
            <button onClick={() => { setNameDraft(username); setNameMsg(""); setEditingName(true); }} style={linkRow}>
              <span>Username</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ color: username ? C.text2 : C.gold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {username || "Choose one"}
                </span>
                <span style={chev}>›</span>
              </span>
            </button>
          ) : (
            <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.lineSoft}`, display: "grid", gap: 10 }}>
              <input autoFocus value={nameDraft} maxLength={24} placeholder="Your username"
                onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.glassBorder}`,
                  borderRadius: 14, color: "#fff", fontSize: 16, padding: "12px 14px", outline: "none", fontFamily: "inherit" }} />
              {nameMsg && <div style={{ fontSize: 13, color: C.danger }}>{nameMsg}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditingName(false)} style={cancelBtn}>Cancel</button>
                <button onClick={saveUsername} disabled={savingName}
                  style={{ ...cancelBtn, background: C.goldGrad, color: C.goldInk, border: "none", fontWeight: 700 }}>
                  {savingName ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
          <div style={row}>
            <span style={{ fontSize: 15, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email || "—"}
            </span>
            <span style={isPro ? tag("pro") : tag("neutral")}>{isPro ? "PRO" : "Free"}</span>
          </div>
          {isPro ? (
            <button onClick={openPortal} disabled={portalLoading} style={{ ...linkRow, borderBottom: "none" }}>
              <span>{portalLoading ? "Opening…" : "Manage subscription"}</span><span style={chev}>›</span>
            </button>
          ) : (
            <button onClick={() => { onClose(); window.location.href = "/upgrade"; }} style={{ ...linkRow, borderBottom: "none", color: C.gold }}>
              <span>Go Pro</span><span style={chev}>›</span>
            </button>
          )}
        </section>

        {/* Profile */}
        <section style={group}>
          <button onClick={() => { onClose(); window.location.href = "/profile?edit=1"; }} style={{ ...linkRow, borderBottom: "none" }}>
            <span>Edit profile</span><span style={chev}>›</span>
          </button>
        </section>

        {/* About & legal (required by the App Store) */}
        <div style={groupLabel}>About</div>
        <section style={group}>
          <a href="/contact" style={linkRow}><span>Contact</span><span style={chev}>›</span></a>
          <a href="/terms" style={linkRow}><span>Terms of Service</span><span style={chev}>›</span></a>
          <a href="/privacy" style={{ ...linkRow, borderBottom: "none" }}><span>Privacy Policy</span><span style={chev}>›</span></a>
        </section>

        {/* Sign out */}
        <section style={group}>
          <button onClick={signOut} style={{ ...linkRow, borderBottom: "none", color: C.danger, justifyContent: "center" }}>Sign out</button>
        </section>

        {/* Delete account — two-step confirmation */}
        <section style={{ display: "grid", gap: 10 }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={deleteLink}>Delete my account</button>
          ) : (
            <div style={dangerBox}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Delete your account?</div>
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>
                Your profile, scans, follows, messages and notifications are erased for good. If you have a PRO
                subscription, cancel it first in Manage subscription.
              </div>
              {deleteError && <div style={{ fontSize: 13, color: C.danger }}>{deleteError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={cancelBtn}>Cancel</button>
                <button onClick={deleteAccount} disabled={deleting} style={dangerBtn}>{deleting ? "Deleting…" : "Delete forever"}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 300, background: "#000", color: "#fff",
  overflowY: "auto", WebkitOverflowScrolling: "touch",
};
const glow: React.CSSProperties = {
  position: "fixed", inset: 0, pointerEvents: "none",
  background: "radial-gradient(520px 520px at 15% 10%, rgba(232,170,40,0.24), rgba(232,170,40,0.06) 45%, transparent 70%)",
};
const shell: React.CSSProperties = {
  position: "relative", maxWidth: 560, margin: "0 auto",
  padding: "calc(18px + env(safe-area-inset-top)) 18px calc(60px + env(safe-area-inset-bottom))",
  display: "grid", gap: 14,
};
const group: React.CSSProperties = { ...glass, borderRadius: 18, padding: "0 16px", display: "grid" };
const groupLabel: React.CSSProperties = { fontSize: 13, color: C.text3, padding: "10px 4px 0" };
const row: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minWidth: 0,
  padding: "14px 0", borderBottom: `1px solid ${C.lineSoft}`,
};
const rowTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600 };
const rowSub: React.CSSProperties = { fontSize: 13, color: C.text3, marginTop: 2 };
const eyebrow: React.CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "0.16em", color: "#fff" };
const closeBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: "50%", border: "none",
  background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.8)", fontSize: 13, cursor: "pointer",
};
const linkRow: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
  background: "none", border: "none", borderBottom: `1px solid ${C.lineSoft}`, padding: "14px 0", color: "#fff", textDecoration: "none",
  fontSize: 16, fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
};
const chev: React.CSSProperties = { color: "rgba(255,255,255,0.35)", fontSize: 18, lineHeight: 1 };
const deleteLink: React.CSSProperties = {
  justifySelf: "center", background: "none", border: "none", padding: "6px 0", cursor: "pointer",
  color: C.text4, fontSize: 13, fontWeight: 500,
};
const dangerBox: React.CSSProperties = {
  ...glass, display: "grid", gap: 10, border: "1px solid rgba(255,90,90,0.30)", borderRadius: 18, padding: 16,
  background: "rgba(255,60,60,0.06)",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "12px 0", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#fff",
  border: `1px solid ${C.glassBorder}`, fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const dangerBtn: React.CSSProperties = {
  flex: 1, padding: "12px 0", borderRadius: 999, background: "#e5484d", color: "#fff",
  border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
