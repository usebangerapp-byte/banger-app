export default function ContactPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", display: "grid", gap: 20 }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>Contact — BANGER</h1>
        <p style={{ opacity: 0.7 }}>
          For any request, partnership or support:
        </p>
        <a href="mailto:contact@usebanger.com" style={{ color: "#00E5FF", fontSize: 16 }}>
          contact@usebanger.com
        </a>
      </div>
    </main>
  );
}
