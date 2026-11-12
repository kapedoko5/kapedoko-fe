import { describe, expect, test } from 'bun:test'
import {
  isOwnerToastVariant,
  ownerActionErrorMessage,
  ownerToastDuration,
  ownerToastLive,
  ownerToastMessage,
} from './owner-feedback'

describe('owner feedback', () => {
  test('recognises the four toast variants', () => {
    expect(isOwnerToastVariant('success')).toBe(true)
    expect(isOwnerToastVariant('danger')).toBe(false)
  })

  test('keeps failures on screen longer than success', () => {
    expect(ownerToastDuration('error')).toBeGreaterThan(ownerToastDuration('warning'))
    expect(ownerToastDuration('warning')).toBeGreaterThan(ownerToastDuration('success'))
  })

  test('announces failures immediately', () => {
    expect(ownerToastLive('error')).toBe('assertive')
    expect(ownerToastLive('success')).toBe('polite')
  })

  test('reads an Error, a string, or the fallback', () => {
    expect(ownerActionErrorMessage(new Error('  rpc failed  '), 'Saved nothing.')).toBe('rpc failed')
    expect(ownerActionErrorMessage(null, 'Saved nothing.')).toBe('Saved nothing.')
  })

  test('collapses whitespace on toast copy', () => {
    expect(ownerToastMessage('  Could   not   save  ')).toBe('Could not save')
  })
})
