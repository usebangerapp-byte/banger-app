"use client";

import { useMemo, useState, useEffect } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type ScanRange = "day" | "week" | "month";

// Renseigner l'URL App Store ici une fois la fiche publiée.
const APP_STORE_URL = "";

export default function LandingPage() {
  const supabase = createSupabaseBrowser();
  const [stats, setStats] = useState<any>(null);
  const [range, setRange] = useState<ScanRange>("month");
  const [busy, setBusy] = useState<"" | "google" | "apple">("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setStats(j); })
      .catch(() => {});
  }, []);

  const scansLabel = useMemo(() => {
    if (range === "day") return "SCANS TODAY";
    if (range === "week") return "SCANS THIS WEEK";
    return "SCANS THIS MONTH";
  }, [range]);

  async function continueWith(provider: "google" | "apple") {
    if (!supabase) {
      setError("Login is unavailable right now. Please try again later.");
      return;
    }
    setBusy(provider);
    setError("");

    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://banger-app-zeta.vercel.app";

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}/auth/callback` },
      });

      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Unable to start login.");
      setBusy("");
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.eyebrow}>BANGER</div>
          <h1 style={styles.title}>
            <span style={styles.titleTop}>Find your</span>
            <span style={styles.titleBottom}>Un/Released Tracks</span>
          </h1>
          <p style={styles.subtitle}>
            Scan any track — even the ones not out yet.
            <br />
            Follow your favorite DJs and get notified the moment they drop.
          </p>
          <div style={styles.heroMeta}>USED BY DJs WORLDWIDE</div>
        </section>

        <section style={styles.statsCard}>
          <div style={styles.statBlock}>
            <div style={styles.statLabel}>USERS</div>
            <div style={styles.statValue}>{stats?.users ?? "..."}</div>
          </div>

          <div style={styles.divider} />

          <div style={styles.statBlock}>
            <div style={styles.statHeaderRow}>
              <div style={styles.statLabel}>{scansLabel}</div>
              <div style={styles.rangeTabs}>
                <button
                  type="button"
                  onClick={() => setRange("day")}
                  style={tabButton(range === "day")}
                >
                  DAY
                </button>
                <button
                  type="button"
                  onClick={() => setRange("week")}
                  style={tabButton(range === "week")}
                >
                  WEEK
                </button>
                <button
                  type="button"
                  onClick={() => setRange("month")}
                  style={tabButton(range === "month")}
                >
                  MONTH
                </button>
              </div>
            </div>
            <div style={styles.statValue}>{stats?.scans?.[range] ?? "..."}</div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionTitle}>DOWNLOAD BANGER</div>
          <button
            type="button"
            onClick={() => { if (APP_STORE_URL) window.open(APP_STORE_URL, "_blank"); }}
            disabled={!APP_STORE_URL}
            style={styles.secondaryButtonFull}
          >
            {APP_STORE_URL ? "Download on the App Store" : "App Store — Coming soon"}
          </button>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionTitle}>ENTER BANGER WEB</div>
          <div style={styles.webCard}>
            <p style={styles.webText}>
              Access BANGER on web and continue with your account.
            </p>

            <button
              type="button"
              onClick={() => continueWith("google")}
              disabled={busy !== ""}
              style={styles.primaryButton}
            >
              {busy === "google" ? "Connecting..." : "Continue with Google"}
            </button>

            <button
              type="button"
              onClick={() => continueWith("apple")}
              disabled={busy !== ""}
              style={styles.appleButton}
            >
              {busy === "apple" ? "Connecting..." : "\uF8FF  Continue with Apple"}
            </button>

            <div style={styles.freePlan}>Free plan available</div>
            {error ? <div style={styles.errorText}>{error}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    padding: "24px 18px 40px",
  },
  shell: {
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
    display: "grid",
    gap: 22,
  },
  hero: {
    paddingTop: 16,
    display: "grid",
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: "0.24em",
    opacity: 0.58,
    fontWeight: 800,
  },
  title: {
    margin: 0,
    display: "grid",
    gap: 2,
    lineHeight: 0.95,
  },
  titleTop: {
    fontSize: "clamp(42px, 12vw, 72px)",
    fontWeight: 900,
    letterSpacing: "-0.06em",
  },
  titleBottom: {
    fontSize: "clamp(34px, 10vw, 60px)",
    fontWeight: 900,
    letterSpacing: "-0.06em",
    color: "rgba(255,255,255,0.92)",
  },
  subtitle: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.5,
    opacity: 0.74,
    maxWidth: 420,
  },
  heroMeta: {
    fontSize: 12,
    opacity: 0.5,
    letterSpacing: "0.15em",
    fontWeight: 800,
  },
  statsCard: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    background: "linear-gradient(180deg, rgba(12,12,12,1) 0%, rgba(5,5,5,1) 100%)",
    padding: 18,
    display: "grid",
    gap: 18,
  },
  statBlock: {
    display: "grid",
    gap: 10,
  },
  statHeaderRow: {
    display: "grid",
    gap: 12,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: "0.18em",
    opacity: 0.56,
    fontWeight: 800,
  },
  statValue: {
    fontSize: "clamp(34px, 9vw, 56px)",
    fontWeight: 900,
    letterSpacing: "-0.05em",
    lineHeight: 0.95,
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.08)",
  },
  rangeTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  section: {
    display: "grid",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: "0.22em",
    opacity: 0.6,
    fontWeight: 800,
  },
  webCard: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    background: "rgba(255,255,255,0.03)",
    padding: 18,
    display: "grid",
    gap: 12,
  },
  webText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    opacity: 0.72,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px 18px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#fff",
    color: "#000",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  appleButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px 18px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.30)",
    background: "#000",
    color: "#fff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  secondaryButtonFull: {
    padding: "15px 18px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.85)",
    fontWeight: 700,
    fontSize: 16,
  },
  freePlan: {
    textAlign: "center",
    fontSize: 12,
    opacity: 0.62,
    letterSpacing: "0.08em",
    fontWeight: 700,
  },
  errorText: {
    color: "#ffb7b7",
    textAlign: "center",
    fontSize: 13,
  },
};

function tabButton(active: boolean): React.CSSProperties {
  return {
    padding: "10px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
  };
}
