import { adminClient, userFromRequest, notifyPromoListened, notifyPromoLiked, notifyPromoDownloaded, notifyMessage } from "@/lib/server/notify";
import { VERDICTS, TAGS_SOUND, TAGS_ASK, isVerdict, type Verdict } from "@/lib/feedback";
import { PROMO_BUCKET } from "@/lib/server/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(sb: ReturnType<typeof adminClient>, token: string) {
  const { data: rec } = await sb.from("promo_recipients")
    .select("*").eq("token", token).maybeSingle();
  if (!rec) return null;
  const { data: promo } = await sb.from("promo_sends")
    .select("id,sender_id,title,artist,note,file_path").eq("id", rec.promo_id).maybeSingle();
  return promo ? { rec, promo } : null;
}

// GET ?token= → track info + a short-lived signed audio URL (only for the recipient or the sender)
export async function GET(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Sign in to listen" }, { status: 401 });
  const token = new URL(req.url).searchParams.get("token") || "";
  const found = await load(sb, token);
  if (!found) return Response.json({ ok: false, error: "Link not found" }, { status: 404 });
  const { rec, promo } = found;
  if (user.id !== rec.recipient_id && user.id !== promo.sender_id) {
    return Response.json({ ok: false, error: "This private link was sent to someone else" }, { status: 403 });
  }
  const { data: signed } = await sb.storage.from(PROMO_BUCKET).createSignedUrl(promo.file_path, 60 * 60 * 2);
  const { data: sender } = await sb.from("profiles").select("display_name,avatar_url").eq("id", promo.sender_id).maybeSingle();
  return Response.json({
    ok: true, title: promo.title, artist: promo.artist, note: promo.note,
    sender: { id: promo.sender_id, name: sender?.display_name || "A producer", avatar: sender?.avatar_url || null },
    url: signed?.signedUrl || null,
    liked: !!(rec as any).liked_at, isRecipient: user.id === rec.recipient_id,
    feedback: (rec as any).verdict ? { verdict: (rec as any).verdict, tags: (rec as any).feedback_tags || [], note: (rec as any).feedback_note || "" } : null,
  });
}

// POST { token } → the recipient pressed play (marks it listened + counts plays)
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const input = await req.json().catch(() => ({}));
  const { token, action, like } = input;
  const found = await load(sb, String(token || ""));
  if (!found || found.rec.recipient_id !== user.id) return Response.json({ ok: true });

  // Download: a short-lived link that saves the file, + tell the producer the first time
  if (action === "download") {
    const ext = (found.promo.file_path.split(".").pop() || "mp3").toLowerCase();
    const name = `${found.promo.artist ? `${found.promo.artist} - ` : ""}${found.promo.title}`.replace(/[\\/:*?"<>|]+/g, " ").trim() + `.${ext}`;
    const { data: signed, error } = await sb.storage.from(PROMO_BUCKET).createSignedUrl(found.promo.file_path, 600, { download: name });
    if (error || !signed) return Response.json({ ok: false, error: error?.message || "No link" }, { status: 500 });
    const rec: any = found.rec;
    await sb.from("promo_recipients").update({ downloaded_at: rec.downloaded_at || new Date().toISOString(), downloads: (rec.downloads || 0) + 1 }).eq("id", rec.id);
    if (!rec.downloaded_at) await notifyPromoDownloaded(sb, found.promo.sender_id, user.id, found.promo.title).catch(() => {});
    return Response.json({ ok: true, url: signed.signedUrl });
  }

  // Feedback: verdict + quick tags + note → saved on the promo, and posted in the conversation
  if (action === "feedback") {
    if (!isVerdict(input.verdict)) return Response.json({ ok: false, error: "Pick a verdict" }, { status: 400 });
    const allowed = new Set([...TAGS_SOUND, ...TAGS_ASK]);
    const tags: string[] = (Array.isArray(input.tags) ? input.tags : []).filter((t: any) => allowed.has(t)).slice(0, 10);
    const note = String(input.note || "").trim().slice(0, 600);
    const { error } = await sb.from("promo_recipients").update({
      verdict: input.verdict, feedback_tags: tags, feedback_note: note || null, feedback_at: new Date().toISOString(),
    }).eq("id", found.rec.id);
    if (error) return Response.json({ ok: false, error: /column/i.test(error.message) ? "Run the feedback SQL first" : error.message }, { status: 500 });
    const v = VERDICTS[input.verdict as Verdict];
    const label = found.promo.artist ? `${found.promo.artist} - ${found.promo.title}` : found.promo.title;
    const content = [`${v.emoji} ${v.label} — "${label}"`, tags.length ? tags.join(" · ") : "", note ? `“${note}”` : ""].filter(Boolean).join("\n");
    await sb.from("messages").insert([{ sender_id: user.id, receiver_id: found.promo.sender_id, content }]);
    await notifyMessage(sb, found.promo.sender_id, user.id).catch(() => {});
    return Response.json({ ok: true });
  }

  // Like / unlike (double-tap or heart)
  if (action === "like") {
    const was = !!(found.rec as any).liked_at;
    const { error } = await sb.from("promo_recipients").update({ liked_at: like === false ? null : new Date().toISOString() }).eq("id", found.rec.id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    if (like !== false && !was) await notifyPromoLiked(sb, found.promo.sender_id, user.id, found.promo.title).catch(() => {});
    return Response.json({ ok: true });
  }

  await sb.from("promo_recipients").update({
    listened_at: found.rec.listened_at || new Date().toISOString(),
    plays: (found.rec.plays || 0) + 1,
  }).eq("id", found.rec.id);
  if (!found.rec.listened_at) {
    await notifyPromoListened(sb, found.promo.sender_id, user.id, found.promo.title).catch(() => {});
  }
  return Response.json({ ok: true });
}
