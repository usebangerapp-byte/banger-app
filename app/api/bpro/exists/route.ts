import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/notify";
import { dupKey } from "@/lib/dupKey";
import { existingKeys } from "@/lib/server/dups";

export const runtime = "nodejs";

/** Which of these {title, artist} are already on BANGER (any uploader)? */
export async function POST(req: Request) {
  const sb = adminClient();
  const me = await userFromRequest(sb, req);
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const items: { title: string; artist: string }[] = Array.isArray(body?.items) ? body.items.slice(0, 500) : [];
  const known = await existingKeys(sb, items.map((i) => dupKey(i.title, i.artist)));
  return NextResponse.json({ exists: items.map((i) => known.has(dupKey(i.title, i.artist))) });
}
