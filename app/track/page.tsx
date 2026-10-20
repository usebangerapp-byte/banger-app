import type { Metadata } from "next";
import TrackClient from "./TrackClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

// Rich share preview: "Title — Artist" with the gold BANGER card
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const t = String(sp.t || "").slice(0, 120);
  const a = String(sp.a || "").slice(0, 120);
  const title = t ? `${t}${a ? ` — ${a}` : ""} · BANGER` : "BANGER";
  const og = `/api/og?k=track&t=${encodeURIComponent(t)}&a=${encodeURIComponent(a)}`;
  return {
    title,
    openGraph: { title, description: "Listen, preview and follow on BANGER.", images: [og] },
    twitter: { card: "summary_large_image", images: [og] },
  };
}

export default function TrackPage() {
  return <TrackClient />;
}
