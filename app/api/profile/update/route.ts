import { userFromRequest } from "@/lib/server/notify";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const body = await req.json().catch(() => ({}));
  const me = await userFromRequest(sb, req);
  if (!me) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const user_id = me.id;
  const { display_name, bio, genre, instagram, soundcloud } = body;
  const update: any = {};
  if (display_name !== undefined) update.display_name = display_name;
  if (bio         !== undefined) update.bio          = bio;
  if (genre       !== undefined) update.genre        = genre;
  if (instagram   !== undefined) update.instagram    = instagram;
  if (soundcloud  !== undefined) update.soundcloud   = soundcloud;
  const { error } = await sb.from("profiles").update(update).eq("id", user_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
