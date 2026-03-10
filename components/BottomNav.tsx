"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = [
  "/login",
  "/unlock",
  "/admin-access",
  "/auth/callback",
];

const ITEMS = [
  { label: "Profile", href: "/profile" },
  { label: "Charts", href: "/concerts" },
  { label: "Scan", href: "/" },
  { label: "Radar", href: "/library" },
  { label: "BPRO", href: "/bpro" },
];

export default function BottomNav() {
  const pathname = usePathname() || "/";

  const hidden = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (hidden) return null;

  return (
    <>
      <div
        style={{
          height: 98,
          background: "#000",
        }}
      />
      <nav
        aria-label="Primary"
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 60,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(8,8,8,0.94)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderRadius: 22,
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            alignItems: "center",
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
                  color: active ? "#fff" : "rgba(255,255,255,0.68)",
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
                  boxShadow: active
                    ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                    : "none",
                  letterSpacing: "0.01em",
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
