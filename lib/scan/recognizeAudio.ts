import { createClient } from "@supabase/supabase-js";

type RecognizeResult = {
  result_type?: "recognized_world" | "recognized_unreleased" | "not_found";
  track_title?: string | null;
  track_subtitle?: string | null;
  beatport_url?: string | null;
  spotify_url?: string | null;
  snippet_path?: string | null;
  allow_preview?: boolean | null;
  metadata?: {
    custom_files?: Array<{
      title?: string;
    }>;
    music?: Array<unknown>;
  };
};

export async function recognizeAudio(blob: Blob, mimeType: string, region: string) {
  const fd = new FormData();
  fd.append("audio", blob, "sample.webm");
  fd.append("region", region);

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anon) {
      const supabase = createClient(url, anon);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id || "";
      if (userId) fd.append("user_id", userId);
    }
  } catch {}

  const res = await fetch("/api/recognize", {
    method: "POST",
    body: fd,
  });

  return (await res.json()) as RecognizeResult;
}
