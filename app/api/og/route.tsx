import { ImageResponse } from "next/og";

export const runtime = "edge";

// GET /api/og?t=Title&a=Artist&k=track|dj|private|default&img=<avatar url>
// The gold/black card shown when a BANGER link is shared (WhatsApp, iMessage, Instagram…)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const kind = url.searchParams.get("k") || "default";
  const title = (url.searchParams.get("t") || "").slice(0, 90);
  const artist = (url.searchParams.get("a") || "").slice(0, 80);
  const img = url.searchParams.get("img") || "";

  const eyebrow = kind === "dj" ? "ON BANGER" : kind === "private" ? "PRIVATE TRACK" : kind === "track" ? "TRACK" : "";
  const headline = kind === "default" ? "Identify any track." : title || "BANGER";
  const sub = kind === "default" ? "Even unreleased." : kind === "private" ? "Sent privately on BANGER" : artist;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#000", position: "relative", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", left: -200, top: -200, width: 900, height: 900, borderRadius: 450, display: "flex",
          background: "radial-gradient(circle, rgba(226,173,46,0.30) 0%, rgba(226,173,46,0.06) 45%, rgba(0,0,0,0) 70%)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", flex: 1, gap: 18 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 10, color: "#fff", fontWeight: 700 }}>BANGER</div>
          {eyebrow ? <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#e9b844", fontWeight: 700 }}>{eyebrow}</div> : null}
          <div style={{ display: "flex", fontSize: headline.length > 40 ? 58 : 76, fontWeight: 800, color: "#fff", lineHeight: 1.05, maxWidth: 760 }}>{headline}</div>
          {sub ? <div style={{ display: "flex", fontSize: 34, color: kind === "default" ? "#e9b844" : "rgba(255,255,255,0.7)", fontWeight: kind === "default" ? 800 : 500 }}>{sub}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 420 }}>
          {kind === "dj" && img ? (
            <img src={img} width={280} height={280} style={{ borderRadius: 140, border: "6px solid #c88c0f", objectFit: "cover" }} />
          ) : (
            <img src={`${origin}/B-glow.png`} width={250} height={300} style={{ objectFit: "contain" }} />
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
