import crypto from "crypto";

type ACRCfg = {
  host: string;
  key: string;
  secret: string;
};

function cfg(): ACRCfg {
  const host = process.env.ACR_HOST || "";
  const key = process.env.ACR_ACCESS_KEY || "";
  const secret = process.env.ACR_ACCESS_SECRET || "";
  if (!host || !key || !secret) {
    throw new Error("Missing ACR env");
  }
  return { host, key, secret };
}

export async function acrIdentify(audio: Uint8Array) {
  const c = cfg();
  const httpMethod = "POST";
  const httpUri = "/v1/identify";
  const dataType = "audio";
  const signatureVersion = "1";
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const stringToSign =
    httpMethod + "\n" +
    httpUri + "\n" +
    c.key + "\n" +
    dataType + "\n" +
    signatureVersion + "\n" +
    timestamp;

  const sign = crypto
    .createHmac("sha1", c.secret)
    .update(stringToSign)
    .digest("base64");

  const form = new FormData();
  form.append("access_key", c.key);
  form.append("data_type", dataType);
  form.append("signature_version", signatureVersion);
  form.append("signature", sign);
  form.append("timestamp", timestamp);

  const blob = new Blob([audio], { type: "application/octet-stream" });
  form.append("sample", blob, "sample.bin");
  form.append("sample_bytes", String(audio.byteLength));

  const url = "https://" + c.host + httpUri;
  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json();
  return json;
}
