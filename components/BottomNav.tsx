"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserRole, type BangerRole } from "@/lib/auth/getBrowserRole";

const HIDDEN = ["/","/login","/unlock","/onboarding","/auth/callback","/admin-access","/privacy","/terms","/contact"];

type Item = { label: string; href: string; icon: ReactNode };

const I = {
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12l7-7" /></>,
  scan: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></>,
  charts: <path d="M5 20V10M12 20V4M19 20v-7" />,
  sets: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 13h7M7 17h4" /></>,
  pro: <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z" />,
  upload: <path d="M12 19V5M6 11l6-6 6 6" />,
};

const PUBLIC_ITEMS: Item[] = [
  { label: "Profile", href: "/profile", icon: I.profile },
  { label: "Radar",   href: "/radar",   icon: I.radar },
  { label: "Scan",    href: "/home",    icon: I.scan },
  { label: "Sets",    href: "/sets",    icon: I.sets },
  { label: "Pro",     href: "/upgrade", icon: I.pro },
];

const PRO_ITEMS: Item[] = [
  { label: "Profile", href: "/profile", icon: I.profile },
  { label: "Radar",   href: "/radar",   icon: I.radar },
  { label: "Scan",    href: "/home",    icon: I.scan },
  { label: "Sets",    href: "/sets",    icon: I.sets },
  { label: "Upload",  href: "/bpro",    icon: I.upload },
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
      <div style={{ height: 104 }} />
      <nav aria-label="Primary" style={{
        position: "fixed", left: 14, right: 14, bottom: "calc(14px + env(safe-area-inset-bottom))", zIndex: 70,
        maxWidth: 520, margin: "0 auto", height: 66, borderRadius: 33,
        background: "rgba(28,28,28,0.55)", border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(30px) saturate(180%)", WebkitBackdropFilter: "blur(30px) saturate(180%)",
        boxShadow: "0 12px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)", alignItems: "center", padding: "0 4px",
      }}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} style={{
              textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              color: active ? "#f5cf68" : "rgba(255,255,255,0.55)",
              fontSize: 10, fontWeight: active ? 600 : 500, padding: "8px 0",
            }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                style={active ? { filter: "drop-shadow(0 0 6px rgba(245,207,104,0.8))" } : undefined}>
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
