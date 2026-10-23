"use client";

/**
 * Native bridge (Capacitor). Everything here is a no-op on the website:
 * plugins are reached through registerPlugin(), so the web build needs no
 * extra npm package — the native side only needs the plugin installed in Xcode.
 */
type AnyPlugin = Record<string, (...args: any[]) => Promise<any>> & {
  addListener?: (event: string, cb: (data: any) => void) => Promise<{ remove: () => void }>;
};

// The Capacitor runtime is only loaded inside the iOS/Android app (code-split: zero cost on the web).
let corePromise: Promise<typeof import("@capacitor/core")> | null = null;
function core() {
  if (!corePromise) corePromise = import("@capacitor/core");
  return corePromise;
}
const pluginCache: Record<string, AnyPlugin> = {};
export async function plugin(name: string): Promise<AnyPlugin | null> {
  if (!hasPlugin(name)) return null;
  if (!pluginCache[name]) {
    const { registerPlugin } = await core();
    pluginCache[name] = registerPlugin<AnyPlugin>(name);
  }
  return pluginCache[name];
}

/** Bridge object injected by the native shell (undefined on the website). */
function bridge(): any {
  return typeof window !== "undefined" ? (window as any).Capacitor : undefined;
}

/** URL scheme registered in ios/App/App/Info.plist (CFBundleURLTypes). */
export const APP_SCHEME = "com.usebanger.app";
export const NATIVE_AUTH_REDIRECT = `${APP_SCHEME}://auth/callback`;

export function isNativeApp(): boolean {
  try { return !!bridge()?.isNativePlatform?.(); } catch { return false; }
}

export function hasPlugin(name: string): boolean {
  try { return isNativeApp() && !!bridge()?.isPluginAvailable?.(name); } catch { return false; }
}

export function nativePlatform(): string {
  try { return bridge()?.getPlatform?.() || "web"; } catch { return "web"; }
}

/* ────────────────────────── Haptics ────────────────────────── */

export type HapticKind = "tap" | "analyzing" | "success" | "fail";

/** Returns true when a native haptic was played (so callers can skip web fallbacks). */
export async function nativeHaptic(kind: HapticKind): Promise<boolean> {
  const Haptics = await plugin("Haptics");
  if (!Haptics) return false;
  try {
    if (kind === "tap") await Haptics.impact({ style: "LIGHT" });
    else if (kind === "analyzing") await Haptics.selectionChanged();
    else if (kind === "success") await Haptics.notification({ type: "SUCCESS" });
    else await Haptics.notification({ type: "WARNING" });
    return true;
  } catch { return false; }
}

/* ─────────────────────── Push notifications ─────────────────────── */

let pushStarted = false;

/** Asks for permission (once) and sends the APNs device token to the server. */
export async function registerPush(getToken: () => Promise<string | null>) {
  if (pushStarted) return;
  const PushNotifications = await plugin("PushNotifications");
  if (!PushNotifications) return;
  pushStarted = true;
  try {
    await PushNotifications.addListener?.("registration", async (t: { value: string }) => {
      const auth = await getToken();
      if (!auth || !t?.value) return;
      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ token: t.value, platform: nativePlatform() }),
      }).catch(() => {});
    });
    // Tapping a push opens the page it points to
    await PushNotifications.addListener?.("pushNotificationActionPerformed", (a: any) => {
      const url = a?.notification?.data?.url;
      if (typeof url === "string" && url.startsWith("/")) window.location.href = url;
    });
    let perm = await PushNotifications.checkPermissions();
    if (perm?.receive === "prompt" || perm?.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm?.receive === "granted") await PushNotifications.register();
  } catch { /* plugin missing or push not configured yet */ }
}

/* ───────────────────────── OAuth in the app ───────────────────────── */

/** Opens the provider login in a secure Safari sheet (Google blocks in-app web views). */
export async function openNativeAuth(url: string): Promise<boolean> {
  const Browser = await plugin("Browser");
  if (!Browser) return false;
  try { await Browser.open({ url, presentationStyle: "popover" }); return true; } catch { return false; }
}

export async function closeNativeBrowser() {
  const Browser = await plugin("Browser");
  if (!Browser) return;
  try { await Browser.close(); } catch {}
}

/** Listens for com.usebanger.app://… links (auth callback, shortcuts). */
export function onAppUrlOpen(cb: (url: string) => void): () => void {
  if (!hasPlugin("App")) return () => {};
  let handle: { remove: () => void } | null = null;
  plugin("App").then((App) => App?.addListener?.("appUrlOpen", (e: { url: string }) => cb(e?.url || "")))
    .then((h: any) => { handle = h || null; }).catch(() => {});
  return () => { try { handle?.remove(); } catch {} };
}
