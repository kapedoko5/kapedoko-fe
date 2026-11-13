import { describe, expect, test } from 'bun:test'
import {
  AUTH_EMAIL_STORAGE_KEY,
  AUTH_REDIRECT_STORAGE_KEY,
  AUTH_NATIVE_SESSION_KEY,
  authEmailRedirectTo,
  authProvider,
  authUserId,
  clearNativeAuthSession,
  consumeAuthRedirect,
  displayNameError,
  displayNameFromAuthUser,
  emailError,
  friendlyAuthError,
  isAuthUserBanned,
  isCheckInRedirect,
  isGoogleAuthUser,
  isSafeAppPath,
  localSessionShouldClear,
  LOGIN_LEDE_CHECK_IN,
  LOGIN_LEDE_DEFAULT,
  loginLedeForRedirect,
  passwordError,
  peekAuthEmail,
  REGISTER_LEDE_CHECK_IN,
  registerLedeForRedirect,
  rememberAuthEmail,
  rememberAuthRedirect,
  safeRedirectPath,
  shouldDeferSessionCheck,
  shouldDropLocalSession,
  shouldOfferGoogleAuth,
  type AuthMemory,
} from './auth'

function memory(initial: Record<string, string> = {}): AuthMemory {
  const data = { ...initial }
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

describe('auth helpers', () => {
  test('reads a user id from either claim', () => {
    expect(authUserId({ id: 'user-1' })).toBe('user-1')
    expect(authUserId({ sub: 'user-2' })).toBe('user-2')
    expect(authUserId(null)).toBeNull()
  })

  test('validates email and password without echoing secrets', () => {
    expect(emailError('')).toBe('Enter your email.')
    expect(emailError('not-an-email')).toMatch(/email/)
    expect(emailError('you@example.com')).toBeNull()
    expect(passwordError('short')).toMatch(/8/)
    expect(passwordError('longenough')).toBeNull()
    expect(displayNameError('   ')).toMatch(/name/)
    expect(displayNameError('A'.repeat(41))).toMatch(/40/)
    expect(displayNameError('Cy')).toBeNull()
  })

  test('allows only in-app return paths', () => {
    expect(isSafeAppPath('/app')).toBe(true)
    expect(isSafeAppPath('/app/favorites')).toBe(true)
    expect(isSafeAppPath('/app/cafes/abc/review?from=map')).toBe(true)
    expect(isSafeAppPath('/admin')).toBe(true)
    expect(isSafeAppPath('/admin/cafes/new')).toBe(true)
    expect(isSafeAppPath('/')).toBe(false)
    expect(isSafeAppPath('/?next=1')).toBe(false)
    expect(isSafeAppPath('/confirm')).toBe(false)
    expect(isSafeAppPath('//evil.example')).toBe(false)
    expect(isSafeAppPath('/\\evil')).toBe(false)
    expect(isSafeAppPath('https://evil.example')).toBe(false)
    expect(isSafeAppPath('/login')).toBe(false)
    expect(safeRedirectPath('/')).toBe('/app')
    expect(safeRedirectPath('//evil.example')).toBe('/app')
    expect(safeRedirectPath('/app/cafes/abc/review')).toBe('/app/cafes/abc/review')
    expect(safeRedirectPath('/app/cafes/abc/check-in?level=quiet')).toBe('/app/cafes/abc/check-in?level=quiet')
    expect(safeRedirectPath(undefined, '/app/profile')).toBe('/app/profile')
    expect(isCheckInRedirect('/app/cafes/abc/check-in?level=busy')).toBe(true)
    expect(isCheckInRedirect('/app/cafes/abc/review')).toBe(false)
    expect(loginLedeForRedirect('/app/cafes/abc/check-in')).toBe(LOGIN_LEDE_CHECK_IN)
    expect(loginLedeForRedirect('/app/profile')).toBe(LOGIN_LEDE_DEFAULT)
    expect(registerLedeForRedirect('/app/cafes/abc/check-in')).toBe(REGISTER_LEDE_CHECK_IN)
  })

  test('builds https callback urls for auth emails', () => {
    expect(authEmailRedirectTo('http://kapedoko.com', '/confirm')).toBe('https://kapedoko.com/confirm')
    expect(authEmailRedirectTo('https://www.kapedoko.com', '/reset-password')).toBe(
      'https://www.kapedoko.com/reset-password',
    )
    expect(authEmailRedirectTo('http://localhost:3000', '/confirm')).toBe('http://localhost:3000/confirm')
    expect(authEmailRedirectTo('capacitor://localhost', '/confirm')).toBeUndefined()
    expect(authEmailRedirectTo('not a url', '/confirm')).toBeUndefined()
  })

  test('maps auth failures to recovery copy', () => {
    expect(friendlyAuthError('Invalid login credentials')).toMatch(/not right/)
    expect(friendlyAuthError('Email not confirmed')).toMatch(/Confirm your email/)
    expect(friendlyAuthError('User already registered')).toMatch(/already exists/)
    expect(friendlyAuthError('Failed to fetch')).toMatch(/connection/)
    expect(friendlyAuthError('PKCE code verifier not found in storage')).toMatch(/expired/)
    expect(friendlyAuthError('Unsupported provider: provider is not enabled')).toMatch(/Google/)
    expect(friendlyAuthError('something unexpected')).not.toMatch(/something unexpected/)
  })

  test('stores a safe return path until it is consumed', () => {
    const store = memory()
    rememberAuthRedirect('/login', store)
    expect(store.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBeNull()
    rememberAuthRedirect('/app/cafes/abc/check-in', store)
    expect(store.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBe('/app/cafes/abc/check-in')
    expect(consumeAuthRedirect('/app/favorites', store)).toBe('/app/favorites')
    expect(store.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBeNull()
    rememberAuthRedirect('/app/cafes/abc/check-in', store)
    expect(consumeAuthRedirect('/login', store)).toBe('/app/cafes/abc/check-in')
    expect(consumeAuthRedirect(undefined, store)).toBe('/app')
  })

  test('keeps the signup email for a later resend', () => {
    const store = memory()
    rememberAuthEmail('not-an-email', store)
    expect(peekAuthEmail(store)).toBe('')
    rememberAuthEmail('you@example.com', store)
    expect(store.getItem(AUTH_EMAIL_STORAGE_KEY)).toBe('you@example.com')
    expect(peekAuthEmail(store)).toBe('you@example.com')
  })

  test('offers Google only on the website', () => {
    expect(shouldOfferGoogleAuth(false)).toBe(true)
    expect(shouldOfferGoogleAuth(true)).toBe(false)
    expect(authProvider({ app_metadata: { provider: 'google' } })).toBe('google')
    expect(isGoogleAuthUser({ app_metadata: { provider: 'google' } })).toBe(true)
    expect(isGoogleAuthUser({ app_metadata: { provider: 'email' } })).toBe(false)
  })

  test('reads a Google public name from auth metadata', () => {
    expect(displayNameFromAuthUser({ user_metadata: { full_name: 'Ana Cruz' } })).toBe('Ana Cruz')
    expect(displayNameFromAuthUser({ user_metadata: { name: 'Ana Cruz', full_name: 'Ana Cruz' } })).toBe('Ana Cruz')
    expect(displayNameFromAuthUser({ user_metadata: { display_name: 'KapéBean', full_name: 'Ana Cruz' } })).toBe('KapéBean')
    expect(displayNameFromAuthUser({ user_metadata: { given_name: 'Ana' } })).toBe('Ana')
    expect(displayNameFromAuthUser({ user_metadata: { full_name: `A${'n'.repeat(50)}` } }).length).toBe(40)
    expect(displayNameFromAuthUser({ user_metadata: { display_name: '  ' } })).toBe('')
    expect(
      displayNameFromAuthUser({
        identities: [{ identity_data: { full_name: 'Ana Cruz', name: 'Ana Cruz' } }],
      }),
    ).toBe('Ana Cruz')
  })

  test('drops a leftover session when Auth no longer has the user', () => {
    expect(shouldDropLocalSession({ message: 'User from sub claim in JWT does not exist' })).toBe(true)
    expect(shouldDropLocalSession({ code: 'user_not_found' })).toBe(true)
    expect(shouldDropLocalSession({ code: 'user_banned' })).toBe(true)
    expect(shouldDropLocalSession({ message: 'Auth session missing!' })).toBe(false)
    expect(shouldDropLocalSession({ message: 'Failed to fetch' })).toBe(false)
    expect(isAuthUserBanned({ banned_until: '2099-01-01T00:00:00.000Z' })).toBe(true)
    expect(isAuthUserBanned({ banned_until: '2001-01-01T00:00:00.000Z' })).toBe(false)
    expect(localSessionShouldClear({ hasLocalSession: true, remoteUser: null, error: { code: 'user_not_found' } })).toBe(true)
    expect(localSessionShouldClear({ hasLocalSession: true, remoteUser: null, error: null })).toBe(true)
    expect(localSessionShouldClear({ hasLocalSession: true, remoteUser: { id: 'user-1' }, error: null })).toBe(false)
    expect(localSessionShouldClear({
      hasLocalSession: true,
      remoteUser: null,
      error: { message: 'Failed to fetch' },
    })).toBe(false)
    expect(shouldDeferSessionCheck('https://www.kapedoko.com/confirm?code=abc')).toBe(true)
    expect(shouldDeferSessionCheck('https://www.kapedoko.com/app')).toBe(false)
    const store = memory({ [AUTH_NATIVE_SESSION_KEY]: '{"access_token":"x"}' })
    clearNativeAuthSession(store)
    expect(store.getItem(AUTH_NATIVE_SESSION_KEY)).toBeNull()
  })
})
