"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function onboardingKey(email: string) {
  return `banger_onboarding_done:${email.toLowerCase()}`;
}

export default function AppGate() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase!.auth.getSession();
        const email = data.session?.user?.email?.toLowerCase();

        if (!mounted) return;

        if (!email) {
          router.replace("/login");
          return;
        }

        const r = await fetch(
          `/api/bpro/unlock-status?email=${encodeURIComponent(email)}`,
          { cache: "no-store" }
        );
        const j = await r.json().catch(() => null);

        if (!mounted) return;

        if (!j?.unlocked) {
          router.replace("/unlock");
          return;
        }

        if (
          typeof window !== "undefined" &&
          localStorage.getItem(onboardingKey(email)) !== "1"
        ) {
          router.replace("/onboarding");
          return;
        }
      } catch {
        if (!mounted) return;
        router.replace("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  return null;
}
