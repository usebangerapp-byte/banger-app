import { titleKey } from "@/lib/titleKey";

/** bonus: added to the real count (keeps growing with new scans). scans: legacy fixed number. */
export type Override = { hidden: boolean; scans: number | null; bonus: number | null };

/** Admin overrides per track (hide from lists, scan bonus). Empty if the table doesn't exist yet. */
export async function loadOverrides(sb: any): Promise<Map<string, Override>> {
  const map = new Map<string, Override>();
  try {
    let { data, error } = await sb.from("track_overrides").select("key,hidden,scans,scan_bonus").limit(5000);
    if (error) ({ data, error } = await sb.from("track_overrides").select("key,hidden,scans").limit(5000));
    if (error) return map;
    for (const r of data || []) map.set(r.key, { hidden: !!r.hidden, scans: r.scans ?? null, bonus: r.scan_bonus ?? null });
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
