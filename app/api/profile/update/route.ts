import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const body = await req.json().catch(() => ({}));
  const { user_id, display_name, bio, genre, instagram, soundcloud, role } = body;
  if (!user_id) return Response.json({ ok: false, error: "Missing user_id" }, { status: 400 });
  const update: any = {};
  if (display_name !== undefined) update.display_name = display_name;
  if (bio         !== undefined) update.bio          = bio;
  if (genre       !== undefined) update.genre        = genre;
  if (instagram   !== undefined) update.instagram    = instagram;
  if (soundcloud  !== undefined) update.soundcloud   = soundcloud;
  if (role        !== undefined) update.role         = role;
  const { error } = await sb.from("profiles").update(update).eq("id", user_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
