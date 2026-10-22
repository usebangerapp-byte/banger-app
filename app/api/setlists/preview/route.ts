import { adminFromRequest } from "@/lib/server/admin";
import { youtubeId, parseTracklist } from "@/lib/setlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Rafael B2B Brunello @ Santa Monica | Live DJ Set" → DJs + venue (best guess, editable). */
function splitTitle(raw: string) {
  const t = raw.replace(/\s*[\[(](?:full|live|dj)?\s*(?:set|mix|video|hd|4k|official)[^\])]*[\])]\s*/gi, " ").replace(/\s+/g, " ").trim();
  const m = t.match(/^(.+?)\s+(?:@|at|live at|live from|from)\s+(.+?)(?:\s*[|•–—-]\s*.*)?$/i);
  if (m) return { title: m[1].trim(), venue: m[2].replace(/\s*\d{4}\s*$/, "").trim() };
  const parts = t.split(/\s*[|•–—]\s*|\s+-\s+/).filter(Boolean);
  return { title: (parts[0] || t).trim(), venue: (parts[1] || "").trim() };
}

/** Only lines that start with a time go into the tracklist ("00:00 Artist - Title", "1:02:30 ID"). */
function tracklistFrom(desc: string) {
  const lines = desc.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^(?:\d{1,3}[.)]\s*)?[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?\s/.test(l));
  return lines.length >= 3 ? lines.join("\n") : "";
}

async function json(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

// GET ?url= (admins) → { title, venue, played_on, tracklist, source, note }
export async function GET(req: Request) {
  const { user } = await adminFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Admins only" }, { status: 403 });
  const url = String(new URL(req.url).searchParams.get("url") || "").trim();
  if (!url) return Response.json({ ok: false, error: "Missing link" }, { status: 400 });

  const out: any = { ok: true, title: "", venue: "", played_on: "", tracklist: "", source: "", note: "" };
  const yt = youtubeId(url);
  try {
    if (yt) {
      out.source = "YouTube";
      const key = process.env.YOUTUBE_API_KEY;
      if (key) {
        const j = await json(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${yt}&key=${key}`);
        const sn = j?.items?.[0]?.snippet;
        if (sn) {
          Object.assign(out, splitTitle(sn.title || ""));
          out.played_on = String(sn.publishedAt || "").slice(0, 10);
          // The tracklist: the description, or the best comment (DJs and fans often post it there)
          const fromDesc = tracklistFrom(sn.description || "");
          let best = fromDesc, bestSrc = fromDesc ? "the description" : "";
          const c = await json(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${yt}&order=relevance&maxResults=100&textFormat=plainText&key=${key}`);
          for (const it of c?.items || []) {
            const txt = it?.snippet?.topLevelComment?.snippet?.textOriginal || it?.snippet?.topLevelComment?.snippet?.textDisplay || "";
            const tl = tracklistFrom(txt);
            if (tl.split("\n").length > best.split("\n").filter(Boolean).length) { best = tl; bestSrc = "a comment"; }
          }
          out.tracklist = best;
          out.note = best ? `Tracklist found in ${bestSrc} — check it.` : "No tracklist in the description or comments — paste one, or scan the set.";
        }
      } else {
        const o = await json(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}&format=json`);
        if (o?.title) Object.assign(out, splitTitle(o.title));
        out.note = "Title filled. Add the YouTube key to also get the date and the tracklist automatically.";
      }
    } else if (/soundcloud\.com/i.test(url)) {
      out.source = "SoundCloud";
      const o = await json(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      if (o?.title) Object.assign(out, splitTitle(String(o.title).replace(/\s+by\s+[^]+$/i, "")));
      out.note = "SoundCloud doesn't share tracklists — add it, or use Set mode.";
    } else if (/mixcloud\.com/i.test(url)) {
      out.source = "Mixcloud";
      const path = new URL(url).pathname.replace(/\/+$/, "");
      const j = await json(`https://api.mixcloud.com${path}/`);
      if (j?.name) Object.assign(out, splitTitle(j.name));
      if (j?.created_time) out.played_on = String(j.created_time).slice(0, 10);
      if (j?.description) out.tracklist = tracklistFrom(j.description);
    } else {
      return Response.json({ ok: false, error: "Paste a YouTube, SoundCloud or Mixcloud link" }, { status: 400 });
    }
  } catch {
    out.note = "Couldn't read the link — fill in the details by hand.";
  }
  out.count = parseTracklist(out.tracklist).length;
  return Response.json(out);
}
