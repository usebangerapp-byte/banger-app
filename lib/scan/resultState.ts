export type ScanTag = "UNRELEASED" | "RELEASED" | "NOT FOUND";

export type RecognizeResponse = {
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

export type ScanViewState = {
  title: string;
  subtitle: string;
  tag: ScanTag;
  beatportUrl: string | null;
  spotifyUrl: string | null;
  snippetPath: string | null;
  allowPreview: boolean | null;
  success: boolean;
  fail: boolean;
};

export function mapRecognizeResult(data: RecognizeResponse): ScanViewState {
  const resultType = data?.result_type || "not_found";
  const custom = data?.metadata?.custom_files?.[0] || null;

  if (resultType === "recognized_world") {
    return {
      title: data?.track_title || "Unknown",
      subtitle: data?.track_subtitle || "(Released)",
      tag: "RELEASED",
      beatportUrl: data?.beatport_url || null,
      spotifyUrl: data?.spotify_url || null,
      snippetPath: data?.snippet_path || null,
      allowPreview: data?.allow_preview ?? null,
      success: true,
      fail: false,
    };
  }

  if (resultType === "recognized_unreleased") {
    return {
      title: data?.track_title || custom?.title || "Unknown",
      subtitle: data?.track_subtitle || "(Private DB)",
      tag: "UNRELEASED",
      beatportUrl: data?.beatport_url || null,
      spotifyUrl: data?.spotify_url || null,
      snippetPath: data?.snippet_path || null,
      allowPreview: data?.allow_preview ?? null,
      success: true,
      fail: false,
    };
  }

  return {
    title: "Not found",
    subtitle: "Try again",
    tag: "NOT FOUND",
    beatportUrl: null,
    spotifyUrl: null,
    snippetPath: null,
    allowPreview: null,
    success: false,
    fail: true,
  };
}
