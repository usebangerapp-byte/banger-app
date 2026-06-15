import { createClient } from "@supabase/supabase-js"
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
}
function norm(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : ""; return s || null;
}
export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ followed: [] });
  const supabase = createClient(url, key);
  const { searchParams } = new URL(req.url);
  const user_id = norm(searchParams.get("user_id"));
  if (!user_id) return json({ followed: [] });
  const { data, error } = await supabase.from("track_followers").select("track_title,track_subtitle").eq("user_id", user_id).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ followed: Array.isArray(data) ? data : [] });
}
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: "Missing env" }, 500);
  const supabase = createClient(url, key);
  const body = await req.json().catch(() => ({}));
  const action = body?.action === "unfollow" ? "unfollow" : "follow";
  const user_id = norm(body?.user_id); const track_title = norm(body?.track_title);
  const track_subtitle = norm(body?.track_subtitle);
  if (!user_id || !track_title) return json({ error: "Missing user_id or track_title" }, 400);
  if (action === "unfollow") {
    const { error } = await supabase.from("track_followers").delete().eq("user_id", user_id).eq("track_title", track_title);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, following: false });
  }
  const { data: existing } = await supabase.from("track_followers").select("id").eq("user_id", user_id).eq("track_title", track_title).limit(1);
  if (existing && existing.length > 0) return json({ ok: true, following: true });
  const { error } = await supabase.from("track_followers").insert([{ user_id, track_title, track_subtitle }]);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, following: true });
}
