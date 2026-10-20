import { createSupabaseBrowser } from "@/lib/supabase/client";

export type BangerRole = "public" | "pro";

// Cached for 60s and shared by every component (nav, top bar, charts, profile…),
// cleared as soon as the user signs in / out. Uses the local session (no network round-trip).
let cache: { at: number; promise: Promise<BangerRole> } | null = null;
let listening = false;

export function clearRoleCache() { cache = null; }

async function fetchRole(): Promise<BangerRole> {
  try {
    const supabase = createSupabaseBrowser();
    if (!supabase) return "public";
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return "public";
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError) return "public";
    const r = profile?.role;
    if (r === "dj" || r === "label" || r === "pro") return "pro";
    return "public";
  } catch { return "public"; }
}

export async function getBrowserRole(): Promise<BangerRole> {
  const supabase = createSupabaseBrowser();
  if (supabase && !listening) {
    listening = true;
    supabase.auth.onAuthStateChange((evt) => {
      if (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "USER_UPDATED") clearRoleCache();
    });
  }
  if (cache && Date.now() - cache.at < 60_000) return cache.promise;
  const promise = fetchRole();
  cache = { at: Date.now(), promise };
  return promise;
}
