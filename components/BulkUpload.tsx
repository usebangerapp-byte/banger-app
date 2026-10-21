"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { authFetch } from "@/lib/authFetch";
import { guessTrackName } from "@/lib/trackName";
import { ui, C, glass } from "@/lib/ui";

type Item = {
  id: string; file: File; artist: string; title: string;
  state: "ready" | "prep" | "upload" | "register" | "done" | "error";
  pct: number; error?: string;
};

const MAX_BYTES = 45 * 1024 * 1024;
const CONCURRENCY = 2;

function durationOf(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => { resolve(isFinite(a.duration) ? a.duration : 0); URL.revokeObjectURL(url); };
    a.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
    a.src = url;
  });
}

function putWithProgress(url: string, file: File, onPct: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(xhr.status === 413 ? "File too big" : `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error"));
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file, file.name);
    xhr.send(fd);
  });
}

/** Several tracks at once: names guessed from each file, one shared status, 2 uploads in parallel. */
export default function BulkUpload({ initialFiles }: { initialFiles?: File[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [released, setReleased] = useState(false);
  const [allowPreview, setAllowPreview] = useState(true);
  const [rights, setRights] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ffRef = useRef<FFmpeg | null>(null);
  const ffLock = useRef<Promise<unknown>>(Promise.resolve());

  // Files picked on the "One track" screen arrive here directly
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !initialFiles?.length) return;
    seeded.current = true;
    addFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const patch = (id: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => /^(audio|video)\//.test(f.type) || /\.(mp3|wav|aiff?|flac|m4a|aac|ogg|opus)$/i.test(f.name));
    const added: Item[] = [];
    for (const f of arr) {
      const g = await guessTrackName(f).catch(() => ({ artist: "", title: f.name.replace(/\.[^.]+$/, "") }));
      added.push({ id: crypto.randomUUID(), file: f, artist: g.artist, title: g.title, state: "ready", pct: 0 });
    }
    setItems((list) => [...list, ...added]);
  }

  // ffmpeg.wasm runs one job at a time → queue the audio work
  function withFF<T>(job: (ff: FFmpeg) => Promise<T>): Promise<T> {
    const run = ffLock.current.then(async () => {
      if (!ffRef.current) { ffRef.current = new FFmpeg(); await ffRef.current.load(); }
      return job(ffRef.current);
    });
    ffLock.current = run.catch(() => {});
    return run;
  }

  async function processItem(it: Item) {
    patch(it.id, { state: "prep", pct: 0, error: undefined });
    const dur = await durationOf(it.file);
    const ext = (it.file.name.split(".").pop() || "mp3").toLowerCase();
    const lossless = /^(wav|aif|aiff|flac)$/.test(ext);

    // 1) 25-second preview + (if needed) a light MP3 of the whole track
    const { preview, full } = await withFF(async (ff) => {
      const inName = `in_${it.id}.${ext}`;
      await ff.writeFile(inName, new Uint8Array(await it.file.arrayBuffer()));
      const start = Math.max(0, Math.min(60, Math.floor((dur || 120) * 0.3)));
      await ff.exec(["-ss", String(start), "-t", "25", "-i", inName, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", `prev_${it.id}.mp3`]);
      const pv = await ff.readFile(`prev_${it.id}.mp3`);
      const previewFile = new File([(pv as Uint8Array).buffer as ArrayBuffer], `${it.title || "track"}-preview.mp3`, { type: "audio/mpeg" });
      let fullFile = it.file;
      if (lossless || it.file.size > MAX_BYTES) {
        await ff.exec(["-i", inName, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", `full_${it.id}.mp3`]);
        const fu = await ff.readFile(`full_${it.id}.mp3`);
        fullFile = new File([(fu as Uint8Array).buffer as ArrayBuffer], `${it.title || "track"}.mp3`, { type: "audio/mpeg" });
        try { await ff.deleteFile(`full_${it.id}.mp3`); } catch {}
      }
      for (const f of [inName, `prev_${it.id}.mp3`]) { try { await ff.deleteFile(f); } catch {} }
      return { preview: previewFile, full: fullFile };
    });
    if (full.size > 50 * 1024 * 1024) throw new Error("Too long (over 50 MB)");

    // 2) the track itself in BANGER (title, artist, status, preview)
    patch(it.id, { state: "upload", pct: 0 });
    const fd = new FormData();
    fd.append("file_0", preview); fd.append("file", preview);
    fd.append("title", it.title.trim()); fd.append("artist", it.artist.trim()); fd.append("name", it.artist.trim());
    fd.append("release_status", released ? "released" : "unreleased");
    fd.append("is_released", released ? "true" : "false");
    fd.append("release_date", "");
    fd.append("allow_preview", allowPreview ? "true" : "false");
    fd.append("has_rights", "1"); fd.append("delete_after", "1");
    const up = await authFetch("/api/bpro/upload", { method: "POST", body: fd });
    const upj = await up.json().catch(() => ({}));
    if (!up.ok || upj?.ok === false) throw new Error(upj?.error || "Upload failed");

    // 3) the full track goes straight to storage, then to the recognition engine in one call
    const r1 = await authFetch("/api/bpro/source-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ext: full.name.split(".").pop() }) });
    const u = await r1.json().catch(() => ({}));
    if (!r1.ok || !u.ok) throw new Error(u.error || "Upload not available");
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    await putWithProgress(`${base}/storage/v1/object/upload/sign/${u.bucket}/${u.path}?token=${encodeURIComponent(u.token)}`, full, (p) => patch(it.id, { pct: p }));

    patch(it.id, { state: "register", pct: 100 });
    const r2 = await authFetch("/api/bpro/acr-from-storage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: u.path, title: it.title.trim(), artist: it.artist.trim() }),
    });
    const j2 = await r2.json().catch(() => ({}));
    if (!r2.ok || !j2.ok) throw new Error(j2.error || "Recognition setup failed");
    patch(it.id, { state: "done" });
  }

  async function runAll() {
    if (!rights) return;
    setRunning(true);
    const queue = items.filter((i) => i.state !== "done" && i.title.trim() && i.artist.trim());
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const it = queue[next++];
        try { await processItem(it); }
        catch (e: any) { patch(it.id, { state: "error", error: e?.message || "Error" }); }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }

  const done = items.filter((i) => i.state === "done").length;
  const missing = items.filter((i) => i.state !== "done" && (!i.title.trim() || !i.artist.trim())).length;
  const todo = items.filter((i) => i.state !== "done").length;
  const can = !running && rights && todo > 0 && missing === 0;

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
      {/* Drop zone */}
      <input ref={inputRef} type="file" multiple accept="audio/*,.mp3,.wav,.aif,.aiff,.flac,.m4a" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <div onClick={() => !running && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!running && e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
        style={{ border: "1px dashed rgba(245,207,104,0.40)", borderRadius: 20, padding: "26px 16px", textAlign: "center", cursor: "pointer", background: "rgba(245,207,104,0.06)" }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Drop several tracks here</div>
        <div style={{ marginTop: 4, fontSize: 13, color: C.text3 }}>or tap to choose · names are filled in for you</div>
      </div>

      {items.length > 0 && (<>
        {/* Queue */}
        <section style={{ ...glass, borderRadius: 22, padding: "4px 14px", display: "grid", gridTemplateColumns: "minmax(0,1fr)" }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: "grid", gap: 6, padding: "12px 0", borderBottom: i === items.length - 1 ? "none" : `1px solid ${C.lineSoft}`, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <input value={it.title} disabled={running || it.state === "done"} placeholder="Title"
                  onChange={(e) => patch(it.id, { title: e.target.value })}
                  style={{ ...ui.input, padding: "8px 12px", fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0, borderColor: it.title.trim() ? C.glassBorder : C.danger }} />
                {!running && it.state !== "done" && (
                  <button onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))} aria-label="Remove"
                    style={{ background: "none", border: "none", color: C.text4, cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>
                )}
              </div>
              <input value={it.artist} disabled={running || it.state === "done"} placeholder="Artist"
                onChange={(e) => patch(it.id, { artist: e.target.value })}
                style={{ ...ui.input, padding: "8px 12px", fontSize: 13, borderColor: it.artist.trim() ? C.glassBorder : C.danger }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: it.state === "error" ? C.danger : it.state === "done" ? C.rel : C.text3 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.state === "ready" ? `${(it.file.size / 1024 / 1024).toFixed(1)} MB · ready`
                    : it.state === "prep" ? "Preparing…"
                    : it.state === "upload" ? `Uploading… ${it.pct}%`
                    : it.state === "register" ? "Registering…"
                    : it.state === "done" ? "Done ✓ · now scannable"
                    : it.error}
                </span>
              </div>
              {(it.state === "upload" || it.state === "register" || it.state === "prep") && (
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${it.state === "prep" ? 8 : it.state === "register" ? 100 : Math.max(8, it.pct)}%`, background: C.goldGrad, transition: "width .3s ease" }} />
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Shared settings */}
        <section style={{ ...glass, borderRadius: 22, padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[false, true].map((rel) => (
              <button key={String(rel)} disabled={running} onClick={() => setReleased(rel)}
                style={{ padding: "11px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                  color: released === rel ? C.goldInk : "#fff", border: released === rel ? "1px solid transparent" : `1px solid ${C.glassBorder}`,
                  background: released === rel ? C.goldGrad : "rgba(255,255,255,0.06)" }}>
                {rel ? "Released" : "Unreleased"}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={allowPreview} disabled={running} onChange={(e) => setAllowPreview(e.target.checked)} style={{ accentColor: "#e9b844", width: 18, height: 18 }} />
            Allow 10-second public preview
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.4 }}>
            <input type="checkbox" checked={rights} disabled={running} onChange={(e) => setRights(e.target.checked)} style={{ accentColor: "#e9b844", width: 18, height: 18, flexShrink: 0 }} />
            I own the rights or have permission to analyze these tracks.
          </label>
        </section>

        {missing > 0 && <div style={{ fontSize: 13, color: C.danger }}>Add the missing title / artist ({missing}).</div>}
        {!running && todo === 0 && done > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ textAlign: "center", fontSize: 14, color: C.rel, fontWeight: 600 }}>All done ✓ ({done})</div>
            <button type="button" onClick={() => router.push("/home")} style={ui.cta}>Go Scan</button>
            <button type="button" onClick={() => router.push("/promo")} style={{ ...ui.pill, width: "100%", padding: "13px 16px", fontSize: 15, color: C.gold, borderColor: "rgba(245,207,104,0.30)", background: "rgba(245,207,104,0.08)" }}>
              Send it to the BANGER team
            </button>
            <button type="button" onClick={() => window.location.reload()} style={{ ...ui.pill, width: "100%", padding: "13px 16px", fontSize: 15 }}>
              Upload more
            </button>
          </div>
        ) : <button onClick={runAll} disabled={!can}
          style={can ? ui.cta : { ...ui.cta, background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.45)", boxShadow: "none", cursor: "not-allowed" }}>
          {running ? `Uploading… ${done}/${items.length}` : todo === 0 ? `All done ✓ (${done})` : `Upload ${todo} track${todo > 1 ? "s" : ""}`}
        </button>}
      </>)}
    </div>
  );
}
