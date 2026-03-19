"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Finishing login…");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        if (typeof window === "undefined") return;

        const supabase = createSupabaseBrowser();
        if (!supabase) {
          if (!alive) return;
          setMsg("Missing Supabase config. Redirecting…");
          window.setTimeout(() => {
            if (alive) router.replace("/login");
          }, 900);
          return;
        }

        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!alive) return;

        if (data.session) {
          setMsg("Login successful. Redirecting…");
          router.replace("/onboarding");
        } else {
          setMsg("No active session. Redirecting…");
          router.replace("/login");
        }
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setMsg("Login failed. Redirecting…");
        window.setTimeout(() => {
          if (alive) router.replace("/login");
        }, 900);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ opacity: 0.9, fontSize: 14, letterSpacing: "0.04em" }}>
        {msg}
      </div>
    </div>
  );
}
