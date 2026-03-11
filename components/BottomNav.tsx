"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN = ["/login", "/unlock", "/onboarding", "/auth/callback"];

const ITEMS = [
  { label: "Profile", href: "/profile" },
  { label: "Radar", href: "/library" },
  { label: "Scan", href: "/" },
  { label: "Charts", href: "/concerts" },
  { label: "BPRO", href: "/bpro" },
];

export default function BottomNav() {
  const pathname = usePathname() || "/";

  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  return (
    <>
      <div style={{ height: 96, background: "#000" }} />
      <nav
        aria-label="Primary"
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 70,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(5,5,5,0.94)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderRadius: 24,
          boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 6,
            padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
            background: "#050505",
          }}
        >
          {ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: active ? "#fff" : "rgba(255,255,255,0.72)",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  padding: "12px 6px",
                  borderRadius: 16,
                  background: active
                    ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
