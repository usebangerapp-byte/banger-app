"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    const code = params.get("code");
    (async () => {
      try {
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } finally {
        router.replace("/");
      }
    })();
  }, [params, router, supabase]);

  return (
    <main style={S.page}>
      <div style={S.txt}>Connexion…</div>
    </main>
  );
}

const S: any = {
  page: {
    minHeight: "100vh",
    background: "#0b0b0c",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  txt: { opacity: 0.85, letterSpacing: "0.12em", fontWeight: 800 },
};
