"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const path = usePathname() || "/";

  const items = [
    { href: "/", label: "Home" },
    { href: "/library", label: "Library" },
    { href: "/concerts", label: "Concerts" },
    { href: "/bpro", label: "Bpro" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <div style={S.nav}>
      {items.map((it) => {
        const active = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              ...S.item,
              opacity: active ? 1 : 0.58,
            }}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

const S: any = {
  nav: {
    borderTop: "1px solid rgba(235,235,235,0.08)",
    padding: "14px 24px",
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    opacity: 0.82,
    background: "rgba(0,0,0,0.25)",
    backdropFilter: "blur(10px)",
  },
  item: {
    textDecoration: "none",
    color: "#fff",
    letterSpacing: "0.08em",
    fontWeight: 700,
  },
};
