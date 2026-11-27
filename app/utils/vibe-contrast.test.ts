import { describe, expect, test } from 'bun:test'
import { contrastRatio, VIBE_INK, VIBE_MIN_CONTRAST, VIBE_WHITE, vibeStickerColors } from './vibe-contrast'

describe('vibeStickerColors', () => {
  test('keeps ink on the brand orange', () => {
    expect(vibeStickerColors('#D9793B')).toEqual({ fill: '#D9793B', on: VIBE_INK })
  })

  test('uses white on dark colors', () => {
    expect(vibeStickerColors('#1F6F6B')).toEqual({ fill: '#1F6F6B', on: VIBE_WHITE })
  })

  test('always clears AA, darkening mid-tones that fail both', () => {
    for (const color of ['#FF0000', '#E0457B', '#7C5CFF', '#2E86DE', '#FFD400', '#888888', '#00B37E', '#000000', '#FFFFFF']) {
      const { fill, on } = vibeStickerColors(color)
      expect(contrastRatio(fill, on)).toBeGreaterThanOrEqual(VIBE_MIN_CONTRAST)
    }
  })

  test('falls back to orange on bad input', () => {
    expect(vibeStickerColors('nope').fill).toBe('#D9793B')
  })
})
