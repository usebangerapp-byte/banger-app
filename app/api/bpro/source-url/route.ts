import { adminClient, userFromRequest } from "@/lib/server/notify";
import { isPro } from "@/lib/server/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "acr-sources";

// POST { ext } → signed upload URL for the full track (sent straight from the phone, no size limit of our API)
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!(await isPro(sb, user.id))) return Response.json({ ok: false, error: "Pro only" }, { status: 403 });
  const { ext } = await req.json().catch(() => ({}));
  const safeExt = String(ext || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp3";
  const { data: b } = await sb.storage.getBucket(BUCKET);
  if (!b) await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "50MB" }).catch(() => {});
  const path = `${user.id}/${crypto.randomUUID()}.${safeExt}`;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return Response.json({ ok: false, error: error?.message || "No upload URL" }, { status: 500 });
  return Response.json({ ok: true, bucket: BUCKET, path: data.path, token: data.token });
}
