import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pushToUser } from "@/lib/server/apns";

/** Service-role client (server only). */
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Returns the logged-in user from an "Authorization: Bearer <token>" header, or null. */
export async function userFromRequest(sb: SupabaseClient, req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function displayName(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("profiles").select("display_name,email").eq("id", userId).maybeSingle();
  return data?.display_name || data?.email?.split("@")[0] || "Someone";
}

async function notificationsEnabled(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("profiles").select("notifs_enabled").eq("id", userId).maybeSingle();
  return data?.notifs_enabled !== false;
}

type Row = { user_id: string; type: string; message: string; track_title?: string | null; actor_id?: string | null };

/** Where a tap on the notification should lead. */
function linkFor(row: Row) {
  if (row.type === "message") return row.actor_id ? `/profile?tab=messages&with=${row.actor_id}` : "/profile?tab=messages";
  if (row.type === "follow" && row.actor_id) return `/dj/${row.actor_id}`;
  if (row.type === "promo_listened" || row.type === "promo_liked" || row.type === "promo_downloaded") return "/promo";
  if (row.type === "track_released" && row.track_title) return `/track?t=${encodeURIComponent(row.track_title)}`;
  if (row.type === "track_released") return "/charts";
  return "/home";
}

/** Phone push (iOS app) mirroring the in-app notification. No-op until APNs is configured. */
async function push(sb: SupabaseClient, row: Row) {
  await pushToUser(sb, row.user_id, {
    title: row.track_title || "BANGER",
    body: row.message,
    url: linkFor(row),
  }).catch(() => {});
}

/** Insert a notification. If the optional actor_id/count columns are missing, retries without them. */
async function insertNotification(sb: SupabaseClient, row: Row): Promise<string | null> {
  // Also fill the older "title"/"body" columns (title is NOT NULL in the live table).
  const full = { ...row, title: row.track_title || "BANGER", body: row.message, read: false, count: 1 };
  let { error } = await sb.from("notifications").insert([full]);
  if (error && /column/i.test(error.message)) {
    ({ error } = await sb.from("notifications").insert([{ ...row, read: false, count: 1 }]));
  }
  if (error && /column/i.test(error.message)) {
    const { actor_id, ...basic } = row;
    ({ error } = await sb.from("notifications").insert([{ ...basic, read: false }]));
  }
  if (error) {
    console.error("[notify] insert failed:", error.message);
    return error.message;
  }
  await push(sb, row);
  return null;
}

/** One-time notification per user and type (e.g. welcome). */
export async function notifyOnce(sb: SupabaseClient, userId: string, type: string, message: string, title?: string): Promise<string | null> {
  const { data, error } = await sb.from("notifications").select("id").eq("user_id", userId).eq("type", type).limit(1);
  if (error) return `read: ${error.message}`;
  if (data?.length) return null;
  const err = await insertNotification(sb, { user_id: userId, type, message, track_title: title || null });
  return err ? `insert: ${err}` : null;
}

/** New message: one unread notification per sender, with a running count. */
export async function notifyMessage(sb: SupabaseClient, receiverId: string, senderId: string) {
  if (receiverId === senderId || !(await notificationsEnabled(sb, receiverId))) return;
  const name = await displayName(sb, senderId);

  const { data: existing, error } = await sb.from("notifications")
    .select("id,count").eq("user_id", receiverId).eq("type", "message")
    .eq("actor_id", senderId).eq("read", false).limit(1);

  if (!error && existing?.length) {
    const n = (existing[0].count || 1) + 1;
    await sb.from("notifications").update({
      count: n, message: `${n} new messages`, track_title: name, created_at: new Date().toISOString(),
    }).eq("id", existing[0].id);
    await push(sb, { user_id: receiverId, type: "message", actor_id: senderId, track_title: name, message: `${n} new messages` });
    return;
  }
  await insertNotification(sb, {
    user_id: receiverId, type: "message", actor_id: senderId, track_title: name, message: "Sent you a message",
  });
}

/** New follower (skips duplicates while the previous one is still unread). */
export async function notifyFollow(sb: SupabaseClient, followedId: string, followerId: string) {
  if (followedId === followerId || !(await notificationsEnabled(sb, followedId))) return;
  const { data: existing, error } = await sb.from("notifications")
    .select("id").eq("user_id", followedId).eq("type", "follow")
    .eq("actor_id", followerId).eq("read", false).limit(1);
  if (!error && existing?.length) return;
  const name = await displayName(sb, followerId);
  await insertNotification(sb, {
    user_id: followedId, type: "follow", actor_id: followerId, track_title: name, message: "Started following you",
  });
}

/** A DJ opened and played a private promo for the first time → tell the producer. */
export async function notifyPromoListened(sb: SupabaseClient, senderId: string, listenerId: string, trackTitle: string) {
  if (senderId === listenerId || !(await notificationsEnabled(sb, senderId))) return;
  const name = await displayName(sb, listenerId);
  await insertNotification(sb, {
    user_id: senderId, type: "promo_listened", actor_id: listenerId, track_title: name,
    message: `Listened to "${trackTitle}"`,
  });
}

/** A DJ liked a private promo → tell the producer. */
export async function notifyPromoLiked(sb: SupabaseClient, senderId: string, likerId: string, trackTitle: string) {
  if (senderId === likerId || !(await notificationsEnabled(sb, senderId))) return;
  const name = await displayName(sb, likerId);
  await insertNotification(sb, {
    user_id: senderId, type: "promo_liked", actor_id: likerId, track_title: name,
    message: `Liked "${trackTitle}" ♥`,
  });
}

/** A DJ downloaded a private promo → tell the producer. */
export async function notifyPromoDownloaded(sb: SupabaseClient, senderId: string, dlId: string, trackTitle: string) {
  if (senderId === dlId || !(await notificationsEnabled(sb, senderId))) return;
  const name = await displayName(sb, dlId);
  await insertNotification(sb, {
    user_id: senderId, type: "promo_downloaded", actor_id: dlId, track_title: name,
    message: `Downloaded "${trackTitle}" ⬇`,
  });
}

export const WELCOME_TITLE = "Welcome to BANGER 🎧";
export const WELCOME_MESSAGE = "Scan any track, follow the IDs you love, and get notified the day they drop.";

/**
 * A followed track is out: notify everyone following it (once per user and track).
 * Called by manual release (set-release), the MusicBrainz check and the Friday refresh.
 */
export async function notifyTrackReleased(sb: SupabaseClient, title: string, artist?: string | null) {
  const t = (title || "").trim();
  if (!t) return;
  const pattern = t.replace(/[%_\\]/g, (m) => "\\" + m); // exact, case-insensitive match
  const { data: followers } = await sb.from("track_followers").select("user_id").ilike("track_title", pattern);
  const ids = [...new Set((followers || []).map((f: any) => f.user_id).filter(Boolean))];
  for (const userId of ids) {
    if (!(await notificationsEnabled(sb, userId))) continue;
    const { data: already } = await sb.from("notifications").select("id")
      .eq("user_id", userId).eq("type", "track_released").ilike("track_title", pattern).limit(1);
    if (already?.length) continue;
    await insertNotification(sb, {
      user_id: userId, type: "track_released", track_title: t,
      message: artist ? `${artist} — out now. Tap to listen.` : "Out now. Tap to listen.",
    });
  }
}
