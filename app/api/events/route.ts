export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RA_GRAPHQL = "https://ra.co/graphql";

const EVENTS_QUERY = `
  query GET_EVENTS($filters: FilterInputDtoInput, $pageSize: Int) {
    eventListings(filters: $filters, pageSize: $pageSize, page: 1, sortOrder: "ascending") {
      data {
        id
        event {
          id
          title
          date
          startTime
          contentUrl
          cost
          images { filename }
          venue { id name address area { name } }
          artists { id name contentUrl }
          pick { blurb }
        }
      }
    }
  }
`;

const CITY_TO_RA_AREA: Record<string, number> = {
  "barcelona": 13, "madrid": 225, "berlin": 5, "london": 6,
  "paris": 14, "amsterdam": 10, "ibiza": 33, "milan": 101,
  "rome": 374, "lisbon": 120, "brussels": 30, "zurich": 103,
  "vienna": 150, "stockholm": 62, "copenhagen": 29,
  "new york": 8, "los angeles": 11, "chicago": 9, "miami": 37,
  "detroit": 80, "melbourne": 61, "sydney": 68, "tokyo": 118,
  "toronto": 45, "sao paulo": 359,
};

function getAreaId(city: string): number | null {
  const norm = city.toLowerCase().trim();
  if (CITY_TO_RA_AREA[norm]) return CITY_TO_RA_AREA[norm];
  for (const [key, id] of Object.entries(CITY_TO_RA_AREA)) {
    if (norm.includes(key) || key.includes(norm)) return id;
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city   = (searchParams.get("city")   || "").trim();
  const artist = (searchParams.get("artist") || "").trim();
  const now    = new Date();
  const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateFrom = now.toISOString().split("T")[0];
  const dateTo   = oneWeek.toISOString().split("T")[0];
  const areaId = getAreaId(city);
  if (!areaId) return Response.json({ ok: false, error: `City "${city}" not found. Try a major city.`, events: [] });

  try {
    const res = await fetch(RA_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", "Referer": "https://ra.co", "Origin": "https://ra.co" },
      body: JSON.stringify({ query: EVENTS_QUERY, variables: { pageSize: 50, filters: { areas: { eq: areaId }, listingDate: { gte: dateFrom, lte: dateTo } } } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ ok: false, error: `RA API error ${res.status}`, events: [] });
    const json  = await res.json();
    const items = json?.data?.eventListings?.data || [];
    let events = items.map((item: any) => {
      const e = item?.event;
      if (!e) return null;
      return {
        id: e.id, title: e.title, date: e.date, startTime: e.startTime,
        venue: e.venue?.name || null, address: e.venue?.address || null,
        area: e.venue?.area?.name || null,
        url: e.contentUrl ? `https://ra.co${e.contentUrl}` : null,
        cost: e.cost || null,
        image: e.images?.[0]?.filename ? `https://imagecdn.ra.co/events/flyers/small/${e.images[0].filename}` : null,
        artists: Array.isArray(e.artists) ? e.artists.map((a: any) => ({ name: a.name, url: a.contentUrl ? `https://ra.co${a.contentUrl}` : null })) : [],
        pick: e.pick?.blurb || null,
      };
    }).filter(Boolean);
    if (artist) {
      const norm = artist.toLowerCase();
      events = events.filter((e: any) => e.artists?.some((a: any) => a.name?.toLowerCase().includes(norm)) || e.title?.toLowerCase().includes(norm));
    }
    return Response.json({ ok: true, city, areaId, events, total: events.length });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || "Failed to fetch RA events", events: [] });
  }
}
