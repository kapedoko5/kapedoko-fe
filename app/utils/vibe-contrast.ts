// Picks a fill + text color pair for a selected vibe sticker so the label always
// clears WCAG AA (4.5:1) on admin-chosen vibe colors. Light colors keep ink text;
// mid-tones that pass neither ink nor white get nudged toward ink until white passes.

export const VIBE_INK = '#1C1917'
export const VIBE_WHITE = '#FFFFFF'
export const VIBE_MIN_CONTRAST = 4.5

type Rgb = [number, number, number]

const HEX_RE = /^#?([0-9a-f]{6})$/i

function toRgb(hex: string): Rgb | null {
  const match = HEX_RE.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1]!, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((part) => Math.round(part).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const ra = toRgb(a)
  const rb = toRgb(b)
  if (!ra || !rb) return 1
  const la = luminance(ra)
  const lb = luminance(rb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => from[i]! + (to[i]! - from[i]!) * amount) as Rgb
}

export function vibeStickerColors(color: string): { fill: string; on: string } {
  const base = toRgb(color) ?? toRgb('#D9793B')!
  const ink = toRgb(VIBE_INK)!
  for (let step = 0; step <= 20; step++) {
    const fill = toHex(mix(base, ink, step * 0.05))
    const onInk = contrastRatio(fill, VIBE_INK)
    const onWhite = contrastRatio(fill, VIBE_WHITE)
    if (onInk >= VIBE_MIN_CONTRAST || onWhite >= VIBE_MIN_CONTRAST) {
      return { fill, on: onInk >= onWhite ? VIBE_INK : VIBE_WHITE }
    }
  }
  return { fill: VIBE_INK, on: VIBE_WHITE }
}
