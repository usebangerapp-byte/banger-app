"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isNativeApp, hasPlugin, openNativeAuth, NATIVE_AUTH_REDIRECT } from "@/lib/native";

/**
 * Starts Google / Apple login.
 * - Website: normal redirect to /auth/callback.
 * - iOS app: opens the provider in a secure Safari sheet (Google refuses in-app web views)
 *   and comes back through com.usebanger.app://auth/callback (handled by NativeBridge).
 */
export async function startOAuth(supabase: SupabaseClient, provider: "google" | "apple") {
  if (isNativeApp() && hasPlugin("Browser")) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (data?.url && (await openNativeAuth(data.url))) return;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "https://usebanger.com";
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) throw error;
}
