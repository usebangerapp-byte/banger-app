import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOnce, WELCOME_TITLE, WELCOME_MESSAGE } from "@/lib/server/notify";

/**
 * Apple In-App Purchase (via RevenueCat): asks RevenueCat whether this account has the "pro"
 * entitlement and turns the BANGER account Pro on / off.
 * Never turns off a Pro that comes from Stripe (website) or was given by hand.
 *
 * Vercel: REVENUECAT_SECRET_KEY (RevenueCat secret API key, "sk_…") · REVENUECAT_ENTITLEMENT (default "pro").
 */
export async function syncIap(sb: SupabaseClient, userId: string): Promise<{ pro: boolean; error?: string }> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return { pro: false, error: "REVENUECAT_SECRET_KEY missing" };
  const ent = process.env.REVENUECAT_ENTITLEMENT || "pro";
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, cache: "no-store",
  }).catch(() => null);
  if (!r?.ok) return { pro: false, error: `RevenueCat ${r?.status || "unreachable"}` };
  const j: any = await r.json().catch(() => null);
  const e = j?.subscriber?.entitlements?.[ent];
  const active = !!e && (!e.expires_date || new Date(e.expires_date).getTime() > Date.now()
    || (e.grace_period_expires_date && new Date(e.grace_period_expires_date).getTime() > Date.now()));

  const { data: p } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  const stripeActive = ["active", "trialing"].includes(String(p?.stripe_status || ""));
  if (active) {
    const upd: any = { role: "pro", pro_since: p?.pro_since || new Date().toISOString(), plan_selected_at: new Date().toISOString(), iap_active: true };
    let { error } = await sb.from("profiles").update(upd).eq("id", userId);
    if (error) { delete upd.iap_active; await sb.from("profiles").update(upd).eq("id", userId); }
    if (p?.role !== "pro") {
      await notifyOnce(sb, userId, "welcome", WELCOME_MESSAGE, WELCOME_TITLE).catch(() => {});
      await notifyOnce(sb, userId, "pro_welcome", "Upload your IDs, unlock the full unreleased chart and see how your tracks move.", "You're now BANGER PRO ✦").catch(() => {});
    }
  } else if (p?.iap_active === true && !stripeActive) {
    // the Apple subscription ended, and there is no website subscription
    await sb.from("profiles").update({ role: "public", pro_since: null, iap_active: false }).eq("id", userId);
  }
  const wasPro = ["pro", "dj", "label"].includes(String(p?.role || ""));
  const endedNow = !active && p?.iap_active === true && !stripeActive;
  return { pro: active || (wasPro && !endedNow) };
}
