import { describe, expect, test } from 'bun:test'
import {
  VIBE_TAG_DEFAULT_COLOR,
  VIBE_TAG_DEFAULT_LUCIDE,
  VIBE_TAG_LUCIDE_ICONS,
  VIBE_TAG_MAX,
  cafeVibeTagFromName,
  isVibeTagColor,
  isVibeTagId,
  isVibeTagLucideId,
  normalizeVibeTagColor,
  resolveVibeTagLucideId,
  vibeTagCountError,
  vibeTagIdFromRoute,
  vibeTagLabelError,
  vibeTagPickerCount,
  vibeTagSlugFromLabel,
} from './admin-vibe-tags'

describe('vibe tag names', () => {
  test('slugs a label the same way the catalog trigger does', () => {
    expect(vibeTagSlugFromLabel('Quiet Corner')).toBe('quiet-corner')
    expect(vibeTagSlugFromLabel('Lively!')).toBe('lively')
    expect(vibeTagSlugFromLabel('  --Hi--  ')).toBe('hi')
  })

  test('rejects blank or symbol-only names', () => {
    expect(vibeTagLabelError('')).toBe('Enter a vibe tag name.')
    expect(vibeTagLabelError('Q')).toBe('Use at least 2 characters.')
    expect(vibeTagLabelError('!!!')).toBe('Use a vibe tag with letters or numbers.')
  })

  test('reads a vibe tag id from an Ionic hash route', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    expect(isVibeTagId(id)).toBe(true)
    expect(vibeTagIdFromRoute(`/admin/vibe-tags/${id}`, 'nope')).toBe(id)
    expect(vibeTagIdFromRoute(`/#/admin/vibe-tags/${id}`)).toBe(id)
    expect(vibeTagIdFromRoute('/admin/badges/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe('')
  })
})

describe('vibe tag icons and caps', () => {
  test('falls unknown lucide names back to coffee', () => {
    expect(VIBE_TAG_LUCIDE_ICONS.map((item) => item.id)).toContain('coffee')
    expect(isVibeTagLucideId('volume-x')).toBe(true)
    expect(isVibeTagLucideId('wand')).toBe(false)
    expect(resolveVibeTagLucideId('nope')).toBe(VIBE_TAG_DEFAULT_LUCIDE)
    expect(cafeVibeTagFromName({
      id: '1',
      slug: 'quiet',
      label: 'Quiet',
      lucide_icon: 'wand',
    })).toMatchObject({
      lucideIcon: VIBE_TAG_DEFAULT_LUCIDE,
      color: VIBE_TAG_DEFAULT_COLOR,
    })
  })

  test('normalizes stamp color and rejects junk', () => {
    expect(normalizeVibeTagColor('#1f6f6b')).toBe('#1F6F6B')
    expect(normalizeVibeTagColor('d9793b')).toBe('#D9793B')
    expect(isVibeTagColor('#D9793B')).toBe(true)
    expect(isVibeTagColor('#fff')).toBe(false)
    expect(normalizeVibeTagColor('nope')).toBe(VIBE_TAG_DEFAULT_COLOR)
  })

  test('caps assignments at five including hidden disabled stamps', () => {
    expect(vibeTagCountError(5)).toBeNull()
    expect(vibeTagCountError(6)).toBe(`Keep vibe tags to ${VIBE_TAG_MAX}.`)
    expect(vibeTagCountError(4, 2)).toBe(`Keep vibe tags to ${VIBE_TAG_MAX}. 2 disabled stamps still count.`)
    expect(vibeTagPickerCount(3, 1)).toBe('4 of 5')
  })
})
