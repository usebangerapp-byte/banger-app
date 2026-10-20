import { createSupabaseBrowser } from "@/lib/supabase/client";

type RecognizeResult = {
  ok?: boolean;
  error?: string;
  details?: unknown;
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

export async function recognizeAudio(blob: Blob, mimeType: string, region: string, opts?: { noLog?: boolean }) {
  const fd = new FormData();
  fd.append("audio", blob, "sample.webm");
  fd.append("region", region);
  if (opts?.noLog) fd.append("no_log", "1");

  try {
    // Shared client + local session: no extra network round-trip before each scan
    const supabase = createSupabaseBrowser();
    if (supabase) {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth?.session?.user?.id || "";
      if (userId) fd.append("user_id", userId);
    }
  } catch (e) {
    console.error("[recognizeAudio] auth lookup failed", e);
  }


  const res = await fetch("/api/recognize", {
    method: "POST",
    body: fd,
  });

  const json = (await res.json().catch(() => null)) as RecognizeResult | null;


  if (!res.ok) {
    throw new Error(json?.error || `Recognize failed with status ${res.status}`);
  }

  return (json || {}) as RecognizeResult;
}
