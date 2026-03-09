const sections = [
  {
    title: "Mysterious",
    subtitle: "High scan activity, very little public information",
    items: ["Unknown ID 01", "Unknown ID 02", "Unknown ID 03"],
  },
  {
    title: "Trending",
    subtitle: "Tracks with scan momentum accelerating",
    items: ["Fast Rise 01", "Fast Rise 02", "Fast Rise 03"],
  },
  {
    title: "Recently Added",
    subtitle: "Fresh tracks recently added to the system",
    items: ["New Entry 01", "New Entry 02", "New Entry 03"],
  },
  {
    title: "Most Wanted",
    subtitle: "Tracks people keep scanning before public identification",
    items: ["Wanted 01", "Wanted 02", "Wanted 03"],
  },
];

export default function ConcertsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b0b0f", color: "white", padding: "24px 20px 120px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Radar
          </div>
          <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "8px 0 10px", fontWeight: 800 }}>
            Discovery Signals
          </h1>
          <p style={{ margin: 0, opacity: 0.72, fontSize: 15 }}>
            Discover what the scene is playing right now
          </p>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {sections.map((section) => (
            <section
              key={section.title}
              style={{
                padding: 16,
                borderRadius: 20,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{section.title}</h2>
                <p style={{ margin: "6px 0 0", opacity: 0.68, fontSize: 14 }}>{section.subtitle}</p>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {section.items.map((item) => (
                  <div
                    key={item}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
