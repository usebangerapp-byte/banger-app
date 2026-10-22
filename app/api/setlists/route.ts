import { adminClient } from "@/lib/server/notify";
import { adminFromRequest } from "@/lib/server/admin";
import { parseTracklist, youtubeId } from "@/lib/setlists";
import { titleKey } from "@/lib/titleKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET            → all sets with progress (known / total, IDs left, people asking)
// GET ?track=T   → sets where track T was played ("Played in"), with the minute
export async function GET(req: Request) {
  const sb = adminClient();
  const track = new URL(req.url).searchParams.get("track");

  if (track) {
    const k = titleKey(track);
    const { data: rows } = await sb.from("setlist_tracks").select("setlist_id,start_sec,title").not("title", "is", null).ilike("title", `%${track.replace(/\(.*?\)/g, "").trim().replace(/[\\%_]/g, (m) => "\\" + m)}%`).limit(50);
    const hits = (rows || []).filter((r: any) => titleKey(r.title) === k);
    const ids = [...new Set(hits.map((h: any) => h.setlist_id))];
    if (!ids.length) return Response.json({ ok: true, sets: [] });
    const { data: sets } = await sb.from("setlists").select("id,title,venue,source_url,cover_url").in("id", ids);
    return Response.json({ ok: true, sets: hits.map((h: any) => ({ ...(sets || []).find((s: any) => s.id === h.setlist_id), at: h.start_sec })).filter((x: any) => x.id) });
  }

  const { data: sets, error } = await sb.from("setlists").select("id,title,venue,played_on,source_url,cover_url,unlocked_at,created_at")
    .eq("published", true).order("created_at", { ascending: false }).limit(100);
  if (error) return Response.json({ ok: false, error: /relation|does not exist/i.test(error.message) ? "Run the Sets SQL first" : error.message, sets: [] }, { status: 500 });
  const ids = (sets || []).map((s: any) => s.id);
  const { data: tracks } = ids.length ? await sb.from("setlist_tracks").select("id,setlist_id,title").in("setlist_id", ids) : { data: [] as any[] };
  const { data: asks } = ids.length ? await sb.from("setlist_reactions").select("setlist_id").eq("kind", "ask").in("setlist_id", ids) : { data: [] as any[] };
  return Response.json({
    ok: true,
    sets: (sets || []).map((s: any) => {
      const t = (tracks || []).filter((x: any) => x.setlist_id === s.id);
      return { ...s, total: t.length, known: t.filter((x: any) => x.title).length, asks: (asks || []).filter((a: any) => a.setlist_id === s.id).length };
    }),
  });
}

// POST (admins) { source_url, title, venue?, played_on?, tracklist } → creates a set
export async function POST(req: Request) {
  const { sb, user } = await adminFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const source_url = String(b.source_url || "").trim();
  const title = String(b.title || "").trim().slice(0, 140);
  if (!source_url || !title) return Response.json({ ok: false, error: "Link and title are required" }, { status: 400 });
  const yt = youtubeId(source_url);
  const { data: set, error } = await sb.from("setlists").insert([{
    title, venue: String(b.venue || "").trim().slice(0, 120) || null, played_on: b.played_on || null,
    source_url, cover_url: yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null, created_by: user.id,
  }]).select("id").single();
  if (error || !set) return Response.json({ ok: false, error: error?.message || "Insert failed" }, { status: 500 });
  const rows = parseTracklist(String(b.tracklist || "")).map((r, i) => ({ ...r, setlist_id: set.id, position: i + 1 }));
  if (rows.length) {
    const { error: e2 } = await sb.from("setlist_tracks").insert(rows);
    if (e2) return Response.json({ ok: false, error: e2.message }, { status: 500 });
  }
  return Response.json({ ok: true, id: set.id });
}
