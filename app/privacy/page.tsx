import Link from "next/link";

const CONTACT_EMAIL = "contact@usebangerapp.com";

export default function PrivacyPage() {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <h1 style={styles.h1}>Privacy Policy — BANGER</h1>
        <div style={styles.meta}>Last updated: June 14, 2026</div>

        <p>
          BANGER is a music identification platform designed to help users discover tracks,
          including unreleased music and DJ IDs.
        </p>
        <p>We are committed to protecting user privacy and handling data responsibly.</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>Information We Collect</h2>

          <h3 style={styles.h3}>Audio Data</h3>
          <p>When a user scans music using the app, the microphone captures a short audio sample.</p>
          <p>The microphone is used only to listen to and identify the sound during a scan.</p>
          <p>This audio is used solely to generate an audio fingerprint used for identification.</p>
          <p>
            Important:
            <br />• Full tracks are not stored.
            <br />• Audio recordings are not kept permanently.
            <br />• The system converts audio into a fingerprint used for matching in our recognition database.
          </p>

          <h3 style={styles.h3}>Snippets</h3>
          <p>In certain cases, BANGER may generate a short snippet (up to 60 seconds) of an uploaded track.</p>
          <p>
            This snippet may be used for:
            <br />• fingerprint analysis
            <br />• verification
            <br />• optional preview (if the uploader allows it)
          </p>
          <p>BANGER does not store full tracks by default.</p>

          <h3 style={styles.h3}>Location Data</h3>
          <p>BANGER may collect approximate, city-level location only.</p>
          <p>
            Purpose:
            <br />• music scene analytics
            <br />• radar / trending tracks by region
            <br />• improving discovery
          </p>
          <p>We do not collect precise GPS coordinates.</p>

          <h3 style={styles.h3}>Account Information</h3>
          <p>
            If users create an account or log in, we may collect:
            <br />• email address
            <br />• user identifier
          </p>
          <p>Authentication may be handled through third-party services such as Google and Apple.</p>

          <h3 style={styles.h3}>Device Identifier</h3>
          <p>
            The app may generate a random anonymous device identifier stored locally to:
            <br />• track followed tracks
            <br />• maintain app functionality
            <br />• provide internal analytics
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>How We Use Data</h2>
          <p>
            Data may be used to:
            <br />• identify music tracks
            <br />• improve recognition accuracy
            <br />• provide trending / radar features
            <br />• improve product functionality
          </p>
          <p>We do not sell personal data.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Communications</h2>
          <p>
            By creating an account, you agree that BANGER may use your email address to send you
            event updates, new releases and product news.
          </p>
          <p>You can opt out at any time via the unsubscribe link in our emails or by contacting us.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Data Security</h2>
          <p>We implement reasonable technical measures to protect user data.</p>
          <p>However, no system can guarantee absolute security.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>User Rights</h2>
          <p>
            Users may request:
            <br />• deletion of stored data
            <br />• removal of fingerprints
            <br />• removal of uploaded content
          </p>
          <p>Requests can be sent to our contact email.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Upload &amp; Rights Policy</h2>
          <p>
            Users who upload audio must confirm that they:
            <br />• own the rights to the track, or
            <br />• have permission from the rights holder
          </p>
          <p>
            By uploading content, users allow BANGER to:
            <br />• generate an audio fingerprint
            <br />• analyze the audio
            <br />• store a short snippet (max 60 seconds) if required
          </p>
          <p>Tracks are used only for identification purposes.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Copyright / Removal Policy</h2>
          <p>
            If you are a rights holder and believe a track or fingerprint in BANGER should be removed,
            you may contact us.
          </p>
          <p>
            Upon valid request we can:
            <br />• remove the fingerprint
            <br />• remove any stored snippet
            <br />• disable identification for that track
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Anti-Leak Policy</h2>
          <p>BANGER is not a music distribution platform.</p>
          <p>
            The platform does not provide:
            <br />• full track downloads
            <br />• full streaming of uploaded tracks
            <br />• unauthorized distribution
          </p>
          <p>BANGER&apos;s goal is strictly music identification.</p>
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
  h3: { fontSize: 16, margin: "8px 0 0" },
  contact: { fontSize: 18, fontWeight: 700 },
  contactLink: { color: "#00E5FF", textDecoration: "none" },
  back: { opacity: 0.75 },
  backLink: { color: "#fff" },
};
