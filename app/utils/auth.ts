const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function authUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null
  const record = user as { id?: unknown; sub?: unknown }
  if (typeof record.id === 'string' && record.id) return record.id
  if (typeof record.sub === 'string' && record.sub) return record.sub
  return null
}

export function emailError(value: string): string | null {
  const email = value.trim()
  if (!email) return 'Enter your email.'
  if (!EMAIL_RE.test(email)) return 'Enter an email like you@example.com.'
  return null
}

export function passwordError(value: string): string | null {
  if (!value) return 'Enter a password.'
  if (value.length < 8) return 'Use at least 8 characters.'
  return null
}

export function displayNameError(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Enter the name other KapéBeans should see.'
  if (name.length > 40) return 'Keep your name under 40 characters.'
  return null
}

export function isSafeAppPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false
  if (path.includes('\\') || path.includes('://')) return false
  const pathname = path.split(/[?#]/, 1)[0] ?? ''
  if (pathname === '/') return false
  if (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register' ||
    pathname.startsWith('/register/') ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/forgot-password/')
  ) {
    return false
  }
  // Only in-app destinations (plus admin, which already uses redirect= after login).
  if (pathname === '/app' || pathname.startsWith('/app/')) return true
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  return false
}

export function safeRedirectPath(path: unknown, fallback = '/app'): string {
  if (typeof path !== 'string') return fallback
  const trimmed = path.trim()
  return isSafeAppPath(trimmed) ? trimmed : fallback
}

export const AUTH_REDIRECT_STORAGE_KEY = 'kapedoko-auth-redirect'
export const AUTH_EMAIL_STORAGE_KEY = 'kapedoko-auth-email'
export const AUTH_NATIVE_SESSION_KEY = 'kapedoko-auth-session'

export type AuthMemory = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultAuthMemory(): AuthMemory | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function rememberAuthRedirect(path: unknown, storage: AuthMemory | null = defaultAuthMemory()): void {
  if (!storage) return
  const next = typeof path === 'string' ? path.trim() : ''
  if (!isSafeAppPath(next)) {
    storage.removeItem(AUTH_REDIRECT_STORAGE_KEY)
    return
  }
  storage.setItem(AUTH_REDIRECT_STORAGE_KEY, next)
}

export function consumeAuthRedirect(
  queryRedirect: unknown,
  storage: AuthMemory | null = defaultAuthMemory(),
): string {
  const fromQuery = typeof queryRedirect === 'string' ? queryRedirect.trim() : ''
  const fromStore = storage?.getItem(AUTH_REDIRECT_STORAGE_KEY) ?? ''
  storage?.removeItem(AUTH_REDIRECT_STORAGE_KEY)
  if (isSafeAppPath(fromQuery)) return fromQuery
  return safeRedirectPath(fromStore)
}

export function rememberAuthEmail(email: string, storage: AuthMemory | null = defaultAuthMemory()): void {
  if (!storage) return
  const next = email.trim()
  if (emailError(next)) {
    storage.removeItem(AUTH_EMAIL_STORAGE_KEY)
    return
  }
  storage.setItem(AUTH_EMAIL_STORAGE_KEY, next)
}

export function peekAuthEmail(storage: AuthMemory | null = defaultAuthMemory()): string {
  const stored = storage?.getItem(AUTH_EMAIL_STORAGE_KEY) ?? ''
  return emailError(stored) ? '' : stored
}

export function authProvider(user: unknown): string {
  if (!user || typeof user !== 'object') return ''
  const record = user as { app_metadata?: { provider?: unknown } | null }
  const provider = record.app_metadata?.provider
  return typeof provider === 'string' ? provider.toLowerCase() : ''
}

export function isGoogleAuthUser(user: unknown): boolean {
  return authProvider(user) === 'google'
}

const AUTH_NAME_KEYS = ['display_name', 'full_name', 'name', 'given_name'] as const

function displayNameFromMeta(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return ''
  const record = meta as Record<string, unknown>
  for (const key of AUTH_NAME_KEYS) {
    const value = record[key]
    if (typeof value !== 'string') continue
    const name = value.trim()
    if (!name) continue
    return name.length > 40 ? name.slice(0, 40) : name
  }
  return ''
}

export function displayNameFromAuthUser(user: unknown): string {
  if (!user || typeof user !== 'object') return ''
  const record = user as { user_metadata?: unknown; identities?: unknown }
  const fromMeta = displayNameFromMeta(record.user_metadata)
  if (fromMeta) return fromMeta
  if (!Array.isArray(record.identities)) return ''
  for (const identity of record.identities) {
    if (!identity || typeof identity !== 'object') continue
    const fromIdentity = displayNameFromMeta((identity as { identity_data?: unknown }).identity_data)
    if (fromIdentity) return fromIdentity
  }
  return ''
}

export function shouldOfferGoogleAuth(isNative: boolean): boolean {
  return !isNative
}

/** HTTPS callback for auth emails. Localhost keeps its own protocol and port. */
export function authEmailRedirectTo(
  origin: string,
  path: '/confirm' | '/reset-password' = '/confirm',
): string | undefined {
  try {
    const url = new URL(origin)
    if (url.protocol === 'capacitor:' || url.protocol === 'ionic:') return undefined
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return `${url.protocol}//${url.host}${path}`
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return `https://${url.host}${path}`
  } catch {
    return undefined
  }
}

export const LOGIN_LEDE_DEFAULT = 'Sign in to check in, leave reviews, and keep saves under your name.'
export const LOGIN_LEDE_CHECK_IN = 'Sign in to check in. Other KapéBeans will see how packed this cafe is.'
export const REGISTER_LEDE_DEFAULT = 'Your name is what other KapéBeans see on a review.'
export const REGISTER_LEDE_CHECK_IN = 'Your name is what other KapéBeans see. After you create an account, we will bring you back to finish the check-in.'

export function isCheckInRedirect(path: unknown): boolean {
  if (typeof path !== 'string') return false
  const pathname = path.split(/[?#]/, 1)[0] ?? ''
  return /\/app\/cafes\/[^/]+\/check-in\/?$/.test(pathname)
}

export function loginLedeForRedirect(path: unknown): string {
  return isCheckInRedirect(path) ? LOGIN_LEDE_CHECK_IN : LOGIN_LEDE_DEFAULT
}

export function registerLedeForRedirect(path: unknown): string {
  return isCheckInRedirect(path) ? REGISTER_LEDE_CHECK_IN : REGISTER_LEDE_DEFAULT
}

export function friendlyAuthError(message?: string): string {
  const text = (message ?? '').toLowerCase()
  if (text.includes('invalid login') || text.includes('invalid credentials')) {
    return 'That email or password is not right.'
  }
  if (text.includes('email not confirmed')) {
    return 'Confirm your email, then sign in.'
  }
  if (text.includes('already registered') || text.includes('already been registered') || text.includes('user already')) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (text.includes('password') && (text.includes('weak') || text.includes('at least') || text.includes('short'))) {
    return 'Use at least 8 characters.'
  }
  if (text.includes('rate') || text.includes('too many')) {
    return 'Wait a moment, then try again.'
  }
  if (text.includes('provider is not enabled') || text.includes('unsupported provider')) {
    return 'Could not continue with Google. Try email instead.'
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Could not reach KapeDoko. Check your connection and try again.'
  }
  if (
    text.includes('expired')
    || text.includes('code verifier')
    || (text.includes('invalid') && text.includes('token'))
  ) {
    return 'This link expired. Request a new one.'
  }
  return 'Could not finish that. Check the details and try again.'
}

export type AuthRemoteError = {
  message?: string
  code?: string
  name?: string
  status?: number
}

export function isAuthUserBanned(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const record = user as { banned_until?: unknown; bannedUntil?: unknown }
  const until = record.banned_until ?? record.bannedUntil
  if (typeof until !== 'string' || !until) return false
  const at = Date.parse(until)
  return Number.isFinite(at) && at > Date.now()
}

export function shouldDropLocalSession(error: AuthRemoteError | null | undefined): boolean {
  if (!error) return false
  const code = (error.code ?? '').toLowerCase().replace(/-/g, '_')
  if (
    code === 'user_not_found'
    || code === 'session_not_found'
    || code === 'refresh_token_not_found'
    || code === 'user_banned'
    || code === 'bad_jwt'
    || code === 'invalid_jwt'
  ) {
    return true
  }
  const text = (error.message ?? '').toLowerCase()
  if (!text) return false
  if (text.includes('auth session missing') || text.includes('failed to fetch') || text.includes('network')) {
    return false
  }
  return (
    text.includes('user from sub claim')
    || text.includes('user not found')
    || text.includes('user does not exist')
    || text.includes('session not found')
    || text.includes('refresh token not found')
    || text.includes('invalid refresh token')
    || text.includes('user is banned')
    || text.includes('user has been banned')
    || text.includes('user banned')
  )
}

export function localSessionShouldClear(input: {
  hasLocalSession: boolean
  remoteUser: unknown
  error?: AuthRemoteError | null
}): boolean {
  if (!input.hasLocalSession) return false
  if (isAuthUserBanned(input.remoteUser)) return true
  if (input.remoteUser) return false
  if (shouldDropLocalSession(input.error)) return true
  return !input.error
}

export function shouldDeferSessionCheck(href: string): boolean {
  try {
    const url = new URL(href)
    if (url.searchParams.has('code') || url.searchParams.has('token_hash')) return true
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
    const hashParams = new URLSearchParams(hash)
    return hashParams.has('access_token') || hashParams.has('refresh_token')
  } catch {
    return false
  }
}

export function clearNativeAuthSession(storage: AuthMemory | null): void {
  storage?.removeItem(AUTH_NATIVE_SESSION_KEY)
}
