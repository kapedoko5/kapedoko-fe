import { describe, expect, test } from 'bun:test'
import {
  CAFE_THEME_APPLY_MAX,
  CAFE_THEME_STOCK_HEX,
  cafeThemeCafeError,
  cafeThemeContrast,
  cafeThemeDraftError,
  cafeThemeHexError,
  cafeThemeLede,
  ownerCafeThemeLede,
  ownerCafeThemeLockedCopy,
  ownerCafeThemeNoCafesCopy,
  cafeThemeOnButton,
  cafeThemeShopIds,
  cafeThemeStyle,
  formatCafeThemeHex,
  missingCafeThemeSqlCopy,
  parseCafeThemeHex,
} from './cafe-theme'

describe('cafe theme hex', () => {
  test('empty values mean KapéDoko defaults', () => {
    expect(parseCafeThemeHex(null)).toBeNull()
    expect(parseCafeThemeHex('')).toBeNull()
    expect(parseCafeThemeHex('   ')).toBeNull()
    expect(formatCafeThemeHex('')).toBe('')
    expect(cafeThemeHexError('')).toBeNull()
    expect(cafeThemeDraftError('', '')).toBeNull()
    expect(cafeThemeDraftError('', '', '')).toBeNull()
  })

  test('accepts a six-digit hex with or without a hash', () => {
    expect(parseCafeThemeHex('#d9793b')).toBe('#D9793B')
    expect(parseCafeThemeHex('2F6B4F')).toBe('#2F6B4F')
    expect(cafeThemeHexError('#D9793B')).toBeNull()
  })

  test('rejects short or named colors', () => {
    expect(parseCafeThemeHex('#fff')).toBeNull()
    expect(parseCafeThemeHex('orange')).toBeNull()
    expect(cafeThemeHexError('orange')).toMatch(/#D9793B/)
    expect(cafeThemeDraftError('#D9793B', 'ink')).toMatch(/hex color/)
  })

  test('falls back to KapéDoko tokens when a well is empty', () => {
    expect(cafeThemeStyle(null, null)).toEqual({
      '--cafe-button': 'var(--kd-accent)',
      '--cafe-text': 'var(--kd-ink)',
      '--cafe-on-button': cafeThemeOnButton(null, null),
    })
    expect(cafeThemeStyle('#2F6B4F', '#1C1917', '#F3F6F2')).toEqual({
      '--cafe-button': '#2F6B4F',
      '--cafe-text': '#1C1917',
      '--cafe-on-button': cafeThemeOnButton('#2F6B4F', '#F3F6F2'),
      '--cafe-background': '#F3F6F2',
    })
  })

  test('picks readable letters for a dark button', () => {
    const mochaOn = cafeThemeOnButton('#6F4E37', '#F6F1E8')
    expect(cafeThemeContrast('#6F4E37', mochaOn)).toBeGreaterThan(cafeThemeContrast('#6F4E37', '#1C1917'))
    expect(mochaOn).not.toBe('#1C1917')
    expect(cafeThemeContrast('#D9793B', cafeThemeOnButton('#D9793B', CAFE_THEME_STOCK_HEX)))
      .toBeGreaterThanOrEqual(cafeThemeContrast('#D9793B', CAFE_THEME_STOCK_HEX))
  })
})

describe('cafe theme targeting', () => {
  const available = ['a', 'b', 'c']

  test('a single cafe always stamps there', () => {
    expect(cafeThemeShopIds({
      availableIds: ['a'],
      scope: 'several',
      oneId: '',
      severalIds: [],
    })).toEqual(['a'])
  })

  test('one-cafe scope uses the chosen id when it is available', () => {
    expect(cafeThemeShopIds({
      availableIds: available,
      scope: 'one',
      oneId: 'b',
      severalIds: ['a', 'c'],
    })).toEqual(['b'])
    expect(cafeThemeShopIds({
      availableIds: available,
      scope: 'one',
      oneId: 'other',
      severalIds: ['a'],
    })).toEqual([])
  })

  test('several-cafe scope keeps available ids only, once', () => {
    expect(cafeThemeShopIds({
      availableIds: available,
      scope: 'several',
      oneId: 'a',
      severalIds: ['c', 'a', 'c', 'nope'],
    })).toEqual(['c', 'a'])
  })

  test('owner apply payload rejects an empty cafe list', () => {
    expect(cafeThemeCafeError([])).toBe('Choose at least one cafe.')
    expect(cafeThemeCafeError(['a'])).toBeNull()
    expect(cafeThemeCafeError(Array.from({ length: CAFE_THEME_APPLY_MAX + 1 }, (_, i) => String(i)))).toMatch(/2000/)
  })
})

describe('cafe theme copy', () => {
  test('points at the SQL file when the columns or RPCs are missing', () => {
    expect(missingCafeThemeSqlCopy('column shops.theme_button_hex does not exist')).toMatch(/20261120_cafe_detail_theme/)
    expect(missingCafeThemeSqlCopy('column shops.theme_background_hex does not exist')).toMatch(/20261120_cafe_detail_theme/)
    expect(missingCafeThemeSqlCopy('Could not find the function public.apply_owner_shop_theme')).toMatch(/20261120_cafe_detail_theme/)
    expect(missingCafeThemeSqlCopy('Could not find the function public.apply_admin_shop_theme')).toMatch(/20261120_cafe_detail_theme/)
    expect(missingCafeThemeSqlCopy('Network error')).toBeNull()
    expect(cafeThemeLede()).toMatch(/one cafe or several/)
    expect(ownerCafeThemeLede()).toMatch(/partnership/)
    expect(ownerCafeThemeLockedCopy()).toMatch(/partnership turns it on/)
    expect(ownerCafeThemeNoCafesCopy()).toMatch(/verify a cafe/)
  })
})
