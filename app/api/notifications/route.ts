import { adminClient, userFromRequest, notifyOnce, WELCOME_TITLE, WELCOME_MESSAGE } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → unread notifications of the logged-in user
export async function GET(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, notifications: [] }, { status: 401 });

  // Every account gets its welcome notification once, whatever path it signed up through
  const welcomeError = await notifyOnce(sb, user.id, "welcome", WELCOME_MESSAGE, WELCOME_TITLE)
    .catch((e: any) => `welcome: ${e?.message || e}`);

  // Recent history (read + unread) so the bell is never empty after opening it once
  let { data, error } = await sb.from("notifications")
    .select("id,type,message,track_title,title,body,actor_id,count,created_at,read")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(100);

  if (error && /column/i.test(error.message)) {
    ({ data, error } = await sb.from("notifications")
      .select("id,type,message,track_title,created_at,read")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(30) as any);
  }
  if (error) return Response.json({ ok: false, error: error.message, notifications: [] }, { status: 500 });

  // Older rows used title/body instead of track_title/message
  const raw = ((data || []) as any[]).map((n) => ({
    ...n,
    track_title: n.track_title || n.title || null,
    message: n.message || n.body || null,
  }))
  // Old empty rows (no text, no sender) are noise — hide them
  .filter((n) => n.message || n.track_title || n.actor_id);

  // One line per person: all messages (or follows) from the same sender are added up
  const groups = new Map<string, any>();
  const rows: any[] = [];
  for (const n of raw) {
    const groupable = n.type === "message" || n.type === "follow";
    const who = n.actor_id || n.track_title;
    if (!groupable || !who) { rows.push(n); continue; }
    const key = `${n.type}:${who}`;
    const g = groups.get(key);
    if (!g) {
      const first = { ...n, count: n.count || 1, ids: [n.id] };
      groups.set(key, first); rows.push(first);
    } else {
      g.count += n.count || 1;
      g.ids.push(n.id);
      if (!n.read) g.read = false;
    }
  }
  for (const g of groups.values()) {
    if (g.type === "message") g.message = g.count > 1 ? `${g.count} messages` : (g.message && !/notification/i.test(g.message) ? g.message : "Sent you a message");
    if (g.type === "follow") g.message = "Started following you";
  }
  rows.splice(30);
  const actorIds = [...new Set(rows.map((n) => n.actor_id).filter(Boolean))];
  if (actorIds.length) {
    const { data: actors } = await sb.from("profiles").select("id,avatar_url,display_name").in("id", actorIds);
    const byId = new Map((actors || []).map((a: any) => [a.id, a]));
    rows.forEach((n) => {
      const a: any = n.actor_id ? byId.get(n.actor_id) : null;
      n.actor_avatar = a?.avatar_url || null;
      // Show the person's name on grouped message/follow lines
      if (a?.display_name && (n.type === "message" || n.type === "follow")) n.track_title = a.display_name;
    });
  }
  const unread = rows.filter((n) => !n.read).length;

  // `diag` is shown discreetly in the bell panel when something is wrong in the database
  return Response.json({ ok: true, notifications: rows, unread, diag: welcomeError || null });
}

// POST { action: "read", id? }  → mark one (or all) as read
// POST { action: "welcome" }    → one-time welcome notification
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "welcome") {
    await notifyOnce(sb, user.id, "welcome", WELCOME_MESSAGE, WELCOME_TITLE);
    return Response.json({ ok: true });
  }

  // Swipe-to-delete: removes the line (and every row grouped into it)
  if (body.action === "delete") {
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).filter((x: any) => x !== undefined && x !== null).slice(0, 200);
    if (!ids.length) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });
    const { error } = await sb.from("notifications").delete().eq("user_id", user.id).in("id", ids);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body.action === "read") {
    let q = sb.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    if (body.id) q = q.eq("id", body.id);
    const { error } = await q;
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
