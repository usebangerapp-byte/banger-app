import AuthGate from "@/components/AuthGate";
import BottomNav from "@/components/BottomNav";

export default function ConcertsPage() {
  return (
    <AuthGate>
      <main style={S.page}>
        <div style={S.phone}>
          <div style={S.center}>
            <h1 style={S.h}>Concerts</h1>
            <p style={S.p}>Placeholder pour la présentation.</p>
          </div>
          <BottomNav />
        </div>
      </main>
    </AuthGate>
  );
}

const S: any = {
  page: { minHeight: "100vh", background: "#0b0b0c", color: "#fff", display: "flex", justifyContent: "center" },
  phone: { width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column" },
  center: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 24 },
  h: { letterSpacing: "0.10em" },
  p: { opacity: 0.75, marginTop: 10 },
};
