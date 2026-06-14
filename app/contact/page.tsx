import Link from "next/link";
const CONTACT_EMAIL = "contact@usebangerapp.com";
export default function ContactPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", display: "grid", gap: 20 }}>
        <h1 style={{ fontSize: 34, margin: 0, fontWeight: 900, letterSpacing: "-0.03em" }}>Contact</h1>
        <p style={{ margin: 0, opacity: 0.72, lineHeight: 1.6 }}>
          For any request, partnership or support — reach us at:
        </p>
        <a href={`mailto:${CONTACT_EMAIL}`}
          style={{ color: "#00E5FF", fontSize: 16, fontWeight: 700, textDecoration: "none" }}>
          {CONTACT_EMAIL}
        </a>
        <div style={{ opacity: 0.45, fontSize: 13 }}>
          <Link href="/" style={{ color: "#fff" }}>Back to BANGER</Link>
        </div>
      </div>
    </main>
  );
}
