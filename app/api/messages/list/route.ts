import { userFromRequest } from "@/lib/server/notify";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { searchParams } = new URL(req.url);
  const me = await userFromRequest(sb, req);
  if (!me) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const user_id  = me.id;
  const other_id = searchParams.get("other_id") || "";

  // Just the number of unread messages (the ✉️ badge in the top bar)
  if (searchParams.get("unread") === "1") {
    const { count } = await sb.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", user_id).eq("read", false);
    return Response.json({ ok: true, unread: count || 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  // Newest first from the DB (a conversation keeps its latest messages), then back to chronological order
  let query = sb.from("messages").select("*").order("created_at", { ascending: false }).limit(other_id ? 300 : 1000);
  if (other_id) query = query.or(`and(sender_id.eq.${user_id},receiver_id.eq.${other_id}),and(sender_id.eq.${other_id},receiver_id.eq.${user_id})`);
  else query = query.or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`);
  const { data: rawDesc, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const data = (rawDesc || []).slice().reverse();

  // Enrich with display_name from profiles
  const ids = [...new Set((data || []).flatMap((m: any) => [m.sender_id, m.receiver_id]))];
  const { data: profiles } = await sb.from("profiles").select("id,display_name,email,avatar_url").in("id", ids);
  const profileMap: Record<string, any> = {};
  for (const p of profiles || []) profileMap[p.id] = p;

  const enriched = (data || []).map((m: any) => ({
    ...m,
    sender_name: profileMap[m.sender_id]?.display_name || profileMap[m.sender_id]?.email?.split("@")[0] || "?",
    sender_avatar: profileMap[m.sender_id]?.avatar_url || null,
    receiver_name: profileMap[m.receiver_id]?.display_name || profileMap[m.receiver_id]?.email?.split("@")[0] || "?",
    receiver_avatar: profileMap[m.receiver_id]?.avatar_url || null,
  }));

  if (other_id && data?.length) await sb.from("messages").update({ read: true }).eq("sender_id", other_id).eq("receiver_id", user_id).eq("read", false);
  return Response.json({ ok: true, messages: enriched, profiles: profileMap });
}
