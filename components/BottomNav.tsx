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

  const hidden = HIDDEN_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (hidden) return null;

  return (
    <>
      <div style={{ height: 84 }} />
      <nav
        aria-label="Primary"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(8,8,8,0.96)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            alignItems: "center",
            gap: 4,
            padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
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
                  padding: "8px 4px",
                  borderRadius: 12,
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
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
