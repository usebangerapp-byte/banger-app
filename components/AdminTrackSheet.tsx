"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { authFetch } from "@/lib/authFetch";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { isAdminEmail } from "@/lib/admins";
import { ui, C, glass } from "@/lib/ui";

/* ── Is the signed-in user a BANGER admin? (checked once per session) ── */
let adminP: Promise<boolean> | null = null;
export function useIsAdmin() {
  const [is, setIs] = useState(false);
  useEffect(() => {
    if (!adminP) adminP = (async () => {
      const sb = createSupabaseBrowser();
      const { data } = (await sb?.auth.getSession()) || { data: null as any };
      return isAdminEmail(data?.session?.user?.email);
    })().catch(() => false);
    adminP.then(setIs);
  }, []);
  return is;
}

/** Admin edit sheet for any track: rename, scan count, hide from lists, released status. */
export default function AdminTrackSheet({ title, artist, onClose }: { title: string; artist?: string | null; onClose: () => void }) {
  const [t, setT] = useState(title);
  const [a, setA] = useState(artist || "");
  const [scans, setScans] = useState("");
  const [hidden, setHidden] = useState(false);
  const [pick, setPick] = useState(false);
  const [pick0, setPick0] = useState(false);
  const [released, setReleased] = useState<boolean | null>(null);
  const [inBanger, setInBanger] = useState(false);
  const [real, setReal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [initial, setInitial] = useState<{ scans: string; hidden: boolean; released: boolean | null }>({ scans: "", hidden: false, released: null });

  useEffect(() => {
    authFetch(`/api/admin/track?title=${encodeURIComponent(title)}`).then((r) => r.json()).then((j) => {
      if (!j?.ok) return;
      setInBanger(!!j.inBanger); setReleased(j.released); setHidden(!!j.hidden); setPick(!!j.pick); setPick0(!!j.pick); setReal(typeof j.realScans === "number" ? j.realScans : null);
      setScans(j.scans == null ? "" : String(j.scans));
      if (!artist && j.artist) setA(j.artist);
      setInitial({ scans: j.scans == null ? "" : String(j.scans), hidden: !!j.hidden, released: j.released });
    }).catch(() => {});
  }, [title, artist]);

  async function save() {
    setBusy(true); setErr("");
    const body: any = { title, artist: artist || "" };
    if (t.trim() !== title || a.trim() !== (artist || "")) { body.newTitle = t.trim(); body.newArtist = a.trim(); }
    if (pick !== pick0) body.pick = pick;
    if (scans !== initial.scans || hidden !== initial.hidden) { body.hidden = hidden; body.scans = scans.trim() === "" ? null : Number(scans); }
    if (released !== null && released !== initial.released) body.released = released;
    const r = await authFetch("/api/admin/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (r?.ok && j?.ok) { window.location.reload(); return; }
    setErr(j?.error || "Couldn't save."); setBusy(false);
  }

  const seg = (on: boolean): CSSProperties => ({
    flex: 1, padding: "10px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
    color: on ? C.goldInk : "#fff", border: on ? "1px solid transparent" : `1px solid ${C.glassBorder}`, background: on ? C.goldGrad : "rgba(255,255,255,0.06)",
  });

  // Rendered at the root of the page: inside a list row, "fixed" would be trapped by the row's blur effect.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...glass, background: "rgba(20,20,20,0.96)", width: "100%", maxWidth: 520, borderRadius: "24px 24px 0 0",
        padding: "18px 18px calc(22px + env(safe-area-inset-bottom))", display: "grid", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: C.gold }}>ADMIN · EDIT TRACK</div>
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Title" style={{ ...ui.input, fontWeight: 600 }} />
        <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Artist" style={ui.input} />
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: C.text2 }}>
          <span>Scans shown in Radar & Charts{real !== null ? <> · real: <b style={{ color: "#fff" }}>{real}</b></> : null}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={scans} onChange={(e) => setScans(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
              placeholder={real !== null ? `${real} (real)` : "Real count"} style={{ ...ui.input, flex: 1 }} />
            {scans !== "" && <button type="button" onClick={() => setScans("")} style={{ ...ui.pillSmall, padding: "0 14px" }}>Use real</button>}
          </div>
        </label>
        {inBanger && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setReleased(false)} style={seg(released === false)}>Unreleased</button>
            <button onClick={() => setReleased(true)} style={seg(released === true)}>Released</button>
          </div>
        )}
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} style={{ accentColor: "#e9b844", width: 18, height: 18 }} />
          Hide from Radar & Charts
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={pick} onChange={(e) => setPick(e.target.checked)} style={{ accentColor: "#e9b844", width: 18, height: 18 }} />
          Staff pick (shown first in quiet lists)
        </label>
        {err && <div style={{ fontSize: 13, color: C.danger }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ ...ui.pill, flex: 1, justifyContent: "center" }}>Cancel</button>
          <button onClick={save} disabled={busy || !t.trim()} style={{ ...ui.cta, flex: 1 }}>{busy ? "…" : "Save"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
