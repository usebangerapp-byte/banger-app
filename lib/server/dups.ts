import { dupKey } from "@/lib/dupKey";

/**
 * Which of these keys already exist on BANGER (any uploader)?
 * Uses the indexed `dup_key` column; rows uploaded before it existed are backfilled on the fly.
 * Falls back to a full scan if the column isn't there yet.
 */
export async function existingKeys(sb: any, keys: string[], excludeId?: string): Promise<Set<string>> {
  const want = Array.from(new Set(keys.filter(Boolean)));
  const found = new Set<string>();
  if (!want.length) return found;
  try {
    for (let i = 0; i < want.length; i += 150) {
      let q = sb.from("bpro_tracks").select("id,dup_key").in("dup_key", want.slice(i, i + 150));
      if (excludeId) q = q.neq("id", excludeId);
      const { data, error } = await q;
      if (error) throw error;
      for (const r of data || []) found.add(r.dup_key);
    }
    // backfill older rows (only ever happens once per row)
    const { data: nulls, error: nErr } = await sb.from("bpro_tracks").select("id,title,artist").is("dup_key", null).limit(5000);
    if (nErr) throw nErr;
    const wantSet = new Set(want);
    const updates: Promise<any>[] = [];
    for (const r of nulls || []) {
      const k = dupKey(r.title, r.artist);
      if (wantSet.has(k) && r.id !== excludeId) found.add(k);
      updates.push(sb.from("bpro_tracks").update({ dup_key: k }).eq("id", r.id));
      if (updates.length >= 25) { await Promise.all(updates); updates.length = 0; }
    }
    await Promise.all(updates);
    return found;
  } catch {
    // column missing → slow path
    const { data } = await sb.from("bpro_tracks").select("id,title,artist").limit(20000);
    const wantSet = new Set(want);
    for (const r of data || []) {
      if (r.id === excludeId) continue;
      const k = dupKey(r.title, r.artist);
      if (wantSet.has(k)) found.add(k);
    }
    return found;
  }
}

/** Store the key on a row (ignored if the column doesn't exist yet). */
export async function saveDupKey(sb: any, id: string, title: string, artist: string) {
  try { await sb.from("bpro_tracks").update({ dup_key: dupKey(title, artist) }).eq("id", id); } catch {}
}
