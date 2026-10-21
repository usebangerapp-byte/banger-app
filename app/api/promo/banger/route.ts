import { adminClient } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → the official BANGER account, always suggested as a promo recipient (demo submissions)
export async function GET() {
  const sb = adminClient();
  const email = (process.env.BANGER_ACCOUNT_EMAIL || "usebangerapp@gmail.com").toLowerCase();
  const { data } = await sb.from("profiles").select("id,display_name,avatar_url").ilike("email", email).maybeSingle();
  if (!data) return Response.json({ ok: false });
  return Response.json({ ok: true, id: data.id, display_name: data.display_name || "BANGER", avatar_url: data.avatar_url || null });
}
