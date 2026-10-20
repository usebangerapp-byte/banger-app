import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

/** Insert a notification. If the optional actor_id/count columns are missing, retries without them. */
async function insertNotification(sb: SupabaseClient, row: Row) {
  const full = { ...row, read: false, count: 1 };
  const { error } = await sb.from("notifications").insert([full]);
  if (error && /column/i.test(error.message)) {
    const { actor_id, ...basic } = row;
    await sb.from("notifications").insert([{ ...basic, read: false }]);
  }
}

/** One-time notification per user and type (e.g. welcome). */
export async function notifyOnce(sb: SupabaseClient, userId: string, type: string, message: string, title?: string) {
  const { data } = await sb.from("notifications").select("id").eq("user_id", userId).eq("type", type).limit(1);
  if (data?.length) return;
  await insertNotification(sb, { user_id: userId, type, message, track_title: title || null });
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

export const WELCOME_TITLE = "Welcome to BANGER 🎧";
export const WELCOME_MESSAGE = "Scan any track, follow the IDs you love, and get notified the day they drop.";
