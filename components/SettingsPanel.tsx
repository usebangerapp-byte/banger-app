"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const MONO = "var(--font-geist-mono), ui-monospace, monospace";

const PLAN_FEATURES = [
  { label: "Scan tracks",        sub: "Recognize songs in real time",          free: true,  pro: true },
  { label: "Unlimited scans",    sub: "No daily cap",                          free: true,  pro: true },
  { label: "Released charts",    sub: "The full released chart",               free: true,  pro: true },
  { label: "Follow tracks",      sub: "Get notified the day an ID drops",      free: true,  pro: true },
  { label: "Unreleased charts",  sub: "Free: top 3 — PRO: the full chart",     free: false, pro: true },
  { label: "Upload your IDs",    sub: "Submit your unreleased tracks",         free: false, pro: true },
  { label: "Priority in charts", sub: "Your tracks ranked first",              free: false, pro: true },
  { label: "Scan statistics",    sub: "See how often you've been scanned",     free: false, pro: true },
  { label: "Release control",    sub: "Flip UNREL → REL when you drop",        free: false, pro: true },
  { label: "Audio snippet",      sub: "10s teaser before the release",         free: false, pro: true },
];

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

        {/* Account */}
        <section style={section}>
          <div style={label}>ACCOUNT</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email || "—"}
            </span>
            <span style={isPro ? badgePro : badgeFree}>{isPro ? "✦ PRO" : "FREE"}</span>
          </div>
        </section>

        {/* Plan */}
        <section style={section}>
          <div style={label}>CURRENT PLAN</div>
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {isPro ? "✦ BANGER PRO" : "FREE"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 10, lineHeight: 1.6 }}>
              {isPro ? "€9.99 / month · every feature unlocked" : "Unlimited scans · top 3 unreleased · no uploads"}
            </div>
          </div>
          {isPro ? (
            <div style={{ display: "grid", gap: 10 }}>
              <button onClick={openPortal} disabled={portalLoading} style={{ ...btnGhost, opacity: portalLoading ? 0.6 : 1 }}>
                {portalLoading ? "Opening…" : "Manage subscription"}
              </button>
              <div style={hint}>Payment method, invoices, cancellation.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <button onClick={() => { onClose(); window.location.href = "/upgrade"; }} style={btnSolid}>
                ✦ Upgrade to PRO — €9.99/mo
              </button>
              <div style={hint}>Full unreleased charts · upload your IDs · priority in charts</div>
            </div>
          )}
        </section>

        {/* What's included */}
        <section style={section}>
          <div style={label}>WHAT&apos;S INCLUDED</div>
          <div>
            {PLAN_FEATURES.map((f, i) => {
              const active = isPro ? f.pro : f.free;
              return (
                <div key={f.label} style={{ ...featureRow, borderTop: i === 0 ? "none" : featureRow.borderTop }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.25)", width: 22 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, opacity: active ? 1 : 0.35 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{f.sub}</div>
                  </div>
                  {active
                    ? <span style={{ color: "rgba(29,185,84,0.9)", fontWeight: 900, fontSize: 12 }}>✓</span>
                    : <span style={proTag}>PRO</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Preferences */}
        <section style={section}>
          <div style={label}>PREFERENCES</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Notifications</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Messages, followers, releases</div>
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
const section: React.CSSProperties = { display: "grid", gap: 18 };
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
