import type { SupabaseClient } from "@supabase/supabase-js";

/** True when the user has a Pro plan (same rule as the app: pro / dj / label). */
export async function isPro(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  return ["pro", "dj", "label"].includes(String(data?.role || ""));
}

export const PROMO_BUCKET = "promos";

/** Creates the private bucket for promo tracks the first time it's needed. */
export async function ensurePromoBucket(sb: SupabaseClient) {
  const { data } = await sb.storage.getBucket(PROMO_BUCKET);
  if (!data) await sb.storage.createBucket(PROMO_BUCKET, { public: false, fileSizeLimit: "50MB" }).catch(() => {});
}
