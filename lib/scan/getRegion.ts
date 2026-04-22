export async function getRegion(): Promise<string> {
  try {
    let region =
      typeof window !== "undefined"
        ? localStorage.getItem("banger_region") || "Unknown"
        : "Unknown";

    if (region !== "Unknown") return region;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return "Unknown";
    }

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            const r = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
            );
            const j = await r.json();

            region =
              j.address?.city ||
              j.address?.town ||
              j.address?.village ||
              j.address?.state ||
              "Unknown";

            if (typeof window !== "undefined") {
              localStorage.setItem("banger_region", region);
            }
          } catch {}

          resolve();
        },
        () => resolve(),
        { timeout: 3000 }
      );
    });

    return region;
  } catch {
    return "Unknown";
  }
}
