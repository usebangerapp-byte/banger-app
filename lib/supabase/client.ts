import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One shared browser client for the whole app.
// (Creating a new client on every call started extra auth listeners and token-refresh timers each time.)
let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowser() {
  if (typeof window === "undefined") return null;
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  // Stay signed in until the user taps "Sign out": session kept in storage and refreshed automatically.
  browserClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}
