import { titleKey } from "@/lib/titleKey";

export type Override = { hidden: boolean; scans: number | null };

/** Admin overrides per track (hide from lists, forced scan count). Empty if the table doesn't exist yet. */
export async function loadOverrides(sb: any): Promise<Map<string, Override>> {
  const map = new Map<string, Override>();
  try {
    const { data, error } = await sb.from("track_overrides").select("key,hidden,scans").limit(5000);
    if (error) return map;
    for (const r of data || []) map.set(r.key, { hidden: !!r.hidden, scans: r.scans ?? null });
  } catch {}
  return map;
}

export const ovFor = (map: Map<string, Override>, title: string | null | undefined) => map.get(titleKey(title));
