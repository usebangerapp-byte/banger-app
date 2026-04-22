import { createSupabaseBrowser } from "@/lib/supabase/client";

export type BangerRole = "public" | "dj" | "label";

export async function getBrowserRole(): Promise<BangerRole> {
  try {
    const supabase = createSupabaseBrowser();
    if (!supabase) return "public";

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return "public";

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError) return "public";

    if (profile?.role === "dj" || profile?.role === "label" || profile?.role === "public") {
      return profile.role;
    }

    return "public";
  } catch {
    return "public";
  }
}
