"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import PageHeader from "@/components/PageHeader";
import { fmtTitle, fmtArtist } from "@/lib/format";
import { fmtTime } from "@/lib/setlists";
import { ui, C, glass, tag } from "@/lib/ui";

type Proposal = { key: string; title: string; artist: string; users: number; weight: number; scan: number; verified: boolean; on_banger: boolean; by: string[]; match: boolean };
type Item = { track_id: string; set: { id: string; title?: string; venue?: string | null; cover_url?: string | null }; position: number; start_sec: number | null; asks: number; proposals: Proposal[]; conflict: boolean };

/** Admin: every ID with a proposed name (from the set scan and/or users), to confirm by hand. */
export default function SetsReviewPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [other, setOther] = useState<{ id: string; title: string; artist: string } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    authFetch("/api/setlists/review", { cache: "no-store" }).then((r) => r.json())
      .then((j) => { if (j?.ok) { setItems(j.items); setError(""); } else { setItems([]); setError(j?.error || "Couldn't load"); } })
      .catch(() => { setItems([]); setError("Couldn't load"); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(setId: string, body: any, done: string) {
    setBusy(body.track_id + (body.key || body.action));
    const r = await authFetch(`/api/setlists/${setId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy("");
    if (!j?.ok) { setMsg(j?.error || "Couldn't save"); return; }
    setMsg(done); setOther(null); load();
  }

  const status = (p: Proposal) => p.on_banger ? { t: "On BANGER", k: "pro" as const } : p.verified ? { t: "Released", k: "rel" as const } : { t: "Not found · unreleased?", k: "unrel" as const };

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader title="Review IDs" code={<Link href="/sets" style={{ color: C.gold, textDecoration: "none" }}>Sets</Link>} />
        <div style={{ fontSize: 13, color: C.text2, padding: "0 4px", lineHeight: 1.5 }}>
          Names proposed for IDs, by the set scan and by users. Nothing is renamed until you validate. Listen to the moment before deciding.
        </div>
        {msg && <div style={{ fontSize: 13, color: C.gold, padding: "0 4px" }}>{msg}</div>}

        {items === null ? <div style={ui.empty}>Loading…</div>
          : error ? <div style={ui.empty}>{error}</div>
          : items.length === 0 ? <div style={ui.empty}>Nothing to review.</div>
          : items.map((it) => (
            <section key={it.track_id} style={{ ...glass, borderRadius: 22, padding: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: it.set.cover_url ? `center/cover no-repeat url(${it.set.cover_url})` : "linear-gradient(160deg,#3a2c12,#0b0b0b)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtArtist(it.set.title || "Set")}</div>
                  <div style={{ fontSize: 12, color: C.text3 }}>
                    {[`ID #${it.position}`, it.start_sec != null ? fmtTime(it.start_sec) : "", it.asks ? `${it.asks} want to know` : "", it.conflict ? "⚠ several names" : ""].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Link href={`/sets/${it.set.id}${it.start_sec != null ? `?t=${it.start_sec}` : ""}`} style={{ ...ui.pillSmall, color: C.gold, borderColor: "rgba(245,207,104,0.35)", flexShrink: 0 }}>▶ Listen</Link>
              </div>

              {it.proposals.map((p) => {
                const st = status(p);
                return (
                  <div key={p.key} style={{ padding: "10px 12px", borderRadius: 14, background: p.match ? "rgba(95,227,154,0.08)" : "rgba(245,207,104,0.06)", border: `1px solid ${p.match ? "rgba(95,227,154,0.35)" : "rgba(245,207,104,0.22)"}`, display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 140, fontSize: 14, fontWeight: 700 }}>{fmtArtist(p.artist)} — {fmtTitle(p.title)}</div>
                      <span style={tag(st.k)}>{st.t}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                      {[
                        p.match ? "✓ Scan and users agree" : "",
                        p.scan ? `🎙 Scan heard it ${p.scan}×` : "",
                        p.users ? `👥 ${p.users} user${p.users > 1 ? "s" : ""}${p.by.length ? ` (${p.by.slice(0, 3).join(", ")}${p.by.length > 3 ? "…" : ""})` : ""} · trust ${p.weight}` : "",
                      ].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button disabled={!!busy} onClick={() => act(it.set.id, { action: "validate", track_id: it.track_id, key: p.key }, "Validated ✓")} style={{ ...ui.pillSmall, color: C.goldInk, background: C.goldGrad, border: "1px solid transparent" }}>Validate</button>
                      <button disabled={!!busy} onClick={() => act(it.set.id, { action: "reject", track_id: it.track_id, key: p.key }, "Rejected")} style={{ ...ui.pillSmall, color: C.text3 }}>Reject</button>
                    </div>
                  </div>
                );
              })}

              {other?.id === it.track_id ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <input value={other.artist} onChange={(e) => setOther({ ...other, artist: e.target.value })} placeholder="Artist" style={{ ...ui.input, padding: "8px 10px", fontSize: 14 }} />
                    <input value={other.title} onChange={(e) => setOther({ ...other, title: e.target.value })} placeholder="Title" style={{ ...ui.input, padding: "8px 10px", fontSize: 14 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={!other.title.trim() || !!busy} onClick={() => act(it.set.id, { action: "name", track_id: it.track_id, title: other.title, artist: other.artist }, "Named ✓")} style={{ ...ui.pillSmall, color: C.goldInk, background: C.goldGrad, border: "1px solid transparent" }}>Validate this name</button>
                    <button onClick={() => setOther(null)} style={{ ...ui.pillSmall, color: C.text3 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setOther({ id: it.track_id, title: "", artist: "" })} style={{ ...ui.more, color: C.text3, justifySelf: "start" }}>✎ Another name</button>
              )}
            </section>
          ))}
      </div>
    </main>
  );
}
