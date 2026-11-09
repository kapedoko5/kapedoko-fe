import { describe, expect, test } from 'bun:test'
import { confirmCallbackPath, parseConfirmLink } from './auth-confirm'

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
    expect(confirmCallbackPath('/reset-password/', { type: 'recovery', code: 'pkce-code' })).toBeNull()
    expect(confirmCallbackPath('/', {})).toBeNull()
    expect(confirmCallbackPath('/login', { redirect: '/app' })).toBeNull()
  })
})
