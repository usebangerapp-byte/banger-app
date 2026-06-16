"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Artist = { name: string; url: string | null };
type RAEvent = {
  id: string; title: string; date: string; startTime: string | null;
  venue: string | null; address: string | null; area: string | null;
  url: string | null; cost: string | null; image: string | null;
  artists: Artist[]; pick: string | null;
};

export default function EventsPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [city,         setCity]         = useState("");
  const [cityInput,    setCityInput]    = useState("");
  const [artistFilter, setArtistFilter] = useState("");
  const [events,       setEvents]       = useState<RAEvent[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [detected,     setDetected]     = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const json = await res.json();
        const detectedCity = json?.address?.city || json?.address?.town || json?.address?.village || "";
        if (detectedCity) { setCity(detectedCity); setCityInput(detectedCity); setDetected(true); }
      } catch {}
    }, () => {});
  }, []);

  useEffect(() => {
    if (!city) return;
    loadEvents(city, artistFilter);
  }, [city]);

  async function loadEvents(searchCity: string, artist = "") {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ city: searchCity });
      if (artist) params.set("artist", artist);
      const res  = await fetch(`/api/events?${params}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load events");
      setEvents(json.events || []);
    } catch (e: any) {
      setError(e?.message || "Unable to load events."); setEvents([]);
    } finally { setLoading(false); }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!cityInput.trim()) return;
    setCity(cityInput.trim());
    loadEvents(cityInput.trim(), artistFilter);
  }

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }
    catch { return dateStr; }
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <div style={{ paddingTop: 8 }}>
          <div style={eyebrowStyle}>EVENTS</div>
          <h1 style={titleStyle}>EVENTS</h1>
          <p style={subtitleStyle}>Underground electronic music near you — powered by Resident Advisor.</p>
        </div>

        <form onSubmit={onSearch} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <input value={cityInput} onChange={e => setCityInput(e.target.value)}
              placeholder="City (e.g. Barcelona, Berlin, London…)" style={inputStyle} />
            <input value={artistFilter} onChange={e => setArtistFilter(e.target.value)}
              placeholder="Search a DJ or artist (optional)" style={inputStyle} />
          </div>
          <button type="submit" disabled={loading || !cityInput.trim()} style={searchBtnStyle}>
            {loading ? "Loading…" : detected ? `Search near ${cityInput}` : "Search events"}
          </button>
        </form>

        {error && <div style={errorStyle}>{error}</div>}

        {!loading && !error && city && events.length === 0 && (
          <div style={emptyStyle}>No events found in {city} this week. Try a nearby major city.</div>
        )}

        {events.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={sectionTitleStyle}>{events.length} EVENT{events.length > 1 ? "S" : ""} THIS WEEK · {city.toUpperCase()}</div>
            {events.map(ev => (
              <a key={ev.id} href={ev.url || "#"} target="_blank" rel="noopener noreferrer" style={eventCardStyle}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {ev.image && (
                    <img src={ev.image} alt={ev.title} style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={eventDateStyle}>{formatDate(ev.date)}{ev.startTime ? ` · ${ev.startTime}` : ""}</div>
                    <div style={eventTitleStyle}>{ev.title}</div>
                    {ev.venue && <div style={eventVenueStyle}>{ev.venue}</div>}
                    {ev.artists.length > 0 && (
                      <div style={artistsStyle}>
                        {ev.artists.slice(0, 5).map(a => a.name).join(" · ")}
                        {ev.artists.length > 5 ? ` +${ev.artists.length - 5}` : ""}
                      </div>
                    )}
                    {ev.pick && <div style={pickStyle}>⭐ RA Pick</div>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <div style={{ textAlign: "center", fontSize: 11, opacity: 0.4, paddingBottom: 8 }}>
            Powered by{" "}
            <a href="https://ra.co" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>
              Resident Advisor
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#000", color: "#fff", padding: "24px 18px 120px" };
const shellStyle: React.CSSProperties = { maxWidth: 680, margin: "0 auto", display: "grid", gap: 20 };
const eyebrowStyle: React.CSSProperties = { fontSize: 11, letterSpacing: "0.22em", opacity: 0.55, fontWeight: 800 };
const titleStyle: React.CSSProperties = { margin: "8px 0 0", fontSize: "clamp(32px, 8vw, 52px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.95 };
const subtitleStyle: React.CSSProperties = { margin: "10px 0 0", fontSize: 14, opacity: 0.65, lineHeight: 1.5 };
const inputStyle: React.CSSProperties = { padding: "13px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#0d0d0d", color: "#fff", fontSize: 15, width: "100%" };
const searchBtnStyle: React.CSSProperties = { padding: "14px 16px", borderRadius: 14, width: "100%", background: "#fff", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" };
const errorStyle: React.CSSProperties = { borderRadius: 14, background: "rgba(255,80,80,0.10)", border: "1px solid rgba(255,80,80,0.25)", padding: 12, fontSize: 13, color: "#ffb5b5" };
const emptyStyle: React.CSSProperties = { fontSize: 14, opacity: 0.55, padding: "12px 0" };
const sectionTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.20em", opacity: 0.60 };
const eventCardStyle: React.CSSProperties = { display: "block", textDecoration: "none", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 14, background: "linear-gradient(180deg, rgba(12,12,12,1) 0%, rgba(6,6,6,1) 100%)" };
const eventDateStyle: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", marginBottom: 4 };
const eventTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" };
const eventVenueStyle: React.CSSProperties = { fontSize: 13, opacity: 0.60, marginTop: 3 };
const artistsStyle: React.CSSProperties = { fontSize: 12, opacity: 0.75, marginTop: 6, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" };
const pickStyle: React.CSSProperties = { fontSize: 11, color: "#FFD700", marginTop: 6, fontWeight: 700 };
