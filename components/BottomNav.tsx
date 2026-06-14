"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBrowserRole, type BangerRole } from "@/lib/auth/getBrowserRole";

const HIDDEN = ["/","/login","/unlock","/onboarding","/auth/callback","/admin-access","/privacy","/terms","/contact"];

const PUBLIC_ITEMS = [
  { label: "Profile", href: "/profile" },
  { label: "Radar",   href: "/library" },
  { label: "SCAN",    href: "/home" },
  { label: "Charts",  href: "/concerts" },
  { label: "Events",  href: "/events" },
];

const PRO_ITEMS = [
  { label: "Profile", href: "/profile" },
  { label: "Radar",   href: "/library" },
  { label: "SCAN",    href: "/home" },
  { label: "Charts",  href: "/concerts" },
  { label: "Upload",  href: "/bpro" },
];

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const [role, setRole] = useState<BangerRole>("public");

  useEffect(() => {
    let mounted = true;
    (async () => { const r = await getBrowserRole(); if (mounted) setRole(r); })();
    return () => { mounted = false; };
  }, []);

  const items = useMemo(() => (role === "public" ? PUBLIC_ITEMS : PRO_ITEMS), [role]);
  const hidden = HIDDEN.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (hidden) return null;

  return (
    <>
      <div style={{ height: 96, background: "#000" }} />
      <nav aria-label="Primary" style={{
        position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 70,
        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(5,5,5,0.94)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        borderRadius: 24, boxShadow: "0 14px 40px rgba(0,0,0,0.45)", overflow: "hidden",
      }}>
        <div style={{
          maxWidth: 860, margin: "0 auto", display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)", gap: 6,
          padding: "10px 10px calc(10px + env(safe-area-inset-bottom))", background: "#050505",
        }}>
          {items.map((item) => {
            const isScan = item.href === "/home";
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} style={{
                textDecoration: "none",
                color: active ? "#fff" : "rgba(255,255,255,0.55)",
                textAlign: "center",
                fontSize: isScan ? 14 : 12,
                fontWeight: isScan ? 900 : active ? 800 : 600,
                letterSpacing: isScan ? "0.06em" : "0.02em",
                padding: "12px 4px", borderRadius: 16,
                background: active ? (isScan
                  ? "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))")
                  : "transparent",
                border: active ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
              }}>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
