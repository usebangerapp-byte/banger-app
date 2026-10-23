import { adminClient, userFromRequest } from "@/lib/server/notify";
import { syncIap } from "@/lib/server/iap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST (signed in) → after an Apple purchase / restore in the app: is this account Pro now?
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Sign in" }, { status: 401 });
  const r = await syncIap(sb, user.id);
  return Response.json({ ok: !r.error, ...r });
}
