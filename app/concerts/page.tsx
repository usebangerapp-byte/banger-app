"use client";
import BottomNav from "@/components/BottomNav";
export default function Concerts() {
  return (
    <main style={s.page}>
      <div style={s.phone}>
        <div style={s.body}>
          <div style={s.h}>CONCERTS</div>
          <div style={s.p}>Coming soon.</div>
        </div>
        <BottomNav />
      </div>
    </main>
  );
}
const s: any = {
  page: { minHeight: "100vh", background: "#0b0b0c", color: "#fff", display: "flex", justifyContent: "center" },
  phone: { width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column" },
  body: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" },
  h: { letterSpacing: "0.12em", fontWeight: 900, opacity: 0.9 },
  p: { marginTop: 8, opacity: 0.6 },
};
