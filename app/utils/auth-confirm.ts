import { friendlyAuthError } from './auth'

const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const

export type EmailConfirmType = (typeof EMAIL_OTP_TYPES)[number]

export type ConfirmLinkIntent =
  | { kind: 'otp'; tokenHash: string; type: EmailConfirmType }
  | { kind: 'code'; code: string }
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }

export type ConfirmCallbackPath = '/confirm' | '/reset-password'

function firstAuthParam(value: unknown): string {
  if (Array.isArray(value)) return firstAuthParam(value[0])
  if (typeof value !== 'string') return ''
  return value.trim()
}

function isEmailConfirmType(value: string): value is EmailConfirmType {
  return (EMAIL_OTP_TYPES as readonly string[]).includes(value)
}

function queryRecord(query: Record<string, unknown> | URLSearchParams): Record<string, unknown> {
  if (query instanceof URLSearchParams) return Object.fromEntries(query.entries())
  return query
}

function hashSearch(hash: string): URLSearchParams {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  if (!trimmed) return new URLSearchParams()
  const queryIndex = trimmed.indexOf('?')
  const source = queryIndex >= 0 ? trimmed.slice(queryIndex + 1) : trimmed
  if (!source.includes('=')) return new URLSearchParams()
  return new URLSearchParams(source)
}

function typeFrom(query: Record<string, unknown>, hashParams: URLSearchParams): string {
  return (firstAuthParam(query.type) || hashParams.get('type') || '').toLowerCase()
}

export const AUTH_CALLBACK_SNAPSHOT_KEY = 'kapedoko-auth-callback'

export type AuthCallbackSnapshot = {
  search: string
  hash: string
  pathname: string
}

type AuthMemory = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function searchRecord(search: string): Record<string, unknown> {
  const trimmed = search.startsWith('?') ? search.slice(1) : search
  if (!trimmed) return {}
  return Object.fromEntries(new URLSearchParams(trimmed).entries())
}

function mergeAuthQuery(
  query?: Record<string, unknown> | URLSearchParams,
  search?: string,
): Record<string, unknown> {
  const fromSearch = search ? searchRecord(search) : {}
  const fromQuery = queryRecord(query ?? {})
  const merged = { ...fromSearch, ...fromQuery }
  for (const key of ['token_hash', 'code', 'type', 'error', 'error_code', 'error_description', 'access_token', 'refresh_token']) {
    if (!firstAuthParam(merged[key]) && firstAuthParam(fromSearch[key])) {
      merged[key] = fromSearch[key]
    }
  }
  return merged
}

function tokenFromPath(pathname: string): { tokenHash: string; type: EmailConfirmType } | null {
  const path = normalizePathname(pathname)
  const confirmMatch = path.match(/^\/confirm\/([^/]+)$/)
  if (confirmMatch?.[1]) {
    return { tokenHash: decodeURIComponent(confirmMatch[1]), type: 'signup' }
  }
  const resetMatch = path.match(/^\/reset-password\/([^/]+)$/)
  if (resetMatch?.[1]) {
    return { tokenHash: decodeURIComponent(resetMatch[1]), type: 'recovery' }
  }
  return null
}

export function isAuthCallbackPath(pathname: string): boolean {
  const path = normalizePathname(pathname)
  return path === '/confirm' || path.startsWith('/confirm/') || path === '/reset-password' || path.startsWith('/reset-password/')
}

export function parseConfirmLink(input: {
  query?: Record<string, unknown> | URLSearchParams
  hash?: string
  search?: string
  pathname?: string
}): ConfirmLinkIntent {
  const query = mergeAuthQuery(input.query, input.search)
  const hashParams = hashSearch(input.hash ?? '')
  const pathToken = tokenFromPath(input.pathname ?? '')
  if (pathToken && !firstAuthParam(query.token_hash)) {
    query.token_hash = pathToken.tokenHash
    if (!firstAuthParam(query.type) && !hashParams.get('type')) {
      query.type = pathToken.type
    }
  }

  const error = firstAuthParam(query.error) || hashParams.get('error') || ''
  if (error) {
    const description =
      firstAuthParam(query.error_description) ||
      hashParams.get('error_description') ||
      firstAuthParam(query.error_code) ||
      error
    return { kind: 'error', message: friendlyAuthError(description) }
  }

  const tokenHash = firstAuthParam(query.token_hash) || hashParams.get('token_hash') || ''
  if (tokenHash) {
    const rawType = typeFrom(query, hashParams) || 'signup'
    return {
      kind: 'otp',
      tokenHash,
      type: isEmailConfirmType(rawType) ? rawType : 'signup',
    }
  }

  const code = firstAuthParam(query.code) || hashParams.get('code') || ''
  if (code) return { kind: 'code', code }

  const accessToken = hashParams.get('access_token') || firstAuthParam(query.access_token)
  const refreshToken = hashParams.get('refresh_token') || firstAuthParam(query.refresh_token)
  if (accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken }
  }

  return { kind: 'empty' }
}

export function shouldVerifyConfirmIntent(intent: ConfirmLinkIntent): boolean {
  return intent.kind === 'otp' || intent.kind === 'code' || intent.kind === 'session'
}

export function parseConfirmLocation(input: {
  query?: Record<string, unknown> | URLSearchParams
  hash?: string
  pathname?: string
  token?: unknown
  href?: string
  snapshot?: AuthCallbackSnapshot | null
}): ConfirmLinkIntent {
  const query = queryRecord(input.query ?? {})
  const routeToken = firstAuthParam(input.token)
  if (routeToken && !firstAuthParam(query.token_hash)) query.token_hash = routeToken

  const candidates: ConfirmLinkIntent[] = []
  if (input.href) {
    try {
      const url = new URL(input.href)
      candidates.push(
        parseConfirmLink({
          query,
          hash: url.hash || input.hash,
          search: url.search,
          pathname: url.pathname || input.pathname,
        }),
      )
    } catch {
      // Use the route fields below.
    }
  }
  if (input.snapshot) {
    candidates.push(
      parseConfirmLink({
        query,
        hash: input.snapshot.hash || input.hash,
        search: input.snapshot.search,
        pathname: input.snapshot.pathname || input.pathname,
      }),
    )
  }
  candidates.push(
    parseConfirmLink({
      query,
      hash: input.hash,
      pathname: input.pathname,
    }),
  )

  for (const intent of candidates) {
    if (intent.kind !== 'empty') return intent
  }
  return { kind: 'empty' }
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

export function snapshotAuthCallback(
  href: string,
  storage: AuthMemory | null,
): void {
  if (!storage) return
  try {
    const url = new URL(href, 'https://www.kapedoko.com')
    const intent = parseConfirmLink({
      query: url.searchParams,
      hash: url.hash,
      search: url.search,
      pathname: url.pathname,
    })
    if (intent.kind === 'empty') return
    const snapshot: AuthCallbackSnapshot = {
      search: url.search,
      hash: url.hash,
      pathname: url.pathname,
    }
    storage.setItem(AUTH_CALLBACK_SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    return
  }
}

export function readAuthCallbackSnapshot(storage: AuthMemory | null): AuthCallbackSnapshot | null {
  const raw = storage?.getItem(AUTH_CALLBACK_SNAPSHOT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AuthCallbackSnapshot
    if (!parsed || typeof parsed !== 'object') return null
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      hash: typeof parsed.hash === 'string' ? parsed.hash : '',
      pathname: typeof parsed.pathname === 'string' ? parsed.pathname : '',
    }
  } catch {
    return null
  }
}

export function clearAuthCallbackSnapshot(storage: AuthMemory | null): void {
  storage?.removeItem(AUTH_CALLBACK_SNAPSHOT_KEY)
}

export function confirmCallbackPath(
  pathname: string,
  query?: Record<string, unknown> | URLSearchParams,
  hash = '',
): ConfirmCallbackPath | null {
  const current = normalizePathname(pathname)
  if (isAuthCallbackPath(current)) return null

  const intent = parseConfirmLink({ query, hash, pathname: current })
  if (intent.kind === 'empty') return null

  const rawType = typeFrom(queryRecord(query ?? {}), hashSearch(hash))
  if (
    current === '/forgot-password'
    || rawType === 'recovery'
    || (intent.kind === 'otp' && intent.type === 'recovery')
  ) {
    return '/reset-password'
  }
  return '/confirm'
}
