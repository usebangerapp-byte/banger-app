import { adminClient, userFromRequest } from "@/lib/server/notify";
import { isPro } from "@/lib/server/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → my sets with their tracklists (newest first)
export async function GET(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, sets: [] }, { status: 401 });
  const { data: sets, error } = await sb.from("dj_sets").select("id,name,started_at,ended_at")
    .eq("user_id", user.id).order("started_at", { ascending: false }).limit(20);
  if (error) return Response.json({ ok: false, error: error.message, sets: [] }, { status: 500 });
  const ids = (sets || []).map((s) => s.id);
  const { data: tracks } = ids.length
    ? await sb.from("dj_set_tracks").select("set_id,position,title,artist,result_type,detected_at").in("set_id", ids).order("position")
    : { data: [] as any[] };
  return Response.json({
    ok: true,
    sets: (sets || []).map((s) => ({ ...s, tracks: (tracks || []).filter((t) => t.set_id === s.id) })),
  });
}

// POST { action: "start" | "track" | "end" | "delete", ... }
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === "start") {
    if (!(await isPro(sb, user.id))) return Response.json({ ok: false, error: "Pro only" }, { status: 403 });
    const name = String(b.name || "").trim().slice(0, 80) || null;
    const { data, error } = await sb.from("dj_sets").insert([{ user_id: user.id, name }]).select("id,started_at").single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, id: data.id, started_at: data.started_at });
  }

  // every other action works on one of my sets
  const setId = String(b.set_id || "");
  const { data: set } = await sb.from("dj_sets").select("id,user_id").eq("id", setId).maybeSingle();
  if (!set || set.user_id !== user.id) return Response.json({ ok: false, error: "Set not found" }, { status: 404 });

  if (b.action === "track") {
    const title = String(b.title || "").trim().slice(0, 200);
    if (!title) return Response.json({ ok: false, error: "Missing title" }, { status: 400 });
    const artist = String(b.artist || "").trim().slice(0, 200) || null;
    const result_type = String(b.result_type || "recognized_world");
    await sb.from("dj_set_tracks").insert([{ set_id: setId, position: Number(b.position) || 1, title, artist, result_type }]);
    // count it once in the charts, like a normal scan
    await sb.from("scan_events").insert([{
      track_title: title, track_subtitle: artist, result_type, user_id: user.id, region: b.region || null,
    }]).then(() => {}, () => {});
    return Response.json({ ok: true });
  }

  if (b.action === "end") {
    await sb.from("dj_sets").update({ ended_at: new Date().toISOString() }).eq("id", setId);
    return Response.json({ ok: true });
  }

  if (b.action === "delete") {
    await sb.from("dj_sets").delete().eq("id", setId);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
