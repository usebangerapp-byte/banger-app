import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

// Rich share preview for a DJ / artist profile
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  let name = "BANGER", avatar = "", genre = "";
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await sb.from("profiles").select("display_name,avatar_url,genre").eq("id", slug).maybeSingle();
    if (data?.display_name && !String(data.display_name).includes("@")) name = data.display_name;
    avatar = data?.avatar_url || "";
    genre = data?.genre || "";
  } catch {}
  const og = `/api/og?k=dj&t=${encodeURIComponent(name)}&a=${encodeURIComponent(genre)}${avatar ? `&img=${encodeURIComponent(avatar)}` : ""}`;
  const title = `${name} · BANGER`;
  return {
    title,
    openGraph: { title, description: genre || "Tracks, sets and IDs on BANGER.", images: [og] },
    twitter: { card: "summary_large_image", images: [og] },
  };
}

export default function DjLayout({ children }: { children: React.ReactNode }) {
  return children;
}
