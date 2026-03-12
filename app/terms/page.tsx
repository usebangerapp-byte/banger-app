import Link from "next/link";

export default function TermsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 22, lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>Terms of Service — BANGER</h1>
        <div style={{ opacity: 0.7 }}>Last updated: March 10, 2026</div>

        <p>
          By using BANGER, you agree to the following terms.
        </p>

        <section>
          <h2>User responsibility</h2>
          <p>
            Users may only upload tracks they own or have permission to use.
          </p>
        </section>

        <section>
          <h2>Content usage</h2>
          <p>
            Uploaded tracks are used to generate recognition fingerprints for the BANGER music identification system.
          </p>
        </section>

        <section>
          <h2>Copyright</h2>
          <p>
            Users are responsible for ensuring they have the rights to upload the content they submit.
          </p>
        </section>

        <section>
          <h2>Service availability</h2>
          <p>
            BANGER may update or modify the platform at any time to improve the service.
          </p>
        </section>

        <section>
          <h2>Acceptance</h2>
          <p>
            By continuing to use BANGER, you accept these terms.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p style={{ fontSize: 18, fontWeight: 700 }}>
            <a href="mailto:contact@usebanger.com" style={{ color: "#00E5FF", textDecoration: "none" }}>
              contact@usebanger.com
            </a>
          </p>
        </section>

        <div style={{ opacity: 0.75 }}>
          <Link href="/login" style={{ color: "#fff" }}>Back to Login</Link>
        </div>
      </div>
    </main>
  );
}
