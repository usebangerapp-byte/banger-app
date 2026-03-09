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
          d="M12 4.2 14.05 5.5 16.45 5.3 17.2 7.6 19.2 8.9 18.45 11.2 19.2 13.5 17.2 14.8 16.45 17.1 14.05 16.9 12 18.2 9.95 16.9 7.55 17.1 6.8 14.8 4.8 13.5 5.55 11.2 4.8 8.9 6.8 7.6 7.55 5.3 9.95 5.5 12 4.2Z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m9.5 11.3 1.6 1.6 3.4-3.4"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
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
    { href: "/profile", label: "Profil", icon: "user" as const },
    { href: "/library", label: "Charts", icon: "chart" as const },
    { href: "/", label: "Scan", icon: "bolt" as const },
    { href: "/concerts", label: "Radar", icon: "sat" as const },
    { href: "/bpro", label: "BPRO", icon: "bolt" as const },
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
