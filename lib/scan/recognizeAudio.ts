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

export async function recognizeAudio(blob: Blob, mimeType: string, region: string, opts?: { noLog?: boolean; early?: boolean; quick?: boolean }) {
  const fd = new FormData();
  fd.append("audio", blob, "sample.webm");
  fd.append("region", region);
  if (opts?.noLog) fd.append("no_log", "1");
  if (opts?.early) fd.append("early", "1");
  if (opts?.quick) fd.append("quick", "1");   // 3–4.5 s of audio: only a very sure answer counts   // quick first try: only logged if it finds something

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


  // Outside, the network drops for a second: try again twice before giving up
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch("/api/recognize", { method: "POST", body: fd, signal: AbortSignal.timeout(25_000) });
      if (res.status < 500 || attempt === 2) break;
    } catch (e) {
      if (attempt === 2) throw new Error(typeof navigator !== "undefined" && navigator.onLine === false ? "NO_CONNECTION" : "NETWORK");
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  if (!res) throw new Error("NETWORK");

  const json = (await res.json().catch(() => null)) as RecognizeResult | null;


  if (!res.ok) {
    throw new Error(json?.error || `Recognize failed with status ${res.status}`);
  }

  return (json || {}) as RecognizeResult;
}
