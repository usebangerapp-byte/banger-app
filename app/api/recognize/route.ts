import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function signRequest(params: {
  httpMethod: string;
  httpUri: string;
  accessKey: string;
  accessSecret: string;
  dataType: string;
  signatureVersion: string;
  timestamp: string;
}) {
  const {
    httpMethod,
    httpUri,
    accessKey,
    accessSecret,
    dataType,
    signatureVersion,
    timestamp,
  } = params;

  const stringToSign =
    httpMethod + "\n" +
    httpUri + "\n" +
    accessKey + "\n" +
    dataType + "\n" +
    signatureVersion + "\n" +
    timestamp;

  const hmac = crypto.createHmac("sha1", accessSecret);
  hmac.update(stringToSign, "utf8");
  return hmac.digest("base64");
}

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Confidence needed before showing a result. A quick try (3 s of audio) is stricter: a short or noisy
 * sample can look like another track, and a wrong answer is worse than waiting 3 more seconds.
 */
const MIN_SCORE = { world: { early: 85, final: 60 }, custom: { early: 75, final: 50 } };

function mapPrivateRecognition(payload: any, fallbackCountry = "", early = false) {
  const custom = payload?.metadata?.custom_files?.[0] || null;
  const score = Number(custom?.score ?? 100);

  if (!custom?.title || score < (early ? MIN_SCORE.custom.early : MIN_SCORE.custom.final)) return null;

  return {
    result_type: "recognized_unreleased",
    track_title: clean(custom.title) || "Unknown",
    track_subtitle: clean(custom.artist) || clean(custom.label),
    acr_code: clean(custom.acrid) || clean(custom.custom_id) || null,
    country: clean(fallbackCountry) || null,
  };
}

function mapWorldRecognition(payload: any, fallbackCountry = "", early = false) {
  const music = payload?.metadata?.music?.[0] || null;
  const score = Number(music?.score || 0);

  if (!music?.title || score < (early ? MIN_SCORE.world.early : MIN_SCORE.world.final)) return null;

  return {
    result_type: "recognized_world",
    track_title: clean(music.title) || "Unknown",
    track_subtitle: clean(music?.artists?.[0]?.name) || "Unknown",
    acr_code: clean(music.acrid) || null,
    country: clean(fallbackCountry) || null,
  };
}

function mapNotFound(fallbackCountry = "") {
  return {
    result_type: "not_found",
    track_title: "Unknown",
    track_subtitle: "Unknown",
    acr_code: null,
    country: clean(fallbackCountry) || null,
  };
}

async function callAcr(params: {
  host: string;
  accessKey: string;
  accessSecret: string;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
}) {
  const { host, accessKey, accessSecret, arrayBuffer, mimeType } = params;

  const httpMethod = "POST";
  const httpUri = "/v1/identify";
  const dataType = "audio";
  const signatureVersion = "1";
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = signRequest({
    httpMethod,
    httpUri,
    accessKey,
    accessSecret,
    dataType,
    signatureVersion,
    timestamp,
  });

  const outForm = new FormData();
  outForm.append("access_key", accessKey);
  outForm.append("data_type", dataType);
  outForm.append("signature_version", signatureVersion);
  outForm.append("signature", signature);
  outForm.append("timestamp", timestamp);
  outForm.append("sample_bytes", String(arrayBuffer.byteLength));

  const blob = new Blob([arrayBuffer], {
    type: mimeType || "application/octet-stream",
  });
  outForm.append("sample", blob, "sample.webm");

  const acrRes = await fetch(`https://${host}${httpUri}`, {
    method: "POST",
    body: outForm,
  });

  const text = await acrRes.text();
  const payload = text ? JSON.parse(text) : {};

  return {
    status: acrRes.status,
    payload,
  };
}

export async function POST(req: Request) {
  try {
    const host = process.env.ACR_HOST;

    const privateAccessKey =
      process.env.ACR_ACCESS_KEY_PRIVATE || process.env.ACR_ACCESS_KEY;
    const privateAccessSecret =
      process.env.ACR_ACCESS_SECRET_PRIVATE || process.env.ACR_ACCESS_SECRET;

    const worldAccessKey =
      process.env.ACR_ACCESS_KEY_WORLD || process.env.ACR_ACCESS_KEY;
    const worldAccessSecret =
      process.env.ACR_ACCESS_SECRET_WORLD || process.env.ACR_ACCESS_SECRET;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !host ||
      !privateAccessKey ||
      !privateAccessSecret ||
      !worldAccessKey ||
      !worldAccessSecret
    ) {
      return Response.json({ ok: false, error: "Missing ACR env vars" }, { status: 500 });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const incoming = await req.formData();
    const file = incoming.get("audio");
    const userId = clean(incoming.get("user_id"));
    const country = clean(incoming.get("country"));
    const region = clean(incoming.get("region"));
    const noLog = clean(incoming.get("no_log")) === "1"; // Set mode logs each track once itself
    const early = clean(incoming.get("early")) === "1";  // first quick try of a scan


    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "No audio file received" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const mimeType = file.type || "application/octet-stream";

    // ACR en parallèle — 2x plus rapide
    const [privateResult, worldResult] = await Promise.all([
      callAcr({ host, accessKey: privateAccessKey, accessSecret: privateAccessSecret, arrayBuffer, mimeType }),
      callAcr({ host, accessKey: worldAccessKey,   accessSecret: worldAccessSecret,   arrayBuffer, mimeType }),
    ]);


    const mappedWorld = mapWorldRecognition(worldResult.payload, country, early);
    const mappedPrivate = mapPrivateRecognition(privateResult.payload, country, early);
    // what the recogniser proposed, even below the bar — to tune the bar with the admins' ✓ / ✗
    const cTop = privateResult.payload?.metadata?.custom_files?.[0], wTop = worldResult.payload?.metadata?.music?.[0];
    const cScore = cTop ? Number(cTop.score ?? 100) : -1, wScore = wTop ? Number(wTop.score ?? 0) : -1;
    const best = cScore >= wScore ? (cTop ? { t: `${cTop.artist || ""} - ${cTop.title}`, s: cScore, k: "custom" } : null) : (wTop ? { t: `${wTop.artists?.[0]?.name || ""} - ${wTop.title}`, s: wScore, k: "world" } : null);
    const scoreOf = mappedPrivate ? cScore : mappedWorld ? wScore : best ? best.s : null;
    const mapped = mappedPrivate || mappedWorld || mapNotFound(country);

    const responsePayload = mappedPrivate
      ? privateResult.payload
      : mappedWorld
        ? worldResult.payload
        : privateResult.payload || worldResult.payload;

    const responseStatus = mappedPrivate
      ? privateResult.status
      : mappedWorld
        ? worldResult.status
        : privateResult.status || worldResult.status || 200;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let privateTrackRow: any = null;

    if (mapped.result_type === "recognized_unreleased" && mapped.track_title) {
      const { data } = await supabase
        .from("bpro_tracks")
        .select("id,artist,snippet_path,allow_preview,release_status,is_released,release_url,release_checked_at")
        .eq("title", mapped.track_title)
        .limit(1)
        .maybeSingle();

      privateTrackRow = data || null;

      // Si pas vérifié depuis 1h → vérifier Beatport en temps réel
      if (privateTrackRow && privateTrackRow.release_status !== "released") {
        const lastChecked = privateTrackRow.release_checked_at
          ? new Date(privateTrackRow.release_checked_at).getTime() : 0;
        if (lastChecked < Date.now() - 60 * 60 * 1000) {
          fetch("https://usebanger.com/api/bpro/release-check").catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          const { data: refreshed } = await supabase
            .from("bpro_tracks")
            .select("id,artist,snippet_path,allow_preview,release_status,is_released,release_url,release_checked_at")
            .eq("title", mapped.track_title).limit(1).maybeSingle();
          if (refreshed) privateTrackRow = refreshed;
        }
      }
    }

    const dbSaysReleased =
      mapped.result_type === "recognized_unreleased" &&
      (privateTrackRow?.release_status === "released" || privateTrackRow?.is_released === true)

    const effectiveResultType = dbSaysReleased
      ? "recognized_world"
      : mapped.result_type

    let finalSubtitle: string | null = mapped.track_subtitle

    if (
      (mapped.result_type === "recognized_unreleased" || dbSaysReleased) &&
      privateTrackRow?.artist
    ) {
      const artist = privateTrackRow.artist.toLowerCase()
      const title = (mapped.track_title || "").toLowerCase()

      if (!title.includes(artist)) {
        finalSubtitle = privateTrackRow.artist
      } else {
        finalSubtitle = null
      }
    }

    const row = {
      track_id: privateTrackRow?.id || null,
      track_title: mapped.track_title,
      track_subtitle: finalSubtitle,
      result_type: effectiveResultType,
      acr_code: mapped.acr_code,
      country: mapped.country,
      user_id: userId || null,
      region: region || null,
      score: scoreOf == null || !isFinite(scoreOf) ? null : Math.round(scoreOf),
      early,
      candidate: !mappedPrivate && !mappedWorld && best ? `${best.k}: ${best.t} (${Math.round(best.s)})`.slice(0, 200) : null,
    };


    // Logged BEFORE answering: on a serverless host, work left running after the response can be
    // frozen and lost (scans were missing from the stats). The insert takes a few milliseconds.
    let scanId: number | string | null = null;
    if (!noLog && !(early && effectiveResultType === "not_found")) {
      let { data: ins, error } = await supabase.from("scan_events").insert(row).select("id").single();
      if (error && /score|early|column/i.test(error.message)) {   // columns not created yet
        const { score: _s, early: _e, candidate: _c, ...base } = row as any;
        ({ data: ins, error } = await supabase.from("scan_events").insert(base).select("id").single());
      }
      if (error) console.error("scan_events insert failed", error);
      scanId = (ins as any)?.id ?? null;   // admins can then say if the result was right
    }



    return Response.json(
      {
        ...responsePayload,
        scan_id: scanId,
        result_type: effectiveResultType,
        track_title: mapped.track_title,
        track_subtitle: finalSubtitle,
        acr_code: mapped.acr_code,
        country: mapped.country,
        snippet_path: dbSaysReleased ? null : (privateTrackRow?.snippet_path || null),
        allow_preview: dbSaysReleased ? null : (privateTrackRow?.allow_preview ?? null),
        release_status: privateTrackRow?.release_status || "unknown",
        beatport_url: dbSaysReleased ? (privateTrackRow?.release_url || null) : null,
      },
      { status: responseStatus }
    );
  } catch (e: any) {
    console.error("RECOGNIZE FATAL", e);
    return Response.json(
      {
        ok: false,
        error: e?.message || "Server error",
        stack: e?.stack || null
      },
      { status: 500 }
    );
  }
}
