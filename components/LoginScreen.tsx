"use client";

import { useEffect, useRef } from "react";

export default function LoginScreen() {
  const particlesRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = particlesRef.current;
    if (!canvas) return;

    const ctx0 = canvas.getContext("2d");
    if (!ctx0) return;
    const ctx = ctx0;

    let w = 0;
    let h = 0;

    const DPR = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;

      w = Math.max(1, canvas.clientWidth);
      h = Math.max(1, canvas.clientHeight);

      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 120 }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: Math.random() * 1.5 + 0.3,
      v: Math.random() * 0.15 + 0.05,
    }));

    let raf = 0;

    function frame() {
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.y += p.v;
        if (p.y > h) {
          p.y = 0;
          p.x = Math.random() * w;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <video
        src="/Bangervidlogo.muted.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 300,
          maxWidth: "80vw",
          height: "auto",
        }}
      />

      <canvas
        ref={particlesRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
