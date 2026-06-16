export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RA_GRAPHQL = "https://ra.co/graphql";
const RA_HEADERS = {
  "Content-Type": "application/json",
  "Referer": "https://ra.co/events",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const AREAS_QUERY = `query($searchTerm: String!) { areas(searchTerm: $searchTerm, limit: 3) { id name country { name } } }`;

const EVENTS_QUERY = `
  query($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
    eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
      data {
        event {
          id title date startTime endTime attending contentUrl cost
          images { filename }
          venue { id name address area { name } }
          artists { id name contentUrl }
          genres { name }
          pick { blurb }
        }
      }
      totalResults
    }
  }
`;

const SEARCH_QUERY = `query($searchTerm: String!) { search(searchTerm: $searchTerm, limit: 5, indices: [ARTIST]) { id value searchType contentUrl areaName } }`;
const ARTIST_EVENTS_QUERY = `query($slug: String!) { artist(slug: $slug) { name events(type: FROMDATE, limit: 20) { id title date startTime contentUrl attending venue { name address area { name } } images { filename } genres { name } } } }`;

async function ra(query: string, variables: Record<string, unknown>) {
  const res = await fetch(RA_GRAPHQL, {
    method: "POST", headers: RA_HEADERS,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`RA HTTP ${res.status}`);
  const json = await res.json();
  if (json?.errors?.length) throw new Error(json.errors[0]?.message || "RA GraphQL error");
  return json?.data;
}

function formatEvent(e: any) {
  if (!e) return null;
  return {
    id: String(e.id), title: e.title, date: e.date,
    startTime: e.startTime || null, endTime: e.endTime || null,
    attending: e.attending || 0,
    venue: e.venue?.name || null, address: e.venue?.address || null, area: e.venue?.area?.name || null,
    url: e.contentUrl ? `https://ra.co${e.contentUrl}` : null,
    cost: e.cost || null,
    image: e.images?.[0]?.filename ? `https://imagecdn.ra.co/events/flyers/small/${e.images[0].filename}` : null,
    artists: Array.isArray(e.artists) ? e.artists.map((a: any) => ({ name: a.name, url: a.contentUrl ? `https://ra.co${a.contentUrl}` : null })) : [],
    genres: Array.isArray(e.genres) ? e.genres.map((g: any) => g.name) : [],
    pick: e.pick?.blurb || null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city   = (searchParams.get("city")   || "").trim();
  const artist = (searchParams.get("artist") || "").trim();
  const now = new Date();
  const dateFrom = now.toISOString();
  const dateTo   = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    if (artist && !city) {
      const searchData   = await ra(SEARCH_QUERY, { searchTerm: artist });
      const artistResult = (searchData?.search || [])[0];
      if (!artistResult?.contentUrl) return Response.json({ ok: true, events: [], message: `Artist "${artist}" not found on RA.` });
      const slug = artistResult.contentUrl.replace("/artist/", "").replace(/\/$/, "");
      const artistData = await ra(ARTIST_EVENTS_QUERY, { slug });
      const events = (artistData?.artist?.events || []).map((e: any) => formatEvent(e));
      return Response.json({ ok: true, artist: artistData?.artist?.name, events, total: events.length });
    }

    if (!city) return Response.json({ ok: false, error: "Provide a city or artist name.", events: [] });

    const areasData = await ra(AREAS_QUERY, { searchTerm: city });
    const areas = areasData?.areas || [];
    if (!areas.length) return Response.json({ ok: false, error: `City "${city}" not found on RA. Try a nearby major city.`, events: [] });

    const areaId = Number(areas[0].id);
    const areaName = areas[0].name;

    const eventsData = await ra(EVENTS_QUERY, {
      pageSize: 50, page: 1,
      filters: { areas: { eq: areaId }, listingDate: { gte: dateFrom, lte: dateTo } },
    });

    let events = (eventsData?.eventListings?.data || []).map((item: any) => formatEvent(item?.event)).filter(Boolean);

    if (artist) {
      const normArtist = artist.toLowerCase();
      events = events.filter((e: any) =>
        e.artists?.some((a: any) => a.name?.toLowerCase().includes(normArtist)) ||
        e.title?.toLowerCase().includes(normArtist)
      );
    }

    return Response.json({ ok: true, city: areaName, areaId, events, total: events.length });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || "Failed to fetch RA events", events: [] }, { status: 500 });
  }
}
