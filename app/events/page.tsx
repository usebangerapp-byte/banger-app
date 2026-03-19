export default function EventsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "28px 18px 120px",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.22em", opacity: 0.58, fontWeight: 800 }}>
            EVENTS
          </div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em" }}>
            Events
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, opacity: 0.72 }}>
            Nearby events and music moments will appear here.
          </p>
        </div>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 20,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800 }}>Coming soon</div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            This tab is ready for the Public plan.
          </div>
        </section>
      </div>
    </main>
  );
}
