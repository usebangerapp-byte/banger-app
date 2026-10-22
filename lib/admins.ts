/** BANGER admins (dashboard + editing tracks in every list). The server re-checks with ADMIN_EMAILS. */
export const ADMIN_EMAILS = ["chokrymusic@gmail.com", "usebangerapp@gmail.com"];
export const isAdminEmail = (e?: string | null) => ADMIN_EMAILS.includes(String(e || "").toLowerCase().trim());
