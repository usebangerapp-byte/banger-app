import { createClient } from "@supabase/supabase-js";

type Row = { track_title: string; scans: number };

async function getRadar() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase.rpc("top_scanned_tracks");

  const rows: Row[] = data || [];
  const banger = rows[0] || null;
  const rising = rows.slice(1, 10);
  const most = rows.filter(r => r.scans >= 5).slice(0, 5);

  return { banger, rising, most };
}

export default async function RadarPage() {
  const { banger, rising, most } = await getRadar();

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-xl mb-8">RADAR</h1>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Banger of the Week</h2>
        {banger ? (
          <>
            <div>{banger.track_title}</div>
            <div className="text-gray-500 text-sm">{banger.scans} scans</div>
          </>
        ) : (
          <div className="text-gray-500 text-sm">No signal yet</div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs uppercase text-gray-400 mb-2">Rising Bangers</h2>
        {rising.map((t, i) => (
          <div key={i}>
            <div>{t.track_title}</div>
            <div className="text-gray-500 text-sm">{t.scans} scans</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xs uppercase text-gray-400 mb-2">Most Scanned</h2>
        {most.map((t, i) => (
          <div key={i}>
            <div>{t.track_title}</div>
            <div className="text-gray-500 text-sm">{t.scans} scans</div>
          </div>
        ))}
      </section>
    </main>
  );
}
