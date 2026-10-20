"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { isNativeApp, onAppUrlOpen, closeNativeBrowser, registerPush, APP_SCHEME } from "@/lib/native";

/**
 * Glue between the iOS shell and the web app. Renders nothing and does nothing on the website.
 * - com.usebanger.app://auth/callback… → finishes Google/Apple login
 * - com.usebanger.app://scan            → opens SCAN and starts listening
 * - "banger:scan" event (Siri / Shortcuts, sent by AppDelegate) → same
 * - registers for push notifications once the user is logged in
 */
export default function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  // Deep links
  useEffect(() => {
    if (!isNativeApp()) return;
    return onAppUrlOpen(async (url) => {
      if (!url.startsWith(`${APP_SCHEME}://`)) return;
      const u = new URL(url.replace(`${APP_SCHEME}://`, "https://app.local/"));

      if (u.pathname.startsWith("/auth/callback")) {
        await closeNativeBrowser();
        const sb = createSupabaseBrowser();
        if (!sb) return;
        try {
          const code = u.searchParams.get("code");
          const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
          if (code) await sb.auth.exchangeCodeForSession(code);
          else if (hash.get("access_token") && hash.get("refresh_token")) {
            await sb.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
          }
        } catch { /* fall through: the callback page shows the error state */ }
        router.replace("/auth/callback");
        return;
      }

      if (u.pathname.startsWith("/scan")) { router.push("/home?scan=1"); return; }
      if (u.pathname !== "/") router.push(u.pathname + u.search);
    });
  }, [router]);

  // Siri / Shortcuts "Scan with BANGER" when the user is not on the SCAN page
  useEffect(() => {
    if (pathname === "/home") return;
    const go = () => router.push("/home?scan=1");
    window.addEventListener("banger:scan", go);
    return () => window.removeEventListener("banger:scan", go);
  }, [pathname, router]);

  // Push notifications (asks permission once the user is logged in)
  useEffect(() => {
    if (!isNativeApp()) return;
    const sb = createSupabaseBrowser();
    if (!sb) return;
    const getToken = async () => (await sb.auth.getSession()).data?.session?.access_token || null;
    getToken().then((t) => { if (t) registerPush(getToken); });
    const { data } = sb.auth.onAuthStateChange((evt) => {
      if (evt === "SIGNED_IN") registerPush(getToken);
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  return null;
}
