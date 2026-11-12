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

export function parseConfirmLink(input: {
  query?: Record<string, unknown> | URLSearchParams
  hash?: string
}): ConfirmLinkIntent {
  const query = queryRecord(input.query ?? {})
  const hashParams = hashSearch(input.hash ?? '')

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

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

export function confirmCallbackPath(
  pathname: string,
  query?: Record<string, unknown> | URLSearchParams,
  hash = '',
): ConfirmCallbackPath | null {
  const current = normalizePathname(pathname)
  if (current === '/confirm' || current === '/reset-password') return null

  const intent = parseConfirmLink({ query, hash })
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
