import { createSupabaseBrowser } from "@/lib/supabase/client";

export type BangerRole = "public" | "pro";

export async function getBrowserRole(): Promise<BangerRole> {
  try {
    const supabase = createSupabaseBrowser();
    if (!supabase) return "public";
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return "public";
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", authData.user.id).single();
    if (profileError) return "public";
    const r = profile?.role;
    if (r === "dj" || r === "label" || r === "pro") return "pro";
    return "public";
  } catch { return "public"; }
}
