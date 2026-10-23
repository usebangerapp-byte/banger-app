import { adminClient } from "@/lib/server/notify";
import { syncIap } from "@/lib/server/iap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RevenueCat webhook (renewals, cancellations, expirations, refunds).
 * In RevenueCat → Integrations → Webhooks: URL https://usebanger.com/api/iap/webhook and an
 * Authorization header value, the same as REVENUECAT_WEBHOOK_AUTH in Vercel.
 */
export async function POST(req: Request) {
  const auth = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!auth || req.headers.get("authorization") !== auth) return Response.json({ ok: false }, { status: 401 });
  const body: any = await req.json().catch(() => null);
  const ev = body?.event;
  const ids = [ev?.app_user_id, ev?.original_app_user_id, ...(ev?.aliases || [])].filter((x: any) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x));
  const sb = adminClient();
  for (const id of [...new Set(ids)]) await syncIap(sb, id as string).catch(() => {});
  return Response.json({ ok: true });
}
