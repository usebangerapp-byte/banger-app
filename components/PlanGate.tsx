"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

// Pages where we never force the plan choice
const SKIP = ["/", "/login", "/unlock", "/onboarding", "/auth/callback", "/admin-access",
  "/privacy", "/terms", "/contact", "/upgrade"];

/**
 * Sends logged-in users who have never picked a plan (FREE or PRO)
 * to /onboarding. Fails open: if anything errors, the user is left alone.
 */
export default function PlanGate() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  useEffect(() => {
    if (SKIP.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;
    // Coming back from Stripe: the webhook may not have landed yet
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pro") === "success") return;

    let alive = true;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        if (!sb) return;
        const { data: auth } = await sb.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;
        const { data, error } = await sb
          .from("profiles").select("plan_selected_at").eq("id", uid).maybeSingle();
        if (!alive || error) return;
        if (!data?.plan_selected_at) router.replace("/onboarding");
      } catch {
        /* fail open */
      }
    })();
    return () => { alive = false; };
  }, [pathname, router]);

  return null;
}
