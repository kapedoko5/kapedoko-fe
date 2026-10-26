import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'

const LOGO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const BANNER_MAX_BYTES = 4 * 1024 * 1024
const AUDIT_PHOTO_MAX_BYTES = 4 * 1024 * 1024

type UploadPurpose = 'shop-logo' | 'ad-banner' | 'audit-photo'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface R2Config {
  accountId: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBase: string
}

interface AuthUser {
  id: string
  jwt: string
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function r2Endpoint(config: R2Config, objectKey: string): string {
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${objectKey}`
}

function publicUrl(config: R2Config, objectKey: string): string | null {
  return config.publicBase
    ? `${config.publicBase.replace(/\/$/, '')}/${objectKey}`
    : null
}

function r2Client(config: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: 'auto',
    service: 's3',
  })
}

function readR2Config(): R2Config | null {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const bucket = Deno.env.get('R2_BUCKET')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const publicBase = Deno.env.get('R2_PUBLIC_BASE_URL') ?? ''

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return null
  }

  return { accountId, bucket, accessKeyId, secretAccessKey, publicBase }
}

function parsePurpose(value: unknown): UploadPurpose {
  if (value === 'ad-banner') return 'ad-banner'
  if (value === 'audit-photo') return 'audit-photo'
  return 'shop-logo'
}

async function authenticate(req: Request): Promise<Response | AuthUser> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return json(401, { error: 'Sign in to upload a logo.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnon) {
    return json(500, { error: 'Upload is not configured.' })
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: supabaseAnon,
    },
  })

  if (!userRes.ok) {
    return json(401, { error: 'Sign in to upload a logo.' })
  }

  const user = (await userRes.json()) as { id?: string }
  if (!user.id) {
    return json(401, { error: 'Sign in to upload a logo.' })
  }

  return { id: user.id, jwt }
}

async function profileRole(auth: AuthUser): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnon) return null
  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${auth.id}&select=role`,
    {
      headers: {
        Authorization: `Bearer ${auth.jwt}`,
        apikey: supabaseAnon,
        Accept: 'application/json',
      },
    },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ role?: string }>
  return rows[0]?.role ?? null
}

async function isAdmin(auth: AuthUser): Promise<boolean> {
  return (await profileRole(auth)) === 'admin'
}

async function isAuditor(auth: AuthUser): Promise<boolean> {
  const role = await profileRole(auth)
  return role === 'admin' || role === 'auditor'
}

function validateImageMeta(
  purpose: UploadPurpose,
  contentType: string,
  size: number,
): { ext: string } | { error: string } {
  const ext = LOGO_TYPES[contentType]
  if (!ext) {
    return { error: 'Use a JPG, PNG, or WebP image.' }
  }
  const max = purpose === 'shop-logo' ? LOGO_MAX_BYTES : purpose === 'ad-banner' ? BANNER_MAX_BYTES : AUDIT_PHOTO_MAX_BYTES
  if (!Number.isFinite(size) || size <= 0 || size > max) {
    return {
      error: purpose === 'ad-banner' || purpose === 'audit-photo'
        ? 'Keep the photo under 4 MB.'
        : 'Keep the logo under 2 MB.',
    }
  }
  return { ext }
}

function r2UploadError(status: number, purpose: UploadPurpose): string {
  const noun = purpose === 'ad-banner' ? 'Banner' : purpose === 'audit-photo' ? 'Photo' : 'Logo'
  if (status === 403) {
    return `${noun} upload credentials are invalid. Check R2 secrets on presign-upload.`
  }
  if (status === 404) {
    return `${noun} upload bucket was not found. Check the R2_BUCKET secret.`
  }
  return `The ${noun.toLowerCase()} didn’t upload. Try again later.`
}

async function uploadToR2(
  config: R2Config,
  userId: string,
  purpose: UploadPurpose,
  contentType: string,
  ext: string,
  body: ArrayBuffer,
): Promise<Response> {
  const folder = purpose === 'ad-banner' ? 'ad-banners' : purpose === 'audit-photo' ? 'audit-photos' : 'shop-logos'
  const objectKey = `${folder}/${userId}/${crypto.randomUUID()}.${ext}`
  const endpoint = r2Endpoint(config, objectKey)
  const client = r2Client(config)

  const signed = await client.sign(
    new Request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    }),
    { aws: { signQuery: true } },
  )

  const upload = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  })

  if (!upload.ok) {
    const detail = await upload.text().catch(() => '')
    console.error('R2 upload failed', upload.status, detail)
    return json(502, { error: r2UploadError(upload.status, purpose) })
  }

  return json(200, { objectKey, publicUrl: publicUrl(config, objectKey) })
}

async function handleMultipartUpload(
  req: Request,
  auth: AuthUser,
  config: R2Config,
): Promise<Response> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json(400, { error: 'Expected multipart form with a file field.' })
  }

  const purpose = parsePurpose(form.get('purpose'))
  if (purpose === 'ad-banner' && !(await isAdmin(auth))) {
    return json(403, { error: 'Admin only' })
  }
  if (purpose === 'audit-photo' && !(await isAuditor(auth))) {
    return json(403, { error: 'Auditor only' })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return json(400, { error: purpose === 'ad-banner' ? 'Attach a banner image to upload.' : 'Attach a logo image to upload.' })
  }

  const validation = validateImageMeta(purpose, file.type, file.size)
  if ('error' in validation) {
    return json(400, { error: validation.error })
  }

  const body = await file.arrayBuffer()
  return uploadToR2(config, auth.id, purpose, file.type, validation.ext, body)
}

const ADMIN_ASSET_KEY = /^(shop-logos|ad-banners|audit-photos)\/[A-Za-z0-9][A-Za-z0-9/_.:-]*$/
const ADMIN_ASSET_KEY_LIMIT = 80

function uniqueDeletableObjectKeys(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const seen = new Set<string>()
  const keys: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const key = item.trim().replace(/^\/+/, '')
    if (!key || !ADMIN_ASSET_KEY.test(key) || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
    if (keys.length >= ADMIN_ASSET_KEY_LIMIT) break
  }
  return keys
}

async function deleteFromR2(config: R2Config, objectKey: string): Promise<boolean> {
  const endpoint = r2Endpoint(config, objectKey)
  const signed = await r2Client(config).sign(
    new Request(endpoint, { method: 'DELETE' }),
    { aws: { signQuery: true } },
  )
  const res = await fetch(signed.url, { method: 'DELETE' })
  return res.ok || res.status === 404
}

async function handleDeleteObjects(
  auth: AuthUser,
  config: R2Config | null,
  objectKeys: unknown,
): Promise<Response> {
  if (!(await isAdmin(auth))) {
    return json(403, { error: 'Admin only' })
  }
  const keys = uniqueDeletableObjectKeys(objectKeys)
  if (keys.length === 0) {
    return json(200, { ok: true, deleted: [] })
  }
  if (!config) {
    return json(200, { ok: true, skipped: true, deleted: [] })
  }
  const deleted: string[] = []
  for (const key of keys) {
    try {
      if (await deleteFromR2(config, key)) deleted.push(key)
    } catch (err) {
      console.error('R2 delete failed', key, err)
    }
  }
  return json(200, { ok: true, deleted })
}

async function handlePresignRequest(
  req: Request,
  auth: AuthUser,
  config: R2Config | null,
): Promise<Response> {
  let payload: { action?: string; objectKeys?: unknown; contentType?: string; size?: number; purpose?: string }
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: 'Expected JSON with contentType and size.' })
  }

  if (payload.action === 'delete-objects') {
    return handleDeleteObjects(auth, config, payload.objectKeys)
  }

  if (!config) {
    return json(503, { error: 'Logo upload isn’t available yet.' })
  }

  const purpose = parsePurpose(payload.purpose)
  if (purpose === 'ad-banner' && !(await isAdmin(auth))) {
    return json(403, { error: 'Admin only' })
  }
  if (purpose === 'audit-photo' && !(await isAuditor(auth))) {
    return json(403, { error: 'Auditor only' })
  }

  const contentType = String(payload.contentType ?? '')
  const size = Number(payload.size ?? 0)
  const validation = validateImageMeta(purpose, contentType, size)
  if ('error' in validation) {
    return json(400, { error: validation.error })
  }

  const folder = purpose === 'ad-banner' ? 'ad-banners' : purpose === 'audit-photo' ? 'audit-photos' : 'shop-logos'
  const objectKey = `${folder}/${auth.id}/${crypto.randomUUID()}.${validation.ext}`
  const endpoint = r2Endpoint(config, objectKey)
  const signed = await r2Client(config).sign(
    new Request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    }),
    { aws: { signQuery: true } },
  )

  return json(200, {
    uploadUrl: signed.url,
    objectKey,
    publicUrl: publicUrl(config, objectKey),
  })
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const auth = await authenticate(req)
  if (auth instanceof Response) return auth

  const config = readR2Config()
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    if (!config) {
      return json(503, { error: 'Logo upload isn’t available yet.' })
    }
    return handleMultipartUpload(req, auth, config)
  }

  return handlePresignRequest(req, auth, config)
})
