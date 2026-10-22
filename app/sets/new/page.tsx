"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import PageHeader from "@/components/PageHeader";
import { parseTracklist, fmtTime } from "@/lib/setlists";
import { ui, C, glass, FLAT } from "@/lib/ui";

/** Admins: add a set — link, names, and the tracklist ("0:00 Artist - Title", "34:10 ID"). */
export default function NewSetPage() {
  const router = useRouter();
  const [f, setF] = useState({ source_url: "", title: "", venue: "", played_on: "", tracklist: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [auto, setAuto] = useState<{ busy?: boolean; note?: string; source?: string } | null>(null);

  // Paste the link → title, venue, date and tracklist fill in by themselves; everything stays editable.
  useEffect(() => {
    const url = f.source_url.trim();
    if (!/^https?:\/\//.test(url)) return;
    const t = setTimeout(async () => {
      setAuto({ busy: true });
      const r = await authFetch(`/api/setlists/preview?url=${encodeURIComponent(url)}`).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (!j?.ok) { setAuto({ note: j?.error || "Couldn't read the link." }); return; }
      setF((cur) => ({
        ...cur,
        title: cur.title || j.title || "", venue: cur.venue || j.venue || "",
        played_on: cur.played_on || j.played_on || "", tracklist: cur.tracklist || j.tracklist || "",
      }));
      setAuto({ source: j.source, note: j.note });
    }, 500);
    return () => clearTimeout(t);
  }, [f.source_url]);
  const rows = parseTracklist(f.tracklist);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true); setErr("");
    const r = await authFetch("/api/setlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (r?.ok && j?.ok) router.push(`/sets/${j.id}`); else { setErr(j?.error || "Couldn't save"); setBusy(false); }
  }

  return (
    <main style={ui.page}>
      <div style={ui.shell}>
        <PageHeader back title="Add a set" />
        <section style={{ ...glass, borderRadius: 22, padding: 16, display: "grid", gap: 10 , ...FLAT }}>
          <label style={lab}>YouTube / SoundCloud / Mixcloud link<input value={f.source_url} onChange={set("source_url")} placeholder="https://youtu.be/…" style={ui.input} /></label>
          {auto && (
            <div style={{ fontSize: 13, color: auto.busy ? C.text3 : C.gold, lineHeight: 1.5 }}>
              {auto.busy ? "Reading the link…" : <>{auto.source ? `Filled from ${auto.source} — check and edit if needed.` : ""}{auto.note ? <span style={{ display: "block", color: C.text3 }}>{auto.note}</span> : null}</>}
            </div>
          )}
          <label style={lab}>DJs<input value={f.title} onChange={set("title")} placeholder="Rafael B2B Brunello" style={ui.input} /></label>
          <label style={lab}>Venue<input value={f.venue} onChange={set("venue")} placeholder="Santa Monica" style={ui.input} /></label>
          <label style={lab}>Date<input type="date" value={f.played_on} onChange={set("played_on")} style={ui.input} /></label>
          <label style={lab}>Tracklist — one line per track, “0:00 Artist - Title”, unknown = “34:10 ID”
            <textarea value={f.tracklist} onChange={set("tracklist")} rows={10} placeholder={"0:00 Artist - Title\n6:42 RAFAEL - Gotta Be Cool\n34:10 ID"} style={{ ...ui.input, fontFamily: "inherit", resize: "vertical" }} />
          </label>
          {rows.length > 0 && (
            <div style={{ fontSize: 13, color: C.text2, display: "grid", gap: 4 }}>
              <b style={{ color: "#fff" }}>{rows.length} tracks · {rows.filter((r) => !r.title).length} IDs</b>
              {rows.slice(0, 40).map((r, i) => <div key={i}>{String(i + 1).padStart(2, "0")} · {fmtTime(r.start_sec) || "—"} · {r.title ? `${r.artist ? r.artist + " — " : ""}${r.title}` : <span style={{ color: C.gold }}>ID</span>}</div>)}
            </div>
          )}
          {err && <div style={{ color: C.danger, fontSize: 13 }}>{err}</div>}
          <button onClick={save} disabled={busy || !f.source_url.trim() || !f.title.trim()} style={ui.cta}>{busy ? "Saving…" : "Publish the set"}</button>
        </section>
      </div>
    </main>
  );
}
const lab: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, color: C.text3 };
