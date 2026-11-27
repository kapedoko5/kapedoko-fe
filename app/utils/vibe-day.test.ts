import { describe, expect, test } from 'bun:test'
import { cafeHasAnyVibe, localDayKey, parseVibeDayPick, pruneVibeIds, serializeVibeDayPick } from './vibe-day'

describe('vibe day pick', () => {
  test('round-trips within the same day', () => {
    const raw = serializeVibeDayPick(['a', 'b'], '2026-11-27')
    expect(parseVibeDayPick(raw, '2026-11-27')).toEqual(['a', 'b'])
  })
  test('drops a pick from another day', () => {
    const raw = serializeVibeDayPick(['a'], '2026-11-26')
    expect(parseVibeDayPick(raw, '2026-11-27')).toEqual([])
  })
  test('ignores malformed storage', () => {
    expect(parseVibeDayPick('nope', '2026-11-27')).toEqual([])
    expect(parseVibeDayPick(null, '2026-11-27')).toEqual([])
    expect(parseVibeDayPick('{"day":"2026-11-27","tagIds":[1,"x",""]}', '2026-11-27')).toEqual(['x'])
  })
  test('prunes ids missing from the catalog', () => {
    expect(pruneVibeIds(['a', 'z'], ['a', 'b'])).toEqual(['a'])
  })
  test('matches any picked vibe, and everything when none picked', () => {
    expect(cafeHasAnyVibe(['a'], [])).toBe(true)
    expect(cafeHasAnyVibe(['a', 'c'], ['b', 'c'])).toBe(true)
    expect(cafeHasAnyVibe(['a'], ['b'])).toBe(false)
  })
  test('formats the local day key', () => {
    expect(localDayKey(new Date(2026, 10, 7))).toBe('2026-11-07')
  })
})
