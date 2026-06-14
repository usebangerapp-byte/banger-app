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
          setMsg("Missing config. Redirecting…");
          window.setTimeout(() => { if (alive) router.replace("/"); }, 900);
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
        if (!data.session) { router.replace("/"); return; }

        const userId = data.session.user.id;
        const { data: profile } = await supabase
          .from("profiles").select("id,role").eq("id", userId).maybeSingle();
        if (!alive) return;

        if (profile?.role) {
          setMsg("Welcome back. Redirecting…");
          router.replace("/home");
        } else {
          setMsg("Welcome! Setting up your profile…");
          router.replace("/onboarding");
        }
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setMsg("Login failed. Redirecting…");
        window.setTimeout(() => { if (alive) router.replace("/"); }, 900);
      }
    }
    run();
    return () => { alive = false; };
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, textAlign: "center" }}>
      <div style={{ opacity: 0.9, fontSize: 14, letterSpacing: "0.04em" }}>{msg}</div>
    </div>
  );
}
