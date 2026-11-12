import { describe, expect, test } from 'bun:test'
import {
  AUTH_CALLBACK_SNAPSHOT_KEY,
  confirmCallbackPath,
  parseConfirmLink,
  parseConfirmLocation,
  readAuthCallbackSnapshot,
  shouldVerifyConfirmIntent,
  snapshotAuthCallback,
} from './auth-confirm'

describe('confirm link parser', () => {
  test('reads a token hash from the query', () => {
    expect(parseConfirmLink({ query: { token_hash: 'abc', type: 'signup' } })).toEqual({
      kind: 'otp',
      tokenHash: 'abc',
      type: 'signup',
    })
    expect(parseConfirmLink({ query: { token_hash: ['hashed'], type: ['email'] } })).toEqual({
      kind: 'otp',
      tokenHash: 'hashed',
      type: 'email',
    })
  })

  test('defaults an unknown otp type to signup', () => {
    expect(parseConfirmLink({ query: { token_hash: 'abc', type: 'not-a-type' } })).toEqual({
      kind: 'otp',
      tokenHash: 'abc',
      type: 'signup',
    })
  })

  test('reads a pkce code from the query or the hash', () => {
    expect(parseConfirmLink({ query: { code: 'pkce-code' } })).toEqual({
      kind: 'code',
      code: 'pkce-code',
    })
    expect(parseConfirmLink({ hash: '#access_token=tok&refresh_token=ref' })).toEqual({
      kind: 'session',
      accessToken: 'tok',
      refreshToken: 'ref',
    })
    expect(parseConfirmLink({ hash: '#/confirm?code=from-hash' })).toEqual({
      kind: 'code',
      code: 'from-hash',
    })
  })

  test('maps supabase error params without echoing the raw description', () => {
    const intent = parseConfirmLink({
      query: {
        error: 'access_denied',
        error_code: 'otp_expired',
        error_description: 'Email link is invalid or has expired',
      },
    })
    expect(intent.kind).toBe('error')
    if (intent.kind !== 'error') return
    expect(intent.message).toMatch(/expired/)
    expect(intent.message).not.toMatch(/Email link is invalid/)
  })

  test('treats a bare confirm visit as empty', () => {
    expect(parseConfirmLink({ query: {} })).toEqual({ kind: 'empty' })
    expect(parseConfirmLink({ query: { redirect: '/app' } })).toEqual({ kind: 'empty' })
  })

  test('reads a token from the live search string when the router query is empty', () => {
    expect(
      parseConfirmLink({
        query: {},
        search: '?token_hash=from-search&type=signup',
      }),
    ).toEqual({
      kind: 'otp',
      tokenHash: 'from-search',
      type: 'signup',
    })
  })

  test('reads a token from the confirm or reset path', () => {
    expect(parseConfirmLink({ pathname: '/confirm/path-token' })).toEqual({
      kind: 'otp',
      tokenHash: 'path-token',
      type: 'signup',
    })
    expect(parseConfirmLink({ pathname: '/reset-password/reset-token' })).toEqual({
      kind: 'otp',
      tokenHash: 'reset-token',
      type: 'recovery',
    })
  })

  test('uses a captured href after the router drops the query', () => {
    expect(
      parseConfirmLocation({
        query: {},
        href: 'https://www.kapedoko.com/confirm?token_hash=kept&type=signup',
      }),
    ).toEqual({
      kind: 'otp',
      tokenHash: 'kept',
      type: 'signup',
    })
  })

  test('snapshots an auth callback so a later strip can still verify', () => {
    const store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem(key) {
        return data[key] ?? null
      },
      setItem(key, value) {
        data[key] = String(value)
      },
      removeItem(key) {
        delete data[key]
      },
    }
    const data: Record<string, string> = {}
    snapshotAuthCallback('https://www.kapedoko.com/confirm?token_hash=snap&type=signup', store)
    expect(store.getItem(AUTH_CALLBACK_SNAPSHOT_KEY)).toBeTruthy()
    const snap = readAuthCallbackSnapshot(store)
    expect(
      parseConfirmLocation({
        query: {},
        href: 'https://www.kapedoko.com/confirm',
        snapshot: snap,
      }),
    ).toEqual({
      kind: 'otp',
      tokenHash: 'snap',
      type: 'signup',
    })
  })

  test('verifies a present token even when a session already exists', () => {
    expect(shouldVerifyConfirmIntent({ kind: 'otp', tokenHash: 'abc', type: 'signup' })).toBe(true)
    expect(shouldVerifyConfirmIntent({ kind: 'code', code: 'pkce-code' })).toBe(true)
    expect(shouldVerifyConfirmIntent({ kind: 'session', accessToken: 'tok', refreshToken: 'ref' })).toBe(true)
    expect(shouldVerifyConfirmIntent({ kind: 'empty' })).toBe(false)
    expect(shouldVerifyConfirmIntent({ kind: 'error', message: 'This link expired. Request a new one.' })).toBe(false)
  })
})

describe('confirm callback routing', () => {
  test('sends homepage auth callbacks to the confirm page', () => {
    expect(confirmCallbackPath('/', { code: 'pkce-code' })).toBe('/confirm')
    expect(confirmCallbackPath('/', { token_hash: 'abc', type: 'signup' })).toBe('/confirm')
    expect(confirmCallbackPath('/', { error: 'access_denied', error_code: 'otp_expired' })).toBe('/confirm')
    expect(confirmCallbackPath('/app', { code: 'pkce-code' })).toBe('/confirm')
    expect(confirmCallbackPath('/', new URLSearchParams('code=pkce-code'))).toBe('/confirm')
  })

  test('sends recovery callbacks to the reset page', () => {
    expect(confirmCallbackPath('/', { token_hash: 'abc', type: 'recovery' })).toBe('/reset-password')
    expect(confirmCallbackPath('/', { code: 'pkce-code', type: 'recovery' })).toBe('/reset-password')
    expect(confirmCallbackPath('/forgot-password', { code: 'pkce-code' })).toBe('/reset-password')
    expect(confirmCallbackPath('/forgot-password', { token_hash: 'abc', type: 'recovery' })).toBe('/reset-password')
    expect(confirmCallbackPath('/forgot-password', { redirect: '/app' })).toBeNull()
  })

  test('leaves confirm and reset pages in place', () => {
    expect(confirmCallbackPath('/confirm', { code: 'pkce-code' })).toBeNull()
    expect(confirmCallbackPath('/confirm/path-token', {})).toBeNull()
    expect(confirmCallbackPath('/reset-password/', { type: 'recovery', code: 'pkce-code' })).toBeNull()
    expect(confirmCallbackPath('/reset-password/reset-token', {})).toBeNull()
    expect(confirmCallbackPath('/', {})).toBeNull()
    expect(confirmCallbackPath('/login', { redirect: '/app' })).toBeNull()
  })
})
