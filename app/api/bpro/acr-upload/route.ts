import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const token = process.env.ACR_CONSOLE_TOKEN
    const bucketId = process.env.ACR_BUCKET_ID

    if (!token || !bucketId) {
      return NextResponse.json(
        { ok: false, error: 'Missing ACR env' },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const title = String(formData.get('title') || '').trim()

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'Missing file' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const acrForm = new FormData()
    acrForm.append(
      'file',
      new Blob([buffer], { type: file.type || 'application/octet-stream' }),
      file.name || 'upload.bin'
    )
    acrForm.append('title', title || file.name || 'upload')
    acrForm.append('data_type', 'audio')

    const acrRes = await fetch(
      `https://api-v2.acrcloud.com/api/buckets/${bucketId}/files`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: acrForm,
      }
    )

    const text = await acrRes.text()
    const acr = safeJson(text)

    if (!acrRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            (acr && typeof acr === 'object' && 'error' in acr && typeof acr.error === 'string'
              ? acr.error
              : 'ACR upload failed'),
          acr,
          preview: acr ? undefined : text.slice(0, 300),
        },
        { status: 500 }
      )
    }

    const item = Array.isArray(acr?.data) ? acr.data[0] : acr?.data

    return NextResponse.json({
      ok: true,
      acr_id: item?.acr_id || item?.id || null,
      acr_state: item?.state ?? null,
      acr,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
