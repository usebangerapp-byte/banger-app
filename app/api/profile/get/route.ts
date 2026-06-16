import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { searchParams } = new URL(req.url);
  const slug    = searchParams.get("slug")    || "";
  const user_id = searchParams.get("user_id") || "";
  const query = slug
    ? sb.from("profiles").select("id,email,display_name,bio,genre,instagram,soundcloud,role,avatar_url").ilike("display_name", slug).limit(1)
    : sb.from("profiles").select("id,email,display_name,bio,genre,instagram,soundcloud,role,avatar_url").eq("id", user_id).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return Response.json({ ok: false, error: "Profile not found" }, { status: 404 });
  const profileId = data.id;
  const [{ count: followerCount }, { count: followingCount }, { data: tracks }] = await Promise.all([
    sb.from("profile_followers").select("*", { count: "exact", head: true }).eq("following_id", profileId),
    sb.from("profile_followers").select("*", { count: "exact", head: true }).eq("follower_id", profileId),
    sb.from("bpro_tracks").select("id,title,artist,release_status,is_released").eq("uploader_email", data.email).order("created_at", { ascending: false }).limit(10),
  ]);
  return Response.json({ ok: true, profile: { ...data, follower_count: followerCount||0, following_count: followingCount||0 }, tracks: tracks||[] });
}
