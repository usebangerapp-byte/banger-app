"use client";

import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Plan = "public" | "pro";

// --- À ajuster facilement ---
const CONTACT_EMAIL = "contact@usebangerapp.com";
const PRO_PRICE = "€9.99 / mo"; // placeholder
// ----------------------------

const plans: {
  key: Plan;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
}[] = [
  {
    key: "public",
    name: "PUBLIC",
    price: "Free",
    description: "Scan tracks, follow the underground, and never lose an ID again.",
    features: [
      "Limited scans",
      "Live radar & trends",
      "Top unreleased charts",
      "Events & DJs near you",
      "Your profile",
    ],
    cta: "Start for Free",
  },
  {
    key: "pro",
    name: "PRO",
    price: PRO_PRICE,
    description: "Upload and test your unreleased tracks, get seen at events, and see exactly how your music moves.",
    features: [
      "Everything in Public, plus:",
      "Unlimited scans",
      "Upload your unreleased tracks",
      "Share & test with the scene",
      "Get seen at events",
      "Track scans & performance",
      "City & event trends",
      "Global scan data",
      "Track-potential predictions",
      "Early trend detection",
      "Best release-timing insights",
    ],
    cta: "Go Pro",
  },
];

export default function OnboardingView() {
  const router = useRouter();

  async function choosePlan(plan: Plan) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("banger_role", plan);
        localStorage.setItem("banger_plan", plan);
      }

      const supabase = createSupabaseBrowser();
      if (!supabase) {
        router.replace("/home");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error(authError);
        router.replace("/home");
        return;
      }

      const user = authData.user;
      if (!user) {
        router.replace("/home");
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email || null,
            role: plan,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        console.error(profileError);
      }
    } catch (e) {
      console.error(e);
    }

    router.replace("/home");
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>PICK YOUR PLAN</div>
          <h1 style={styles.title}>How do you want to play?</h1>
          <p style={styles.subtitle}>
            Find the IDs, follow the DJs, stay ahead of every drop.
            Upgrade whenever you&apos;re ready.
          </p>
        </div>

        <div style={styles.grid}>
          {plans.map((plan) => (
            <section key={plan.key} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.planName}>{plan.name}</div>
                <div style={styles.planPrice}>{plan.price}</div>
                <p style={styles.planDescription}>{plan.description}</p>
              </div>

              <div style={styles.features}>
                {plan.features.map((feature) => (
                  <div key={feature} style={styles.featureRow}>
                    <span style={styles.featureDot} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => choosePlan(plan.key)}
                style={styles.primaryButton}
              >
                {plan.cta}
              </button>
            </section>
          ))}
        </div>

        <p style={styles.consent}>
          By continuing, you agree to our{" "}
          <a href="/terms" style={styles.footerLink}>Terms</a> &amp;{" "}
          <a href="/privacy" style={styles.footerLink}>Privacy</a>, and to receive
          event updates by email. Opt out anytime.
        </p>
      </div>

      <div style={styles.footer}>
        <a href="/terms" style={styles.footerLink}>Terms</a> ·{" "}
        <a href="/privacy" style={styles.footerLink}>Privacy</a> ·{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} style={styles.footerLink}>Contact</a>
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
    maxWidth: 980,
    margin: "0 auto",
    display: "grid",
    gap: 24,
  },
  header: {
    display: "grid",
    gap: 10,
    textAlign: "center",
    paddingTop: 8,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: "0.22em",
    opacity: 0.58,
    fontWeight: 800,
  },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 8vw, 58px)",
    lineHeight: 0.96,
    letterSpacing: "-0.05em",
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.5,
    opacity: 0.72,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
    alignItems: "stretch",
  },
  card: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    background: "linear-gradient(180deg, rgba(12,12,12,1) 0%, rgba(5,5,5,1) 100%)",
    padding: 20,
    display: "grid",
    gap: 18,
    minHeight: 360,
  },
  cardTop: {
    display: "grid",
    gap: 8,
  },
  planName: {
    fontSize: 22,
    letterSpacing: "-0.02em",
    opacity: 1,
    fontWeight: 900,
  },
  planPrice: {
    fontSize: 18,
    lineHeight: 1,
    letterSpacing: "-0.04em",
    fontWeight: 900,
  },
  planDescription: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    opacity: 0.68,
  },
  features: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    opacity: 0.9,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: "#fff",
    flexShrink: 0,
    opacity: 0.9,
  },
  primaryButton: {
    marginTop: "auto",
    padding: "15px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#fff",
    color: "#000",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  consent: {
    margin: 0,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 1.5,
    opacity: 0.55,
    maxWidth: 560,
    justifySelf: "center",
  },
  footer: {
    marginTop: 40,
    fontSize: 12,
    opacity: 0.5,
    textAlign: "center",
  },
  footerLink: {
    color: "rgba(255,255,255,0.85)",
    textDecoration: "underline",
  },
};
