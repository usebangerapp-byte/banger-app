import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json({ ok: true, results: [] });

  const { data, error } = await sb
    .from("profiles")
    .select("id,display_name,email,genre,role,avatar_url")
    .or(`display_name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(20);

  if (error) return Response.json({ ok: false, error: error.message, results: [] });

  const results = (data || [])
    .filter((p: any) => p.display_name)
    .map((p: any) => ({ id: p.id, display_name: p.display_name, genre: p.genre, role: p.role, avatar_url: p.avatar_url }));

  return Response.json({ ok: true, results });
}
