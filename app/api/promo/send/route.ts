import { adminClient, userFromRequest, notifyMessage } from "@/lib/server/notify";
import { isPro } from "@/lib/server/pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function token() {
  return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
}

// POST { title, artist, note, file_path, recipients: string[] }
export async function POST(req: Request) {
  const sb = adminClient();
  const user = await userFromRequest(sb, req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!(await isPro(sb, user.id))) return Response.json({ ok: false, error: "Pro only" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim().slice(0, 140);
  const artist = String(b.artist || "").trim().slice(0, 140);
  const note = String(b.note || "").trim().slice(0, 300);
  const filePath = String(b.file_path || "");
  const recipients: string[] = Array.from(new Set((Array.isArray(b.recipients) ? b.recipients : []).map(String)))
    .filter((id) => id && id !== user.id).slice(0, 50);

  if (!title || !filePath.startsWith(`${user.id}/`) || recipients.length === 0) {
    return Response.json({ ok: false, error: "Missing title, file or recipients" }, { status: 400 });
  }

  const { data: promo, error } = await sb.from("promo_sends")
    .insert([{ sender_id: user.id, title, artist: artist || null, note: note || null, file_path: filePath }])
    .select("id").single();
  if (error || !promo) return Response.json({ ok: false, error: error?.message || "Insert failed" }, { status: 500 });

  const rows = recipients.map((rid) => ({ promo_id: promo.id, recipient_id: rid, token: token() }));
  const { error: rErr } = await sb.from("promo_recipients").insert(rows);
  if (rErr) return Response.json({ ok: false, error: rErr.message }, { status: 500 });

  const origin = new URL(req.url).origin;
  const label = artist ? `${artist} - ${title}` : title;
  for (const r of rows) {
    const content = `🔒 Private track: ${label} — ${origin}/listen/${r.token}${note ? `\n${note}` : ""}`;
    await sb.from("messages").insert([{ sender_id: user.id, receiver_id: r.recipient_id, content }]);
    await notifyMessage(sb, r.recipient_id, user.id).catch(() => {});
  }
  return Response.json({ ok: true, id: promo.id, sent: rows.length });
}
