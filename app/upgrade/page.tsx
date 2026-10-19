"use client";

export default function UpgradePage() {
  return (
    <main style={page}>
      <div style={shell}>

        <div style={{ paddingTop: 8 }}>
          <div style={eyebrow}>BANGER PRO</div>
          <h1 style={title}>GO PRO.</h1>
          <p style={subtitle}>
            Upload your unreleased tracks, get scanned by the scene,
            and watch your IDs spread worldwide.
          </p>
        </div>

        <div style={featuresGrid}>
          {FEATURES.map((f) => (
            <div key={f.label} style={featureCard}>
              <div style={featureIcon}>{f.icon}</div>
              <div style={featureLabel}>{f.label}</div>
              <div style={featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={pricingCard}>
          <div style={pricingEyebrow}>EARLY ACCESS</div>
          <div style={pricingPrice}>Free during beta</div>
          <div style={pricingNote}>Paid plan coming soon — lock in your spot now.</div>
        </div>

        <button
          style={ctaBtn}
          onClick={() => {
            window.open("mailto:chokrymusic@gmail.com?subject=BANGER PRO Access", "_blank");
          }}
        >
          Request PRO Access
        </button>

        <div style={disclaimer}>
          PRO access is currently invite-only. We'll reach out within 48h.
        </div>

      </div>
    </main>
  );
}

const FEATURES = [
  {
    icon: "⬆️",
    label: "Upload Your IDs",
    desc: "Submit unreleased tracks directly to BANGER's recognition database.",
  },
  {
    icon: "📡",
    label: "Get Scanned",
    desc: "Every BANGER user becomes a potential fan — your ID shows up the moment it's scanned.",
  },
  {
    icon: "📊",
    label: "Track Stats",
    desc: "See how many times your tracks have been scanned and followed.",
  },
  {
    icon: "🔓",
    label: "Release Control",
    desc: "Mark tracks unreleased or released — you decide what the world sees.",
  },
  {
    icon: "🎧",
    label: "Preview Snippets",
    desc: "Let fans hear a 10-second teaser before the release drops.",
  },
  {
    icon: "💬",
    label: "DJ Messaging",
    desc: "Share demos with other DJs directly inside the app.",
  },
];

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
  padding: "24px 18px 120px",
};
const shell: React.CSSProperties = {
  maxWidth: 680,
  margin: "0 auto",
  display: "grid",
  gap: 24,
};
const eyebrow: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.22em",
  opacity: 0.55,
  fontWeight: 800,
};
const title: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "clamp(42px, 12vw, 72px)",
  fontWeight: 900,
  letterSpacing: "-0.04em",
  lineHeight: 0.9,
};
const subtitle: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: 16,
  opacity: 0.65,
  lineHeight: 1.55,
  maxWidth: 480,
};
const featuresGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
};
const featureCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: "18px 16px",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 6,
};
const featureIcon: React.CSSProperties = { fontSize: 22 };
const featureLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.02em",
};
const featureDesc: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.6,
  lineHeight: 1.45,
};
const pricingCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 24,
  padding: "22px 20px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
  textAlign: "center",
  display: "grid",
  gap: 6,
};
const pricingEyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.28em",
  opacity: 0.5,
};
const pricingPrice: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: "-0.03em",
};
const pricingNote: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.55,
};
const ctaBtn: React.CSSProperties = {
  padding: "16px",
  borderRadius: 16,
  width: "100%",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  fontSize: 16,
  border: "none",
  cursor: "pointer",
  letterSpacing: "0.02em",
};
const disclaimer: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.4,
  textAlign: "center",
};
