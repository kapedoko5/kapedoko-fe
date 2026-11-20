import { describe, expect, test } from 'bun:test'
import {
  BUDGET_FRIENDLY_SLUG,
  VIBE_TAG_DEFAULT_COLOR,
  VIBE_TAG_DEFAULT_LUCIDE,
  VIBE_TAG_LUCIDE_ICONS,
  VIBE_TAG_MAX,
  assignedVibeTagIdsForPrice,
  cafePricePesoMarks,
  cafePriceTier,
  cafePriceTierLabel,
  cafeVibeTagFromName,
  formatMenuPricePhp,
  hiddenUserVibeTagCount,
  isVibeTagColor,
  isVibeTagId,
  isVibeTagLucideId,
  menuPriceError,
  normalizeVibeTagColor,
  parseMenuPricePhp,
  pickerVibeTags,
  resolveVibeTagLucideId,
  selectedUserVibeTagIds,
  shouldStampBudgetFriendly,
  vibeIdsWithoutBudgetFriendly,
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

describe('budget-friendly menu price stamp', () => {
  const tag = (
    id: string,
    slug: string,
    label: string,
    enabled = true,
  ) => ({
    id,
    slug,
    label,
    lucide_icon: 'leaf',
    color: '#2F6B4F',
    enabled,
    created_by: null,
    updated_by: null,
    created_at: '',
    updated_at: '',
  })
  const budget = tag('budget', BUDGET_FRIENDLY_SLUG, 'Budget-friendly')
  const quiet = tag('quiet', 'quiet', 'Quiet')
  const retired = tag('retired', 'retired', 'Retired', false)

  test('parses a typical peso amount and stamps below ₱100', () => {
    expect(menuPriceError('')).toBeNull()
    expect(menuPriceError('₱95')).toBeNull()
    expect(menuPriceError('0')).toMatch(/1 to 99,999/)
    expect(menuPriceError('12.5')).toMatch(/whole peso/)
    expect(parseMenuPricePhp('')).toBeNull()
    expect(parseMenuPricePhp('₱1,200')).toBe(1200)
    expect(formatMenuPricePhp(95)).toBe('95')
    expect(shouldStampBudgetFriendly(99)).toBe(true)
    expect(shouldStampBudgetFriendly(100)).toBe(false)
    expect(shouldStampBudgetFriendly(200)).toBe(false)
    expect(shouldStampBudgetFriendly(null)).toBe(false)
  })

  test('marks three peso tiers from Philippine cup prices', () => {
    expect(cafePriceTier(95)).toBe('budget')
    expect(cafePriceTier(100)).toBe('mid')
    expect(cafePriceTier(180)).toBe('mid')
    expect(cafePriceTier(185)).toBe('specialty')
    expect(cafePricePesoMarks(65)).toBe('₱')
    expect(cafePricePesoMarks(150)).toBe('₱₱')
    expect(cafePricePesoMarks(250)).toBe('₱₱₱')
    expect(cafePricePesoMarks(null)).toBe('')
    expect(cafePriceTierLabel(95)).toMatch(/₱1 to ₱99/)
    expect(cafePriceTierLabel(150)).toMatch(/₱100 to ₱184/)
    expect(cafePriceTierLabel(200)).toMatch(/₱185 and up/)
  })

  test('hides Budget-friendly from the picker and does not occupy a slot', () => {
    expect(pickerVibeTags([budget, quiet]).map((row) => row.id)).toEqual(['quiet'])
    expect(vibeIdsWithoutBudgetFriendly(['quiet', 'budget'], [budget, quiet])).toEqual(['quiet'])
    expect(selectedUserVibeTagIds(
      [{ tag_id: 'quiet' }, { tag_id: 'budget' }],
      [budget, quiet],
    )).toEqual(['quiet'])
    expect(hiddenUserVibeTagCount(
      [{ tag_id: 'retired' }, { tag_id: 'budget' }],
      [budget, quiet, retired],
    )).toBe(1)
    expect(assignedVibeTagIdsForPrice(['quiet'], [budget, quiet], 95)).toEqual(['quiet', 'budget'])
    expect(assignedVibeTagIdsForPrice(['quiet', 'budget'], [budget, quiet], 150)).toEqual(['quiet'])
    expect(assignedVibeTagIdsForPrice(
      ['quiet'],
      [budget, quiet],
      120,
      { budgetMaxPhp: 150, midMaxPhp: 250 },
    )).toEqual(['quiet', 'budget'])
    expect(vibeTagCountError(5)).toBeNull()
  })
})
