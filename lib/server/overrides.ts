import { titleKey } from "@/lib/titleKey";

/** bonus: added to the real count (keeps growing with new scans). scans: legacy fixed number. */
export type Override = { hidden: boolean; scans: number | null; bonus: number | null; pick: string | null };

/** Admin overrides per track (hide from lists, scan bonus). Empty if the table doesn't exist yet. */
export async function loadOverrides(sb: any): Promise<Map<string, Override>> {
  const map = new Map<string, Override>();
  try {
    let { data, error } = await sb.from("track_overrides").select("key,hidden,scans,scan_bonus,staff_pick").limit(5000);
    if (error) ({ data, error } = await sb.from("track_overrides").select("key,hidden,scans,scan_bonus").limit(5000));
    if (error) ({ data, error } = await sb.from("track_overrides").select("key,hidden,scans").limit(5000));
    if (error) return map;
    for (const r of data || []) map.set(r.key, { hidden: !!r.hidden, scans: r.scans ?? null, bonus: r.scan_bonus ?? null, pick: r.staff_pick ?? null });
  } catch {}
  return map;
}

export const ovFor = (map: Map<string, Override>, title: string | null | undefined) => map.get(titleKey(title));

/** The number to show: real + bonus (grows with every new scan), or a legacy fixed number. */
export function shownScans(o: Override | undefined, real: number) {
  if (!o) return real;
  if (o.bonus != null) return Math.max(0, real + o.bonus);
  if (o.scans != null) return o.scans;
  return real;
}

/** Under this many scans, the count isn't shown (a label is shown instead). */
export const SHOW_COUNT_FROM = 10;

/**
 * Tracks to complete a list at launch, after the real ranking: BANGER uploads not out yet,
 * Staff picks first (in the order they were picked), then the newest uploads. No fake numbers:
 * these rows carry 0 scans and a label ("Staff pick" / "New on BANGER").
 */
export async function fillTracks(sb: any, ov: Map<string, Override>, exclude: Set<string>, limit: number) {
  if (limit <= 0) return [];
  const { data } = await sb.from("bpro_tracks").select("title,artist,is_released,release_status,release_date,created_at")
    .order("created_at", { ascending: false }).limit(2000);
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set(exclude);
  const rows: { key: string; track_title: string; track_subtitle: string; badge: string; pick: string | null; at: string }[] = [];
  for (const t of (data || []) as any[]) {
    const key = titleKey(t.title);
    if (!key || seen.has(key)) continue;
    const out = (t.is_released === true || t.release_status === "released") && !(t.release_date && String(t.release_date).slice(0, 10) > today);
    const o = ov.get(key);
    if (out || o?.hidden) continue;
    seen.add(key);
    rows.push({ key, track_title: t.title, track_subtitle: t.artist || "", badge: o?.pick ? "Staff pick" : "New on BANGER", pick: o?.pick || null, at: t.created_at || "" });
  }
  rows.sort((a, b) => (a.pick && b.pick ? a.pick.localeCompare(b.pick) : a.pick ? -1 : b.pick ? 1 : b.at.localeCompare(a.at)));
  return rows.slice(0, limit);
}
