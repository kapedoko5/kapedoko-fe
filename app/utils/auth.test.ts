import { describe, expect, test } from 'bun:test'
import {
  authUserId,
  displayNameError,
  emailError,
  friendlyAuthError,
  isCheckInRedirect,
  isSafeAppPath,
  LOGIN_LEDE_CHECK_IN,
  LOGIN_LEDE_DEFAULT,
  loginLedeForRedirect,
  passwordError,
  REGISTER_LEDE_CHECK_IN,
  registerLedeForRedirect,
  safeRedirectPath,
} from './auth'

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

  test('maps auth failures to recovery copy', () => {
    expect(friendlyAuthError('Invalid login credentials')).toMatch(/not right/)
    expect(friendlyAuthError('Email not confirmed')).toMatch(/Confirm your email/)
    expect(friendlyAuthError('User already registered')).toMatch(/already exists/)
    expect(friendlyAuthError('Failed to fetch')).toMatch(/connection/)
    expect(friendlyAuthError('something unexpected')).not.toMatch(/something unexpected/)
  })
})
