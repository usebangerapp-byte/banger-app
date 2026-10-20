import { adminClient, userFromRequest } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Saves the device token sent by the iOS app (see lib/native.ts → registerPush)
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { token, platform } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") return Response.json({ ok: false, error: "Missing token" }, { status: 400 });

  const { error } = await sb.from("push_tokens").upsert(
    { token, user_id: user.id, platform: platform || "ios", updated_at: new Date().toISOString() },
    { onConflict: "token" }
  );
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
