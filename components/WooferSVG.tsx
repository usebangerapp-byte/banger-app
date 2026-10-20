"use client";

/** The KRK-style gold woofer of the Scan button (also used on the landing). */
// Woofer inside the button — arc at the bottom
// Woofer SVG — style KRK Rokit réaliste
export default function WooferSVG({ audioLevel, listening, kick = 0 }: { audioLevel: number; listening: boolean; kick?: number }) {
  // Cone "breathes" with the overall level and punches forward on every bass hit
  const pump = 1 + audioLevel * 0.035 + kick * 0.09;
  const domePunch = 1 + kick * 0.07;
  const C = 95, R = 90;

  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      pointerEvents: "none", zIndex: 4,
    }}>
      <svg width="190" height="190" viewBox="0 0 190 190" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Cabinet / baffle noir mat */}
          <radialGradient id="baffleG" cx="42%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#232323"/>
            <stop offset="55%" stopColor="#111"/>
            <stop offset="100%" stopColor="#060606"/>
          </radialGradient>
          {/* Outer chrome bezel */}
          <linearGradient id="bezelG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#555"/>
            <stop offset="30%" stopColor="#222"/>
            <stop offset="70%" stopColor="#181818"/>
            <stop offset="100%" stopColor="#444"/>
          </linearGradient>
          {/* Surround rubber — thick black arc */}
          <radialGradient id="surroundG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1c1c1c"/>
            <stop offset="60%" stopColor="#0d0d0d"/>
            <stop offset="100%" stopColor="#050505"/>
          </radialGradient>
          {/* Cone — golden Kevlar */}
          <radialGradient id="coneG" cx="44%" cy="36%" r="58%">
            <stop offset="0%"   stopColor="#f0c040"/>
            <stop offset="18%"  stopColor="#d4960e"/>
            <stop offset="45%"  stopColor="#b87a08"/>
            <stop offset="75%"  stopColor="#8a5a04"/>
            <stop offset="100%" stopColor="#3a2200"/>
          </radialGradient>
          {/* Cone sheen highlight */}
          <radialGradient id="coneSheenG" cx="36%" cy="28%" r="45%">
            <stop offset="0%"   stopColor="rgba(255,230,120,0.50)"/>
            <stop offset="50%"  stopColor="rgba(255,200,50,0.10)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
          {/* Voice coil / spider area */}
          <radialGradient id="spiderG" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#2e2e2e"/>
            <stop offset="45%"  stopColor="#161616"/>
            <stop offset="100%" stopColor="#080808"/>
          </radialGradient>
          {/* Dome */}
          <radialGradient id="domeG" cx="38%" cy="32%" r="58%">
            <stop offset="0%"   stopColor="#3c3c3c"/>
            <stop offset="50%"  stopColor="#181818"/>
            <stop offset="100%" stopColor="#060606"/>
          </radialGradient>
          {/* Screw */}
          <radialGradient id="screwG" cx="33%" cy="28%" r="55%">
            <stop offset="0%"   stopColor="#999"/>
            <stop offset="60%"  stopColor="#444"/>
            <stop offset="100%" stopColor="#1a1a1a"/>
          </radialGradient>
          {/* Drop shadow filter */}
          <filter id="dropS" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.8"/>
          </filter>
          {/* Glow filter */}
          <filter id="glowF" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Baffle / cabinet background ── */}
        <circle cx={C} cy={C} r={R} fill="url(#baffleG)"/>

        {/* ── Chrome outer bezel ── */}
        <circle cx={C} cy={C} r={R} fill="none"
          stroke="url(#bezelG)" strokeWidth="5"/>
        {/* Bezel inner edge shadow */}
        <circle cx={C} cy={C} r={R-5} fill="none"
          stroke="rgba(0,0,0,0.9)" strokeWidth="2"/>
        {/* Bezel top highlight */}
        {/* arc drawn ON the bezel circle (r = R-2), from 10 o'clock to 2 o'clock */}
        <path d={`M ${C + (R-2)*Math.cos(-130*Math.PI/180)} ${C + (R-2)*Math.sin(-130*Math.PI/180)} A ${R-2} ${R-2} 0 0 1 ${C + (R-2)*Math.cos(-50*Math.PI/180)} ${C + (R-2)*Math.sin(-50*Math.PI/180)}`}
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"
          strokeLinecap="round"/>

        {/* ── Surround (rubber roll — thick arc) ── */}
        {/* Outer surround edge */}
        <circle cx={C} cy={C} r="76" fill="none"
          stroke="rgba(0,0,0,0.95)" strokeWidth="1"/>
        {/* Surround body */}
        <circle cx={C} cy={C} r="72" fill="url(#surroundG)"
          filter="url(#dropS)"/>
        {/* Surround groove */}
        <circle cx={C} cy={C} r="68" fill="none"
          stroke="rgba(255,255,255,0.035)" strokeWidth="1.5"/>
        <circle cx={C} cy={C} r="64" fill="none"
          stroke="rgba(0,0,0,0.7)" strokeWidth="2"/>

        {/* ── Cone (golden KRK) — pumps with audio ── */}
        <g style={{
          transform: `scale(${pump})`,
          transformOrigin: `${C}px ${C}px`,
          transition: "transform 0.06s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}>
          <circle cx={C} cy={C} r="62" fill="url(#coneG)"/>
          {/* Sheen highlight — no texture lines, no rings */}
          <circle cx={C} cy={C} r="62" fill="url(#coneSheenG)"/>

          {/* ── Spider / voice coil former ── */}
          <circle cx={C} cy={C} r="27" fill="url(#spiderG)"
            stroke="rgba(0,0,0,0.8)" strokeWidth="1.5"/>
          <circle cx={C} cy={C} r="22" fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>

          {/* ── Dome (dust cap) — extra punch on kicks ── */}
          <g style={{ transform: `scale(${domePunch})`, transformOrigin: `${C}px ${C}px`, transition: "transform 0.06s cubic-bezier(0.2, 0.9, 0.3, 1)" }}>
          <circle cx={C} cy={C} r="20" fill="url(#domeG)"
            stroke="rgba(80,80,80,0.3)" strokeWidth="0.8"
            filter="url(#dropS)"/>
          {/* Dome specular */}
          <ellipse cx={C-6} cy={C-7} rx="8" ry="5"
            fill="rgba(255,255,255,0.11)" style={{filter:"blur(1.5px)"}}/>
          </g>
        </g>

        {/* ── Screws × 4 (outside cone, on baffle) ── */}
        {[45, 135, 225, 315].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const sx = C + Math.cos(a) * 83;
          const sy = C + Math.sin(a) * 83;
          return (
            <g key={deg}>
              <circle cx={sx} cy={sy} r="5" fill="url(#screwG)"
                stroke="rgba(0,0,0,0.8)" strokeWidth="0.5"/>
              {/* Phillips cross */}
              <line x1={sx-2.8} y1={sy} x2={sx+2.8} y2={sy}
                stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1={sx} y1={sy-2.8} x2={sx} y2={sy+2.8}
                stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" strokeLinecap="round"/>
              {/* Screw highlight */}
              <circle cx={sx-1} cy={sy-1} r="1.5"
                fill="rgba(255,255,255,0.22)"/>
            </g>
          );
        })}
      </svg>

      {/* ── B logo centered on dome ── */}
      <img src="/B-logo-sm.png" alt="B" style={{
        position: "absolute",
        width: 28, height: 28,
        objectFit: "contain",
        filter: "drop-shadow(0 0 6px rgba(245,207,104,0.75))",
        opacity: 1,
        transition: "transform 0.06s cubic-bezier(0.2, 0.9, 0.3, 1)",
        transform: `scale(${pump * domePunch})`,
      }}/>
    </div>
  );
}
