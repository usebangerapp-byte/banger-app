import { adminClient, userFromRequest } from "@/lib/server/notify";
import { ADMIN_EMAILS } from "@/lib/admins";

const ADMINS = (process.env.ADMIN_EMAILS || ADMIN_EMAILS.join(",")).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Returns the signed-in admin, or null. */
export async function adminFromRequest(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user || !ADMINS.includes(String(user.email || "").toLowerCase())) return { sb, user: null };
  return { sb, user };
}
