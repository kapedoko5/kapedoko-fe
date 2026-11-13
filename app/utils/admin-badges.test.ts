import { describe, expect, test } from 'bun:test'
import {
  BADGE_DEFAULT_COLOR,
  BADGE_DEFAULT_LUCIDE,
  BADGE_INK,
  BADGE_LUCIDE_ICONS,
  BADGE_STOCK,
  badgeAwardCafeCopy,
  badgeAwardLifecycle,
  badgeAwardWindowError,
  badgeIdFromRoute,
  badgeInkOn,
  badgeLabelError,
  badgeOverlapCopy,
  badgeSlugFromLabel,
  cafeBadgeFromName,
  isBadgeAwardActive,
  isBadgeColor,
  isBadgeId,
  isBadgeLucideId,
  normalizeBadgeColor,
  resolveBadgeLucideId,
} from './admin-badges'

const award = {
  enabled: true,
  cancelled_at: null as string | null,
  starts_at: '2026-11-01T00:00:00.000Z',
  ends_at: '2026-11-30T00:00:00.000Z',
}

describe('badge names', () => {
  test('slugs a label the same way the catalog trigger does', () => {
    expect(badgeSlugFromLabel('Hidden Gem')).toBe('hidden-gem')
    expect(badgeSlugFromLabel('Top 10 of the Month!')).toBe('top-10-of-the-month')
    expect(badgeSlugFromLabel('  --Hi--  ')).toBe('hi')
  })

  test('rejects blank or symbol-only names', () => {
    expect(badgeLabelError('')).toBe('Enter a badge name.')
    expect(badgeLabelError('G')).toBe('Use at least 2 characters.')
    expect(badgeLabelError('!!!')).toBe('Use a badge name with letters or numbers.')
  })

  test('reads a badge id from an Ionic hash route', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    expect(isBadgeId(id)).toBe(true)
    expect(badgeIdFromRoute(`/admin/badges/${id}`, 'nope')).toBe(id)
    expect(badgeIdFromRoute(`/#/admin/badges/${id}`)).toBe(id)
    expect(badgeIdFromRoute('/admin/cafes/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe('')
  })
})

describe('badge color and icon', () => {
  test('normalizes hex and rejects junk', () => {
    expect(normalizeBadgeColor('#1f6f6b')).toBe('#1F6F6B')
    expect(normalizeBadgeColor('d9793b')).toBe('#D9793B')
    expect(isBadgeColor('#1F6F6B')).toBe(true)
    expect(isBadgeColor('#fff')).toBe(false)
    expect(normalizeBadgeColor('nope')).toBe(BADGE_DEFAULT_COLOR)
  })

  test('puts ink on orange fills and cream on teal', () => {
    expect(badgeInkOn('#D9793B')).toBe(BADGE_INK)
    expect(badgeInkOn('#1F6F6B')).toBe(BADGE_STOCK)
    expect(badgeInkOn('#FAF8F5')).toBe(BADGE_INK)
  })

  test('falls unknown lucide names back to gem', () => {
    expect(BADGE_LUCIDE_ICONS.map((item) => item.id)).toContain('gem')
    expect(isBadgeLucideId('trophy')).toBe(true)
    expect(isBadgeLucideId('wand')).toBe(false)
    expect(resolveBadgeLucideId('nope')).toBe(BADGE_DEFAULT_LUCIDE)
    expect(cafeBadgeFromName({
      id: '1',
      slug: 'hidden-gem',
      label: 'Hidden Gem',
      color: '#1f6f6b',
      lucide_icon: 'wand',
      iconUrl: null,
    })).toMatchObject({
      color: '#1F6F6B',
      lucideIcon: 'gem',
      iconUrl: null,
    })
  })
})

describe('badge awards', () => {
  const now = new Date('2026-11-13T02:00:00.000Z')

  test('classifies live, scheduled, and ended windows', () => {
    expect(isBadgeAwardActive(award, now)).toBe(true)
    expect(badgeAwardLifecycle(award, now)).toBe('live')
    expect(badgeAwardLifecycle({ ...award, starts_at: '2026-12-01T00:00:00.000Z' }, now)).toBe('scheduled')
    expect(badgeAwardLifecycle({ ...award, cancelled_at: now.toISOString() }, now)).toBe('ended')
    expect(badgeAwardLifecycle({ ...award, enabled: false }, now)).toBe('ended')
  })

  test('requires an end after start and in the future', () => {
    expect(badgeAwardWindowError('2026-11-13T00:00:00.000Z', '2026-11-12T00:00:00.000Z', now)).toBe(
      'Choose an end date after the start date.',
    )
    expect(badgeAwardWindowError('2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', now)).toBe(
      'Choose an end time in the future.',
    )
    expect(badgeAwardWindowError('2026-11-13T00:00:00.000Z', '2026-12-01T00:00:00.000Z', now)).toBeNull()
  })

  test('names the cafe that already holds the badge', () => {
    expect(badgeOverlapCopy('Yardstick')).toBe('This badge already covers Yardstick in that window.')
    expect(badgeAwardCafeCopy(['Yardstick', 'TCA', 'Seattle'])).toBe('Yardstick, TCA +1')
    expect(badgeAwardCafeCopy(['Yardstick'])).toBe('Yardstick')
    expect(badgeAwardCafeCopy([])).toBe('No cafes')
  })
})
