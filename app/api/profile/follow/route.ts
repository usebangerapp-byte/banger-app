import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { action, follower_id, following_id } = await req.json().catch(() => ({}));
  if (!follower_id || !following_id) return Response.json({ ok: false, error: "Missing ids" }, { status: 400 });
  if (follower_id === following_id) return Response.json({ ok: false, error: "Cannot follow yourself" }, { status: 400 });
  if (action === "unfollow") {
    await sb.from("profile_followers").delete().eq("follower_id", follower_id).eq("following_id", following_id);
    return Response.json({ ok: true, following: false });
  }
  const { data: existing } = await sb.from("profile_followers").select("id").eq("follower_id", follower_id).eq("following_id", following_id).limit(1);
  if (existing?.length) return Response.json({ ok: true, following: true });
  const { error } = await sb.from("profile_followers").insert([{ follower_id, following_id }]);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, following: true });
}
export async function GET(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id") || "";
  const { data } = await sb.from("profile_followers").select("following_id").eq("follower_id", user_id);
  return Response.json({ ok: true, following: (data || []).map((r: any) => r.following_id) });
}
