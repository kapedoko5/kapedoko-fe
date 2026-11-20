export const CAFE_THEME_HEX_RE = /^#[0-9A-Fa-f]{6}$/
export const DEFAULT_CAFE_BUTTON_HEX = '#D9793B'
export const DEFAULT_CAFE_TEXT_HEX = '#1C1917'
export const DEFAULT_CAFE_BACKGROUND_HEX = '#F2F2F2'
export const CAFE_THEME_STOCK_HEX = '#FAF8F5'
export const CAFE_THEME_APPLY_MAX = 2000

export type CafeThemeScope = 'one' | 'several'

export type CafeThemePreset = {
  id: string
  label: string
  buttonHex: string | null
  textHex: string | null
  backgroundHex: string | null
}

export type CafeThemeCss = {
  '--cafe-button': string
  '--cafe-text': string
  '--cafe-on-button': string
  '--cafe-background'?: string
}

export const CAFE_THEME_PRESETS: CafeThemePreset[] = [
  { id: 'kapedoko', label: 'KapéDoko default', buttonHex: null, textHex: null, backgroundHex: null },
  { id: 'orange', label: 'KapéDoko orange', buttonHex: '#D9793B', textHex: '#1C1917', backgroundHex: '#FAF8F5' },
  { id: 'matcha', label: 'Matcha', buttonHex: '#2F6B4F', textHex: '#1C1917', backgroundHex: '#F3F6F2' },
  { id: 'mocha', label: 'Mocha', buttonHex: '#6F4E37', textHex: '#1C1917', backgroundHex: '#F6F1E8' },
  { id: 'blueberry', label: 'Blueberry', buttonHex: '#3B5B8C', textHex: '#1C1917', backgroundHex: '#F1F3F7' },
  { id: 'hibiscus', label: 'Hibiscus', buttonHex: '#A13D4C', textHex: '#1C1917', backgroundHex: '#F7F1F2' },
]

export function parseCafeThemeHex(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  return CAFE_THEME_HEX_RE.test(hex) ? hex.toUpperCase() : null
}

export function cafeThemeHexError(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  if (!parseCafeThemeHex(raw)) return 'Use a hex color like #D9793B.'
  return null
}

export function formatCafeThemeHex(value: string | null | undefined): string {
  return parseCafeThemeHex(value) ?? ''
}

function hexChannel(value: string, index: number): number {
  return Number.parseInt(value.slice(index, index + 2), 16) / 255
}

function channelLuminance(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

export function cafeThemeContrast(a: string, b: string): number {
  const left = parseCafeThemeHex(a)
  const right = parseCafeThemeHex(b)
  if (!left || !right) return 1
  const lum = (hex: string) => {
    const r = channelLuminance(hexChannel(hex, 1))
    const g = channelLuminance(hexChannel(hex, 3))
    const bl = channelLuminance(hexChannel(hex, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const first = lum(left)
  const second = lum(right)
  const [hi, lo] = first > second ? [first, second] : [second, first]
  return (hi + 0.05) / (lo + 0.05)
}

export function cafeThemeOnButton(
  buttonHex?: string | null,
  backgroundHex?: string | null,
): string {
  const fill = parseCafeThemeHex(buttonHex) ?? DEFAULT_CAFE_BUTTON_HEX
  const paper = parseCafeThemeHex(backgroundHex) ?? DEFAULT_CAFE_BACKGROUND_HEX
  const candidates = [...new Set([paper, CAFE_THEME_STOCK_HEX, '#FFFFFF', DEFAULT_CAFE_TEXT_HEX])]
  let best = DEFAULT_CAFE_TEXT_HEX
  let bestRatio = 0
  for (const color of candidates) {
    const ratio = cafeThemeContrast(fill, color)
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = color
    }
  }
  return best
}

export function cafeThemeStyle(
  buttonHex?: string | null,
  textHex?: string | null,
  backgroundHex?: string | null,
): CafeThemeCss {
  const background = parseCafeThemeHex(backgroundHex)
  const style: CafeThemeCss = {
    '--cafe-button': parseCafeThemeHex(buttonHex) ?? 'var(--kd-accent)',
    '--cafe-text': parseCafeThemeHex(textHex) ?? 'var(--kd-ink)',
    '--cafe-on-button': cafeThemeOnButton(buttonHex, backgroundHex),
  }
  if (background) style['--cafe-background'] = background
  return style
}

export function cafeThemeShopIds(input: {
  availableIds: readonly string[]
  scope: CafeThemeScope
  oneId: string
  severalIds: readonly string[]
}): string[] {
  const available = new Set(input.availableIds)
  if (input.availableIds.length === 1) {
    const only = input.availableIds[0]
    return only && available.has(only) ? [only] : []
  }
  if (input.scope === 'one') {
    return available.has(input.oneId) ? [input.oneId] : []
  }
  return [...new Set(input.severalIds.filter((id) => available.has(id)))]
}

export function cafeThemeCafeError(shopIds: readonly string[]): string | null {
  if (shopIds.length === 0) return 'Choose at least one cafe.'
  if (shopIds.length > CAFE_THEME_APPLY_MAX) return `Stamp at most ${CAFE_THEME_APPLY_MAX} cafes at a time.`
  return null
}

export function cafeThemeDraftError(
  buttonDraft: string,
  textDraft: string,
  backgroundDraft = '',
): string | null {
  return cafeThemeHexError(buttonDraft)
    || cafeThemeHexError(textDraft)
    || cafeThemeHexError(backgroundDraft)
}

export function missingCafeThemeSqlCopy(message: string): string | null {
  if (!/theme_button_hex|theme_text_hex|theme_background_hex|apply_admin_shop_theme|apply_owner_shop_theme|p_button_hex|p_text_hex|p_background_hex/i.test(message)) {
    return null
  }
  return 'Apply db/20261120_cafe_detail_theme.sql and db/20261126_placement_theme.sql in the SQL editor, then try again.'
}

export function cafeThemeLede(): string {
  return 'Ink the buttons, the words, and the stock. Preview the page, then stamp it on one cafe or several.'
}

export function ownerCafeThemeLede(): string {
  return 'When Theme is on for a partnership, ink the cafe page. Preview it, then stamp one cafe or several.'
}

export function ownerCafeThemeNoCafesCopy(): string {
  return 'Claim and verify a cafe before you ink its details page.'
}

export function ownerCafeThemeLockedCopy(): string {
  return 'Theme is off until a partnership turns it on for a cafe you manage.'
}
