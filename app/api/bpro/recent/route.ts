import { NextResponse } from "next/server";

/**
 * Alias endpoint kept for backward compatibility.
 * Some UI calls /api/bpro/recent. We proxy to /api/bpro/scan.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const target = new URL("/api/bpro/scan", base);

  // forward query params
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const res = await fetch(target.toString(), {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: res.headers });
}
