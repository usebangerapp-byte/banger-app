export default function LibraryPage() {
  const tracks = [
    { rank: 1, artist: "Unknown Artist", title: "Unreleased ID 01", scans: 128 },
    { rank: 2, artist: "Unknown Artist", title: "Unreleased ID 02", scans: 113 },
    { rank: 3, artist: "Unknown Artist", title: "Unreleased ID 03", scans: 97 },
    { rank: 4, artist: "Unknown Artist", title: "Unreleased ID 04", scans: 88 },
    { rank: 5, artist: "Unknown Artist", title: "Unreleased ID 05", scans: 74 },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#0b0b0f", color: "white", padding: "24px 20px 120px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Charts
          </div>
          <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "8px 0 10px", fontWeight: 800 }}>
            Top Unreleased
          </h1>
          <p style={{ margin: 0, opacity: 0.72, fontSize: 15 }}>
            Most scanned unreleased tracks on Banger
          </p>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {tracks.map((track) => (
            <div
              key={track.rank}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr auto",
                gap: 14,
                alignItems: "center",
                padding: 14,
                borderRadius: 18,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                #{track.rank}
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{track.title}</div>
                <div style={{ opacity: 0.68, fontSize: 14, marginTop: 4 }}>{track.artist}</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{track.scans}</div>
                <div style={{ opacity: 0.58, fontSize: 12 }}>scans</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
