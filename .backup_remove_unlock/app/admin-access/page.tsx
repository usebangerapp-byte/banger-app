"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminAccessPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Access denied");
      }
      router.replace("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Access denied");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 420, display: "grid", gap: 14, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: 20, background: "rgba(255,255,255,0.03)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: "0.10em" }}>BANGER</div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 28 }}>Admin Access</h1>
          <div style={{ opacity: 0.72, fontSize: 14 }}>Private access for presentation and internal testing.</div>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "#0d0d0d", color: "#fff", width: "100%" }}
        />
        {error ? <div style={{ fontSize: 13, color: "#ffb5b5" }}>{error}</div> : null}
        <button
          type="submit"
          disabled={busy || !password}
          style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: busy || !password ? "rgba(255,255,255,0.10)" : "#fff", color: busy || !password ? "#888" : "#000", fontWeight: 800 }}
        >
          {busy ? "Checking..." : "Access BANGER"}
        </button>
      </form>
    </main>
  );
}
