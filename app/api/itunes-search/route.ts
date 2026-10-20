export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const term   = searchParams.get("term")   || "";
  const entity = searchParams.get("entity") || "song";
  const limit  = searchParams.get("limit")  || "5";

  if (!term) return Response.json({ results: [] });

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=${entity}&limit=${limit}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ results: [], error: e?.message }, { status: 500 });
  }
}
