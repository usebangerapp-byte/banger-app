import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

function startOfDayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const [
      usersRes,
      scansDayRes,
      scansWeekRes,
      scansMonthRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("scan_events").select("*", { count: "exact", head: true }).gte("created_at", startOfDayISO()),
      supabase.from("scan_events").select("*", { count: "exact", head: true }).gte("created_at", daysAgoISO(7)),
      supabase.from("scan_events").select("*", { count: "exact", head: true }).gte("created_at", daysAgoISO(30)),
    ]);

    if (usersRes.error || scansDayRes.error || scansWeekRes.error || scansMonthRes.error) {
      return Response.json(
        {
          ok: false,
          error:
            usersRes.error?.message ||
            scansDayRes.error?.message ||
            scansWeekRes.error?.message ||
            scansMonthRes.error?.message ||
            "Stats query failed",
        },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      users: usersRes.count || 0,
      scans: {
        day: scansDayRes.count || 0,
        week: scansWeekRes.count || 0,
        month: scansMonthRes.count || 0,
      },
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
