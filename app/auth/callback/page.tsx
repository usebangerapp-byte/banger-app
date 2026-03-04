"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [msg, setMsg] = useState("Finishing login…");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          // supabase-js v2
          // @ts-ignore
          await supabase.auth.exchangeCodeForSession(code);
        }
        if (!alive) return;
        router.replace("/");
      } catch {
        if (!alive) return;
        setMsg("Login failed. Back to home…");
        window.setTimeout(() => router.replace("/"), 900);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router, supabase]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b0c",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        letterSpacing: "0.14em",
        fontWeight: 900,
        opacity: 0.85,
      }}
    >
      {msg}
    </main>
  );
}
