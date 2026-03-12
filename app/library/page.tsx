import { createClient } from "@supabase/supabase-js";

async function getRadar() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: top } = await supabase
    .from("tracks")
    .select("id,title,artist,scan_count")
    .order("scan_count", { ascending: false })
    .limit(10);

  const banger = top?.[0] || null;
  const rising = top?.slice(1, 10) || [];

  const { data: most } = await supabase
    .from("tracks")
    .select("id,title,artist,scan_count")
    .gte("scan_count", 5)
    .order("scan_count", { ascending: false })
    .limit(5);

  return { banger, rising, most };
}

export default async function Radar() {
  const { banger, rising, most } = await getRadar();

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-xl mb-8">RADAR</h1>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-3">Banger of the Week</h2>
        {banger ? (
          <>
            <div>{banger.title}</div>
            <div className="text-gray-500 text-sm">{banger.artist}</div>
          </>
        ) : (
          <div className="text-gray-500 text-sm">No signal yet</div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-3">Rising Bangers</h2>
        {rising.map((t:any) => (
          <div key={t.id} className="mb-2">
            <div>{t.title}</div>
            <div className="text-gray-500 text-sm">{t.artist}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xs uppercase text-gray-400 mb-3">Most Scanned</h2>
        {most?.map((t:any) => (
          <div key={t.id} className="mb-2">
            <div>{t.title}</div>
            <div className="text-gray-500 text-sm">{t.artist}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
