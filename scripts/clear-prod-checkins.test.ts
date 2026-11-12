import { describe, expect, test } from 'bun:test'
import { CONFIRM_PHRASE } from './clear-prod-checkins'
import { parseArgs } from './prod-postgres'

describe('check-in confirm phrase', () => {
  test('deletes only when the check-in phrase is exact', () => {
    expect(CONFIRM_PHRASE).toBe('delete-prod-checkins')
    expect(parseArgs([], CONFIRM_PHRASE)).toEqual({ confirm: false })
    expect(() => parseArgs(['--confirm=delete-prod-reviews'], CONFIRM_PHRASE)).toThrow('Unknown flag --confirm=delete-prod-reviews.')
    expect(parseArgs([`--confirm=${CONFIRM_PHRASE}`], CONFIRM_PHRASE)).toEqual({ confirm: true })
  })
})
