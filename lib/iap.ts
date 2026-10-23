"use client";

import { isNativeApp, hasPlugin, plugin } from "@/lib/native";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { clearRoleCache } from "@/lib/auth/getBrowserRole";

/**
 * Pro in the iPhone app = Apple In-App Purchase, through RevenueCat (plugin "Purchases").
 * The website keeps Stripe. After a purchase / restore, /api/iap/sync asks RevenueCat and
 * turns the account Pro on the server (the RevenueCat webhook does the same for renewals and cancellations).
 *
 * Set in Vercel: NEXT_PUBLIC_REVENUECAT_IOS_KEY (RevenueCat public iOS SDK key, starts with "appl_").
 */
const KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY || "";

export type IapPlan = { kind: "monthly" | "yearly"; price: string; pkg: any };

/** In the app: true = buy with Apple. (In the app WITHOUT the plugin, nothing is sold: no Stripe link in the app.) */
export function iapAvailable() { return isNativeApp() && hasPlugin("Purchases") && !!KEY; }

let configured: Promise<any> | null = null;
async function rc() {
  const P = await plugin("Purchases");
  if (!P) throw new Error("In-app purchase is not available");
  if (!configured) configured = (async () => {
    const sb = createSupabaseBrowser();
    const uid = (await sb?.auth.getSession())?.data?.session?.user?.id;
    if (!uid) throw new Error("Sign in first");
    // the RevenueCat customer = the BANGER account, so the server can check it
    await P.configure({ apiKey: KEY, appUserID: uid });
  })().catch((e) => { configured = null; throw e; });
  await configured;
  return P;
}

/** The two plans with Apple's own price strings (local currency). */
export async function iapPlans(): Promise<IapPlan[]> {
  const P = await rc();
  const o = await P.getOfferings();
  const cur = o?.current || o?.offerings?.current;
  const pkgs: any[] = cur?.availablePackages || [];
  const out: IapPlan[] = [];
  const m = cur?.monthly || pkgs.find((p) => p.packageType === "MONTHLY");
  const y = cur?.annual || pkgs.find((p) => p.packageType === "ANNUAL");
  if (m) out.push({ kind: "monthly", price: m.product?.priceString || "", pkg: m });
  if (y) out.push({ kind: "yearly", price: y.product?.priceString || "", pkg: y });
  return out;
}

async function sync() {
  const sb = createSupabaseBrowser();
  const token = (await sb?.auth.getSession())?.data?.session?.access_token;
  const r = await fetch("/api/iap/sync", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
  const j = await r?.json().catch(() => null);
  clearRoleCache();
  return !!j?.pro;
}

/** Apple purchase sheet → true when the account is Pro. Cancelled by the user → false (no error). */
export async function iapBuy(plan: IapPlan): Promise<boolean> {
  const P = await rc();
  try { await P.purchasePackage({ aPackage: plan.pkg }); }
  catch (e: any) { if (e?.userCancelled || /cancel/i.test(String(e?.message || e?.code || ""))) return false; throw e; }
  return sync();
}

/** "Restore purchases" (required by Apple). */
export async function iapRestore(): Promise<boolean> {
  const P = await rc();
  await P.restorePurchases();
  return sync();
}
