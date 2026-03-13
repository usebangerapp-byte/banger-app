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

function mapRecognition(payload: any, fallbackCountry = "") {
  const custom = payload?.metadata?.custom_files?.[0] || null;
  const music = payload?.metadata?.music?.[0] || null;

  if (custom?.title) {
    return {
      result_type: "recognized",
      track_title: clean(custom.title) || "Unknown",
      track_subtitle: clean(custom.artist) || clean(custom.label) || "(Private DB)",
      acr_code: clean(custom.acrid) || clean(custom.custom_id) || null,
      country: clean(fallbackCountry) || null,
    };
  }

  if (music?.title) {
    return {
      result_type: "recognized",
      track_title: clean(music.title) || "Unknown",
      track_subtitle: clean(music?.artists?.[0]?.name) || "Unknown",
      acr_code: clean(music.acrid) || null,
      country: clean(fallbackCountry) || null,
    };
  }

  return {
    result_type: "not_found",
    track_title: "Unknown",
    track_subtitle: "Unknown",
    acr_code: null,
    country: clean(fallbackCountry) || null,
  };
}

export async function POST(req: Request) {
  try {
    const host = process.env.ACR_HOST;
    const accessKey = process.env.ACR_ACCESS_KEY;
    const accessSecret = process.env.ACR_ACCESS_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!host || !accessKey || !accessSecret) {
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

    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "No audio file received" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const sampleBytes = arrayBuffer.byteLength;

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
    outForm.append("sample_bytes", String(sampleBytes));

    const blob = new Blob([arrayBuffer], {
      type: file.type || "application/octet-stream",
    });
    outForm.append("sample", blob, "sample.webm");

    const acrRes = await fetch(`https://${host}${httpUri}`, {
      method: "POST",
      body: outForm,
    });

    const text = await acrRes.text();
    const payload = text ? JSON.parse(text) : {};
    const mapped = mapRecognition(payload, country);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const row = {
      track_title: mapped.track_title,
      track_subtitle: mapped.track_subtitle,
      result_type: mapped.result_type,
      acr_code: mapped.acr_code,
      country: mapped.country,
      user_id: userId || null,
      region: region || null,
    };

    console.log("scan_events payload", row);

    const { error } = await supabase.from("scan_events").insert(row);

    if (error) {
      console.error("scan_events insert failed", error);
      return Response.json(
        { ok: false, error: "scan_events insert failed", details: error, row, acr: payload },
        { status: 500 }
      );
    }

    console.log("scan_events insert ok");

    return Response.json(payload, { status: acrRes.status });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
