import Link from "next/link";

const CONTACT_EMAIL = "contact@usebangerapp.com";
const UPDATED = "October 20, 2026";

export default function TermsPage() {
  return (
    <main style={s.page}>
      <div style={s.shell}>
        <h1 style={s.h1}>Terms of Service</h1>
        <p style={s.meta}>BANGER — Last updated: {UPDATED}</p>

        <p>
          Welcome to BANGER. By creating an account or using our app, you agree to these Terms of
          Service. Please read them carefully. If you do not agree, do not use BANGER.
        </p>

        {/* 1 */}
        <section style={s.section}>
          <h2 style={s.h2}>1. Who we are</h2>
          <p>
            BANGER is a music identification platform that allows users to scan, discover and track
            unreleased music and DJ IDs. The service is operated by the BANGER team and is accessible
            at <strong>usebanger.com</strong> and through our mobile app.
          </p>
          <p>Contact: <a href={`mailto:${CONTACT_EMAIL}`} style={s.link}>{CONTACT_EMAIL}</a></p>
        </section>

        {/* 2 */}
        <section style={s.section}>
          <h2 style={s.h2}>2. Eligibility</h2>
          <p>
            You must be at least <strong>13 years old</strong> to use BANGER. By using the app, you
            confirm that you meet this requirement. Users under 16 in the EU must have parental
            consent in accordance with GDPR.
          </p>
        </section>

        {/* 3 */}
        <section style={s.section}>
          <h2 style={s.h2}>3. Plans &amp; subscriptions</h2>

          <h3 style={s.h3}>Free plan</h3>
          <p>
            The free plan gives you access to core features of BANGER with the following limits:
          </p>
          <ul style={s.ul}>
            <li>Up to <strong>10 scans per month</strong></li>
            <li>Access to live radar &amp; trending charts</li>
            <li>Follow up to 10 tracks</li>
            <li>Basic profile</li>
          </ul>

          <h3 style={s.h3}>PRO plan — €9.99 / month</h3>
          <p>The PRO plan unlocks the full BANGER experience:</p>
          <ul style={s.ul}>
            <li>Unlimited scans</li>
            <li>Upload unreleased tracks</li>
            <li>Share &amp; test tracks with the scene</li>
            <li>Full scan history &amp; analytics</li>
            <li>Priority radar &amp; trend data</li>
            <li>Release timing insights</li>
          </ul>

          <h3 style={s.h3}>Billing</h3>
          <p>
            PRO subscriptions are billed monthly via <strong>Stripe</strong>. Payment is charged at
            the start of each billing period. Subscriptions renew automatically unless cancelled at
            least 24 hours before the renewal date.
          </p>
          <p>
            On iOS, payment may alternatively be processed through Apple In-App Purchase, subject to
            Apple&apos;s terms.
          </p>

          <h3 style={s.h3}>Cancellation &amp; refunds</h3>
          <p>
            You may cancel your PRO subscription at any time from your profile settings. Cancellation
            takes effect at the end of the current billing period — you retain PRO access until then.
            We do not offer partial refunds for unused time, except where required by applicable law
            (including the 14-day withdrawal right under EU consumer law for digital services, if
            applicable). To request a refund, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={s.link}>{CONTACT_EMAIL}</a>.
          </p>
        </section>

        {/* 4 */}
        <section style={s.section}>
          <h2 style={s.h2}>4. User content &amp; uploads</h2>
          <p>
            You may only upload tracks that you own or have explicit permission to use. By uploading
            content, you grant BANGER a limited, non-exclusive licence to:
          </p>
          <ul style={s.ul}>
            <li>Generate an audio fingerprint for identification purposes</li>
            <li>Store a short snippet (max 60 seconds) for preview, if you allow it</li>
            <li>Display track metadata (title, artist) within the app</li>
          </ul>
          <p>
            You retain full ownership of your content. BANGER will never sell your tracks or use them
            for purposes beyond the platform.
          </p>
        </section>

        {/* 5 */}
        <section style={s.section}>
          <h2 style={s.h2}>5. Prohibited uses</h2>
          <p>You agree not to:</p>
          <ul style={s.ul}>
            <li>Upload tracks you do not own or have rights to</li>
            <li>Attempt to reverse-engineer or exploit the recognition system</li>
            <li>Use BANGER for any unlawful purpose</li>
            <li>Abuse, spam or harass other users</li>
            <li>Create multiple accounts to bypass plan limits</li>
          </ul>
          <p>
            Violation of these rules may result in immediate suspension or deletion of your account,
            without refund.
          </p>
        </section>

        {/* 6 */}
        <section style={s.section}>
          <h2 style={s.h2}>6. Account &amp; termination</h2>
          <p>
            You may delete your account at any time by contacting us. Upon deletion, your personal
            data will be removed within 30 days, except where we are required to retain it by law
            (e.g. billing records for up to 7 years under French/EU accounting rules).
          </p>
          <p>
            We reserve the right to suspend or terminate any account that violates these Terms,
            without prior notice.
          </p>
        </section>

        {/* 7 */}
        <section style={s.section}>
          <h2 style={s.h2}>7. Intellectual property</h2>
          <p>
            All BANGER branding, design, code and platform features are the exclusive property of
            BANGER. You may not copy, reproduce or distribute any part of the platform without written
            permission.
          </p>
        </section>

        {/* 8 */}
        <section style={s.section}>
          <h2 style={s.h2}>8. Disclaimer &amp; liability</h2>
          <p>
            BANGER is provided &quot;as is&quot; without warranty of any kind. We do not guarantee
            uninterrupted access or error-free operation. To the fullest extent permitted by law,
            BANGER is not liable for any indirect, incidental or consequential damages arising from
            your use of the platform.
          </p>
        </section>

        {/* 9 */}
        <section style={s.section}>
          <h2 style={s.h2}>9. Changes to these terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you by email or in-app notice
            at least 14 days before significant changes take effect. Continued use of BANGER after
            that date constitutes acceptance of the updated Terms.
          </p>
        </section>

        {/* 10 */}
        <section style={s.section}>
          <h2 style={s.h2}>10. Governing law</h2>
          <p>
            These Terms are governed by the laws of <strong>France</strong>. Any dispute shall be
            subject to the exclusive jurisdiction of the courts of Paris, France, without prejudice to
            your rights as a consumer under the laws of your country of residence.
          </p>
        </section>

        {/* 11 */}
        <section style={s.section}>
          <h2 style={s.h2}>11. Contact</h2>
          <p>For any questions regarding these Terms:</p>
          <p style={s.contactBlock}>
            <a href={`mailto:${CONTACT_EMAIL}`} style={s.link}>{CONTACT_EMAIL}</a>
          </p>
        </section>

        <div style={s.links}>
          <Link href="/privacy" style={s.link}>Privacy Policy</Link>
          {" · "}
          <Link href="/" style={s.link}>Back to BANGER</Link>
        </div>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:         { minHeight: "100vh", background: "#000", color: "#fff", padding: "32px 20px" },
  shell:        { maxWidth: 720, margin: "0 auto", display: "grid", gap: 28, lineHeight: 1.75, fontSize: 15 },
  h1:           { fontSize: 32, fontWeight: 900, margin: 0 },
  meta:         { opacity: 0.5, fontSize: 13, margin: 0 },
  section:      { display: "grid", gap: 10 },
  h2:           { fontSize: 18, fontWeight: 800, margin: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 },
  h3:           { fontSize: 14, fontWeight: 700, margin: "8px 0 0", color: "rgba(255,255,255,0.7)" },
  ul:           { margin: "6px 0", paddingLeft: 20, display: "grid", gap: 4 },
  link:         { color: "#00E5FF", textDecoration: "none" },
  contactBlock: { fontWeight: 700, fontSize: 16 },
  links:        { opacity: 0.6, fontSize: 13, paddingTop: 8 },
};
