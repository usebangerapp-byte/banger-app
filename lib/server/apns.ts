import http2 from "node:http2";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Apple Push Notification service (token auth, no extra dependency).
 * Inactive until these Vercel env vars exist (needs the paid Apple Developer Program):
 *   APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (content of the .p8 file),
 *   APNS_BUNDLE_ID (default com.usebanger.app), APNS_PRODUCTION ("true" for TestFlight / App Store)
 */
function config() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !privateKey) return null;
  return {
    keyId, teamId, privateKey,
    bundleId: process.env.APNS_BUNDLE_ID || "com.usebanger.app",
    host: process.env.APNS_PRODUCTION === "true" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com",
  };
}

export function pushConfigured() { return !!config(); }

let jwtCache: { token: string; at: number } | null = null;
function providerToken(c: NonNullable<ReturnType<typeof config>>) {
  if (jwtCache && Date.now() - jwtCache.at < 50 * 60 * 1000) return jwtCache.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: c.keyId })}.${b64({ iss: c.teamId, iat: Math.floor(Date.now() / 1000) })}`;
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key: c.privateKey, dsaEncoding: "ieee-p1363" });
  const token = `${unsigned}.${sig.toString("base64url")}`;
  jwtCache = { token, at: Date.now() };
  return token;
}

type PushPayload = { title: string; body: string; url?: string };

function sendOne(client: http2.ClientHttp2Session, c: NonNullable<ReturnType<typeof config>>, deviceToken: string, p: PushPayload) {
  return new Promise<number>((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken(c)}`,
      "apns-topic": c.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    req.setEncoding("utf8");
    let status = 0;
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    req.on("data", () => {});
    req.on("end", () => resolve(status));
    req.on("error", () => resolve(0));
    req.end(JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: "default" }, url: p.url || "/" }));
  });
}

/** Sends a push to every device of a user. Silently does nothing if APNs isn't configured. */
export async function pushToUser(sb: SupabaseClient, userId: string, p: PushPayload) {
  const c = config();
  if (!c) return;
  const { data: rows } = await sb.from("push_tokens").select("token").eq("user_id", userId).eq("platform", "ios");
  if (!rows?.length) return;
  const client = http2.connect(c.host);
  client.on("error", () => {});
  try {
    for (const r of rows) {
      const status = await sendOne(client, c, r.token, p);
      if (status === 410 || status === 400) await sb.from("push_tokens").delete().eq("token", r.token); // expired / invalid
    }
  } finally {
    client.close();
  }
}
