import { createClient } from "@supabase/supabase-js";

type Track = {
  id: string;
  title: string;
  artist: string;
  snippet_path: string | null;
  scan_count: number | null;
};

async function getRadar() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Top chart
  const { data: top } = await supabase
    .from("tracks")
    .select("id,title,artist,snippet_path,scan_count")
    .order("scan_count", { ascending: false })
    .limit(10);

  const banger = top?.[0] || null;
  const rising = top?.slice(1, 10) || [];

  const { data: most } = await supabase
    .from("tracks")
    .select("id,title,artist,snippet_path,scan_count")
    .gte("scan_count", 5)
    .order("scan_count", { ascending: false })
    .limit(5);

  return {
    banger,
    rising,
    most: most || []
  };
}

export default async function RadarPage() {
  const { banger, rising, most } = await getRadar();

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-2xl mb-8 font-semibold tracking-wide">RADAR</h1>

      {/* Banger of the Week */}
      <section className="mb-10">
        <h2 className="text-sm uppercase text-gray-400 mb-2">
          Banger of the Week
        </h2>

        {banger ? (
          <div className="text-lg">
            <div>{banger.title}</div>
            <div className="text-gray-400 text-sm">{banger.artist}</div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">No signal yet</div>
        )}
      </section>

      {/* Rising Bangers */}
      <section className="mb-10">
        <h2 className="text-sm uppercase text-gray-400 mb-3">
          Rising Bangers
        </h2>

        <div className="space-y-2">
          {rising.map((t) => (
            <div key={t.id}>
              <div>{t.title}</div>
              <div className="text-gray-500 text-sm">{t.artist}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Most Scanned */}
      <section>
        <h2 className="text-sm uppercase text-gray-400 mb-3">
          Most Scanned
        </h2>

        <div className="space-y-2">
          {most.map((t) => (
            <div key={t.id}>
              <div>{t.title}</div>
              <div className="text-gray-500 text-sm">{t.artist}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
