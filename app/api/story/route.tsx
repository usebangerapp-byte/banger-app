import { ImageResponse } from "next/og";

export const runtime = "edge";

// The gold woofer, as a self-contained SVG image (same look as the Scan button)
const WOOFER = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 250 250"><defs>
<radialGradient id="c" cx="45%" cy="40%" r="60%"><stop offset="0%" stop-color="#f0c040"/><stop offset="18%" stop-color="#d4960e"/><stop offset="45%" stop-color="#b87a08"/><stop offset="75%" stop-color="#8a5a04"/><stop offset="100%" stop-color="#3a2200"/></radialGradient>
<radialGradient id="k" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#3a3a38"/><stop offset="100%" stop-color="#0a0a0a"/></radialGradient>
<radialGradient id="s" cx="35%" cy="25%" r="50%"><stop offset="0%" stop-color="rgba(255,230,120,0.5)"/><stop offset="100%" stop-color="rgba(255,230,120,0)"/></radialGradient></defs>
<circle cx="125" cy="125" r="123" fill="#141414" stroke="#2c2c2c"/><circle cx="125" cy="125" r="110" fill="#070707"/>
<circle cx="125" cy="125" r="100" fill="#0e0e0d"/><circle cx="125" cy="125" r="92" fill="url(#c)"/><circle cx="125" cy="125" r="92" fill="url(#s)"/>
<circle cx="125" cy="125" r="36" fill="url(#k)" stroke="#000" stroke-width="3"/><ellipse cx="112" cy="110" rx="12" ry="7" fill="rgba(255,255,255,0.12)"/>
<circle cx="62" cy="62" r="5" fill="#2a2a28" stroke="#555"/><circle cx="188" cy="62" r="5" fill="#2a2a28" stroke="#555"/>
<circle cx="62" cy="188" r="5" fill="#2a2a28" stroke="#555"/><circle cx="188" cy="188" r="5" fill="#2a2a28" stroke="#555"/></svg>`;

// GET /api/story?t=Title&a=Artist&u=1  → 1080×1920 image for Instagram / WhatsApp stories
export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = (url.searchParams.get("t") || "Unknown").slice(0, 80);
  const artist = (url.searchParams.get("a") || "").slice(0, 80);
  const unreleased = url.searchParams.get("u") === "1";
  const woofer = `data:image/svg+xml;base64,${btoa(WOOFER)}`;
  const bLogo = `${url.origin}/B-logo-sm.png`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#000", position: "relative", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", top: 380, left: 40, width: 1000, height: 1000, borderRadius: 500, display: "flex",
          background: "radial-gradient(circle, rgba(226,173,46,0.35) 0%, rgba(226,173,46,0.08) 45%, rgba(0,0,0,0) 70%)" }} />
        <div style={{ display: "flex", marginTop: 170, fontSize: 46, letterSpacing: 22, color: "#fff", fontWeight: 700 }}>BANGER</div>
        <div style={{ display: "flex", position: "relative", width: 620, height: 620, marginTop: 170, alignItems: "center", justifyContent: "center" }}>
          <img src={woofer} width={620} height={620} style={{ position: "absolute", left: 0, top: 0 }} />
          {/* the gold B on the dome, like in the app */}
          <img src={bLogo} width={86} height={129} style={{ objectFit: "contain" }} />
        </div>
        {unreleased && (
          <div style={{ display: "flex", marginTop: 110, padding: "14px 34px", borderRadius: 999, background: "rgba(245,207,104,0.16)", color: "#f5cf68", fontSize: 34, fontWeight: 700 }}>
            Unreleased
          </div>
        )}
        <div style={{ display: "flex", marginTop: unreleased ? 40 : 120, padding: "0 90px", textAlign: "center", justifyContent: "center",
          fontSize: title.length > 34 ? 66 : 84, fontWeight: 800, color: "#fff", lineHeight: 1.08 }}>{title}</div>
        {artist ? <div style={{ display: "flex", marginTop: 26, fontSize: 44, color: "rgba(255,255,255,0.7)", padding: "0 90px", textAlign: "center" }}>{artist}</div> : null}
        <div style={{ display: "flex", position: "absolute", bottom: 150, fontSize: 38, color: "#e9b844", fontWeight: 700, letterSpacing: 2 }}>Found on BANGER</div>
        <div style={{ display: "flex", position: "absolute", bottom: 96, fontSize: 30, color: "rgba(255,255,255,0.5)" }}>usebanger.com</div>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}
