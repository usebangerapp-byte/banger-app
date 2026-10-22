import { adminFromRequest } from "@/lib/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin review queue: every ID (in every set) that has at least one proposed name —
 * from the set scan and/or from users — with what is known about each name.
 */
export async function GET(req: Request) {
  const { sb, user } = await adminFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Admins only" }, { status: 403 });
  try {
    const { data: sug, error } = await sb.from("setlist_suggestions").select("*").eq("status", "open").not("track_id", "is", null).limit(5000);
    if (error) throw error;
    const trackIds = [...new Set((sug || []).map((s: any) => s.track_id))];
    if (!trackIds.length) return Response.json({ ok: true, items: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data: tracks } = await sb.from("setlist_tracks").select("id,setlist_id,position,start_sec,title").in("id", trackIds);
    const ids = (tracks || []).filter((t: any) => !t.title);   // still an ID
    const setIds = [...new Set(ids.map((t: any) => t.setlist_id))];
    const { data: sets } = setIds.length ? await sb.from("setlists").select("id,title,venue,cover_url,source_url").in("id", setIds) : { data: [] };
    const { data: asks } = await sb.from("setlist_reactions").select("track_id").eq("kind", "ask").in("track_id", ids.map((t: any) => t.id));
    const keys = [...new Set((sug || []).map((s: any) => s.key))];
    const { data: up } = keys.length ? await sb.from("bpro_tracks").select("dup_key").in("dup_key", keys) : { data: [] };
    const onBanger = new Set((up || []).map((u: any) => u.dup_key));
    const setMap = new Map((sets || []).map((s: any) => [s.id, s]));
    const people = new Set<string>();
    for (const s of sug || []) if (s.source !== "scan") people.add(s.user_id);
    const { data: prof } = people.size ? await sb.from("profiles").select("id,display_name").in("id", [...people]) : { data: [] };
    const names = new Map((prof || []).map((p: any) => [p.id, p.display_name]));

    const items = ids.map((t: any) => {
      const groups = new Map<string, any>();
      for (const s of (sug || []).filter((x: any) => x.track_id === t.id)) {
        const g = groups.get(s.key) || { key: s.key, title: s.title, artist: s.artist, users: 0, weight: 0, scan: 0, verified: false, on_banger: onBanger.has(s.key), by: [] as string[] };
        g.verified = g.verified || !!s.verified;
        if (s.source === "scan") g.scan = Math.max(g.scan, Number(s.heard || 1));
        else { g.users++; g.weight += Number(s.weight ?? 1); const n = names.get(s.user_id); if (n) g.by.push(n); }
        groups.set(s.key, g);
      }
      const list = [...groups.values()].map((g) => ({ ...g, match: g.scan > 0 && g.users > 0 }))
        .sort((a, b) => Number(b.match) - Number(a.match) || (b.scan + b.weight) - (a.scan + a.weight));
      return {
        track_id: t.id, set: setMap.get(t.setlist_id) || { id: t.setlist_id }, position: t.position, start_sec: t.start_sec,
        asks: (asks || []).filter((a: any) => a.track_id === t.id).length,
        proposals: list,
        conflict: list.length > 1,
      };
    }).sort((a: any, b: any) => Number(b.proposals[0]?.match) - Number(a.proposals[0]?.match) || b.asks - a.asks);
    return Response.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return Response.json({ ok: false, error: /column|relation|does not exist/i.test(e?.message || "") ? "Run the new Sets SQL (review queue) first" : (e?.message || "Error") }, { status: 500 });
  }
}
