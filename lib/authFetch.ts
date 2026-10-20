"use client";

import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * fetch() that proves who is logged in: adds "Authorization: Bearer <access token>".
 * The server then uses that identity instead of trusting ids sent by the client.
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  try {
    const sb = createSupabaseBrowser();
    const token = sb ? (await sb.auth.getSession()).data?.session?.access_token : null;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  } catch { /* request goes out without a token → the server answers 401 */ }
  return fetch(url, { ...init, headers });
}
