import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const token = process.env.ACR_CONSOLE_TOKEN
  const bucketId = process.env.ACR_BUCKET_ID

  if (!token || !bucketId) {
    return NextResponse.json(
      { ok: false, error: "Missing ACR env" },
      { status: 500 }
    )
  }

  const form = await req.formData()
  const file = form.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file received" },
      { status: 400 }
    )
  }

  const upload = new FormData()
  upload.append("file", file)
  upload.append("title", file.name)
  upload.append("data_type", "audio")

  const acrRes = await fetch(
    `https://api-v2.acrcloud.com/api/buckets/${bucketId}/files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: upload,
    }
  )

  const text = await acrRes.text()

  let acr: any = null
  try {
    acr = JSON.parse(text)
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid ACR response", raw: text },
      { status: 502 }
    )
  }

  const acrId = acr?.data?.id

  if (!acrRes.ok || !acrId) {
    return NextResponse.json(
      { ok: false, error: acr?.message || "ACR upload failed", acr },
      { status: 502 }
    )
  }

  const { error } = await supabase
    .from("unreleased_tracks")
    .insert({
      title: file.name,
      artist: "unknown",
      label: "unknown",
      bucket_id: bucketId,
      acr_id: String(acrId),
    })

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    acr_id: String(acrId),
    bucket_id: bucketId,
    acr,
  })
}
