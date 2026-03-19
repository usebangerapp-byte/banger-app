import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isPastDate(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("bpro_tracks")
      .select("id,title,artist,is_released,release_date,allow_preview")
      .eq("is_released", false)
      .limit(200);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    let updated = 0;

    for (const track of data || []) {
      if (!isPastDate(track.release_date)) continue;

      const { error: updateError } = await supabase
        .from("bpro_tracks")
        .update({
          is_released: true,
          allow_preview: true,
        })
        .eq("id", track.id);

      if (!updateError) updated += 1;
    }

    return Response.json({ ok: true, updated });
  } catch (e: any) {
    console.error(e);
    return Response.json(
      { ok: false, error: e?.message || "Refresh failed" },
      { status: 500 }
    );
  }
}
