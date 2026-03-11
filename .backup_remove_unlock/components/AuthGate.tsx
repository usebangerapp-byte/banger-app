"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthGate(props: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!data.session) {
          router.replace("/login");
          return;
        }
        setOk(true);
      } catch {
        if (!mounted) return;
        router.replace("/login");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  if (!ok) {
    return (
      <main style={S.page}>
        <div style={S.txt}>Loading…</div>
      </main>
    );
  }

  return <>{props.children}</>;
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
  txt: { opacity: 0.8, letterSpacing: "0.12em", fontWeight: 800 },
};
