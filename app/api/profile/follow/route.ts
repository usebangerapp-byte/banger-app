import { userFromRequest } from "@/lib/server/notify";
import { createClient } from "@supabase/supabase-js";
import { notifyFollow } from "@/lib/server/notify";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const me = await userFromRequest(sb, req);
  if (!me) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const follower_id = me.id;
  const { action, following_id } = await req.json().catch(() => ({}));
  if (!following_id) return Response.json({ ok: false, error: "Missing ids" }, { status: 400 });
  if (follower_id === following_id) return Response.json({ ok: false, error: "Cannot follow yourself" }, { status: 400 });
  if (action === "unfollow") {
    await sb.from("profile_followers").delete().eq("follower_id", follower_id).eq("following_id", following_id);
    return Response.json({ ok: true, following: false });
  }
  const { data: existing } = await sb.from("profile_followers").select("id").eq("follower_id", follower_id).eq("following_id", following_id).limit(1);
  if (existing?.length) return Response.json({ ok: true, following: true });
  const { error } = await sb.from("profile_followers").insert([{ follower_id, following_id }]);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await notifyFollow(sb, following_id, follower_id).catch(() => {});
  return Response.json({ ok: true, following: true });
}
export async function GET(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id") || "";
  const list    = searchParams.get("list"); // "followers" | "following" → returns profiles

  if (list === "followers" || list === "following") {
    const idCol    = list === "followers" ? "follower_id" : "following_id";
    const matchCol = list === "followers" ? "following_id" : "follower_id";
    const { data: rows } = await sb.from("profile_followers").select(idCol).eq(matchCol, user_id).limit(200);
    const ids = (rows || []).map((r: any) => r[idCol]).filter(Boolean);
    if (!ids.length) return Response.json({ ok: true, people: [] });
    const { data: people } = await sb.from("profiles")
      .select("id,display_name,email,genre,avatar_url").in("id", ids);
    return Response.json({ ok: true, people: (people || []).map((p: any) => ({
      id: p.id, display_name: p.display_name || p.email?.split("@")[0] || "User", genre: p.genre, avatar_url: p.avatar_url,
    })) });
  }

  const { data } = await sb.from("profile_followers").select("following_id").eq("follower_id", user_id);
  return Response.json({ ok: true, following: (data || []).map((r: any) => r.following_id) });
}
