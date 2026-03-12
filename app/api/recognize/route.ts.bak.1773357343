import crypto from "crypto";

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

export async function POST(req: Request) {
  try {
    const host = process.env.ACR_HOST;
    const accessKey = process.env.ACR_ACCESS_KEY;
    const accessSecret = process.env.ACR_ACCESS_SECRET;

    if (!host || !accessKey || !accessSecret) {
      return Response.json(
        { ok: false, error: "Missing env vars" },
        { status: 500 }
      );
    }

    const incoming = await req.formData();
    const file = incoming.get("audio");

    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: "No audio file received" },
        { status: 400 }
      );
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

    return new Response(text, {
      status: acrRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
