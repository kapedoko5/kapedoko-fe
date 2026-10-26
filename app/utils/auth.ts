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
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Could not reach KapeDoko. Check your connection and try again.'
  }
  if (text.includes('expired') || text.includes('invalid') && text.includes('token')) {
    return 'This link expired. Request a new one.'
  }
  return 'Could not finish that. Check the details and try again.'
}
