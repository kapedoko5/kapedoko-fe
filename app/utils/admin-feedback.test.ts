import { describe, expect, test } from 'bun:test'
import {
  ADMIN_TOAST_LIMIT,
  adminActionErrorMessage,
  adminToastDuration,
  adminToastLive,
  adminToastMessage,
  isAdminToastVariant,
} from './admin-feedback'

describe('admin feedback', () => {
  test('recognises the four toast variants', () => {
    expect(isAdminToastVariant('success')).toBe(true)
    expect(isAdminToastVariant('error')).toBe(true)
    expect(isAdminToastVariant('info')).toBe(true)
    expect(isAdminToastVariant('warning')).toBe(true)
    expect(isAdminToastVariant('danger')).toBe(false)
  })

  test('keeps failures on screen longer than success', () => {
    expect(adminToastDuration('error')).toBeGreaterThan(adminToastDuration('warning'))
    expect(adminToastDuration('warning')).toBeGreaterThan(adminToastDuration('success'))
    expect(adminToastDuration('info')).toBe(adminToastDuration('success'))
  })

  test('announces failures immediately and success politely', () => {
    expect(adminToastLive('error')).toBe('assertive')
    expect(adminToastLive('warning')).toBe('assertive')
    expect(adminToastLive('success')).toBe('polite')
    expect(adminToastLive('info')).toBe('polite')
  })

  test('reads an Error, a string, or the fallback', () => {
    expect(adminActionErrorMessage(new Error('  rpc failed  '), 'Saved nothing.')).toBe('rpc failed')
    expect(adminActionErrorMessage('  offline  ', 'Saved nothing.')).toBe('offline')
    expect(adminActionErrorMessage(null, 'Saved nothing.')).toBe('Saved nothing.')
  })

  test('collapses whitespace and truncates long toast copy', () => {
    expect(adminToastMessage('  Could   not   save  ')).toBe('Could not save')
    expect(adminToastMessage('abcdef', 4)).toBe('abc…')
    expect(ADMIN_TOAST_LIMIT).toBe(4)
  })
})
