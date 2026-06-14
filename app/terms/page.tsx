import Link from "next/link";

const CONTACT_EMAIL = "contact@usebangerapp.com";

export default function TermsPage() {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <h1 style={styles.h1}>Terms of Service — BANGER</h1>
        <div style={styles.meta}>Last updated: June 14, 2026</div>

        <p>By using BANGER, you agree to the following terms.</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>User responsibility</h2>
          <p>Users may only upload tracks they own or have permission to use.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Content usage</h2>
          <p>Uploaded tracks are used to generate recognition fingerprints for the BANGER music identification system.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Copyright</h2>
          <p>Users are responsible for ensuring they have the rights to upload the content they submit.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Communications</h2>
          <p>
            By creating an account, you agree that BANGER may use your email address to send you
            event updates, new releases and product news. You can opt out at any time using the
            unsubscribe link in our emails or by contacting us.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Pro subscription</h2>
          <p>
            BANGER Pro is a paid subscription (€9.99 / month). On iOS, payment is processed through
            Apple In-App Purchase and is subject to Apple&apos;s terms. Subscriptions renew
            automatically unless cancelled at least 24 hours before the end of the current period.
            You can manage or cancel your subscription in your account or App Store settings.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Service availability</h2>
          <p>BANGER may update or modify the platform at any time to improve the service.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Acceptance</h2>
          <p>By continuing to use BANGER, you accept these terms.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Contact</h2>
          <p style={styles.contact}>
            <a href={`mailto:${CONTACT_EMAIL}`} style={styles.contactLink}>{CONTACT_EMAIL}</a>
          </p>
        </section>

        <div style={styles.back}>
          <Link href="/" style={styles.backLink}>Back to BANGER</Link>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#000", color: "#fff", padding: 24 },
  shell: { maxWidth: 860, margin: "0 auto", display: "grid", gap: 22, lineHeight: 1.7 },
  h1: { fontSize: 34, margin: 0 },
  meta: { opacity: 0.7 },
  section: { display: "grid", gap: 6 },
  h2: { fontSize: 20, margin: 0 },
  contact: { fontSize: 18, fontWeight: 700 },
  contactLink: { color: "#00E5FF", textDecoration: "none" },
  back: { opacity: 0.75 },
  backLink: { color: "#fff" },
};
