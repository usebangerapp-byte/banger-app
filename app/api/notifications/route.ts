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

  let { data, error } = await sb.from("notifications")
    .select("id,type,message,track_title,actor_id,count,created_at,read")
    .eq("user_id", user.id).eq("read", false)
    .order("created_at", { ascending: false }).limit(30);

  if (error && /column/i.test(error.message)) {
    ({ data, error } = await sb.from("notifications")
      .select("id,type,message,track_title,created_at,read")
      .eq("user_id", user.id).eq("read", false)
      .order("created_at", { ascending: false }).limit(30) as any);
  }
  if (error) return Response.json({ ok: false, error: error.message, notifications: [] }, { status: 500 });
  // `diag` is shown discreetly in the bell panel when something is wrong in the database
  return Response.json({ ok: true, notifications: data || [], diag: welcomeError || null });
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

  if (body.action === "read") {
    let q = sb.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    if (body.id) q = q.eq("id", body.id);
    const { error } = await q;
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
