import { lookupRelease } from "@/lib/server/catalog";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const title = (u.searchParams.get("t") || "").trim();
  const artist = (u.searchParams.get("a") || "").trim();
  const res = await lookupRelease(title, artist);
  return Response.json({ found: !!res, ...(res || {}) }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
