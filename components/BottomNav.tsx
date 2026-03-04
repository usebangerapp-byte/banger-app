"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({
  name,
  active,
}: {
  name: "home" | "lib" | "mic" | "bolt" | "user";
  active: boolean;
}) {
  const stroke = active ? "rgba(245,245,245,0.96)" : "rgba(245,245,245,0.72)";
  const glow = active ? "drop-shadow(0 0 10px rgba(0,229,255,0.16))" : "none";
  const common: any = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    style: { filter: glow },
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path
          d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "lib") {
    return (
      <svg {...common}>
        <path
          d="M7 4h10a2 2 0 0 1 2 2v14H9a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2Z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M9 8h8M9 12h7M9 16h6"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "mic") {
    return (
      <svg {...common}>
        <path
          d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
          stroke={stroke}
          strokeWidth="1.6"
        />
        <path
          d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "bolt") {
    return (
      <svg {...common}>
        <path
          d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M20 21a8 8 0 0 0-16 0"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke={stroke}
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function BottomNav() {
  const path = usePathname();

  const items = [
    { href: "/", label: "Home", icon: "home" as const },
    { href: "/library", label: "Library", icon: "lib" as const },
    { href: "/concerts", label: "Concerts", icon: "mic" as const },
    { href: "/bpro", label: "Bpro", icon: "bolt" as const },
    { href: "/profile", label: "Profile", icon: "user" as const },
  ];

  return (
    <div style={styles.nav}>
      {items.map((it) => {
        const active = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              ...styles.item,
              opacity: active ? 1 : 0.62,
              transform: active ? "translateY(-2px)" : "none",
            }}
          >
            <Icon name={it.icon} active={active} />
            <div style={{ ...styles.label, opacity: active ? 0.95 : 0.72 }}>
              {it.label}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const styles: any = {
  nav: {
    borderTop: "1px solid rgba(235,235,235,0.08)",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    background: "rgba(0,0,0,0.36)",
    backdropFilter: "blur(12px)",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textDecoration: "none",
    color: "#fff",
    flex: 1,
    gap: 4,
    transition: "all .22s ease",
  },
  label: {
    fontSize: 11,
    letterSpacing: "0.06em",
    fontWeight: 700,
  },
};
