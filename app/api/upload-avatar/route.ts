import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const userId = String(formData.get("userId") || "").trim();

  if (!file || !userId) {
    return Response.json({ error: "Missing data" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return Response.json({ error: "Missing auth token" }, { status: 401 });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (authData.user.id !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createClient(url, serviceKey);

  const { error } = await admin.storage
    .from("bpro_uploads")
    .upload(`artwork/profile_${userId}.png`, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (error) {
    console.error(error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
