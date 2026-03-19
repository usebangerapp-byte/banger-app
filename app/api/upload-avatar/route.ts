import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const formData = await req.formData();

  const file = formData.get("file") as File;
  const userId = formData.get("userId") as string;

  if (!file || !userId) {
    return Response.json({ error: "Missing data" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.storage
    .from("bpro_uploads")
    .upload(`artwork/profile_${userId}.png`, file, {
      upsert: true,
    });

  if (error) {
    console.error(error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
