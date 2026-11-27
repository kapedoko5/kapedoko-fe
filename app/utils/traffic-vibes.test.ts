import { describe, expect, test } from 'bun:test'
import { VIBE_MIN_IMPRESSIONS, parseVibeRows, perVibeTraffic } from './traffic-vibes'
import { perCafeTraffic, type ShopTrafficDailyRow } from './shop-traffic'

const day = (shop: string, kind: ShopTrafficDailyRow['kind'], hits: number): ShopTrafficDailyRow =>
  ({ shop_id: shop, kind, surface: 'home', day: '2026-11-19', hits })

const names = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
]

const cafes = perCafeTraffic([
  day('a', 'card_impression', 100),
  day('a', 'card_click', 20),
  day('a', 'detail_view', 15),
  day('b', 'card_impression', 60),
  day('b', 'card_click', 6),
  day('b', 'detail_view', 5),
  day('c', 'card_impression', 10),
], names)

const vibe = (shop: string, tag: string, label = tag) => ({ shop_id: shop, tag_id: tag, slug: tag, label })

describe('per vibe traffic', () => {
  test('sums traffic across the cafes that carry a tag', () => {
    const rows = perVibeTraffic(cafes, [vibe('a', 'cozy'), vibe('b', 'cozy'), vibe('b', 'quiet')])
    const cozy = rows.find((r) => r.tagId === 'cozy')!
    expect(cozy.cafes).toBe(2)
    expect(cozy.impressions).toBe(160)
    expect(cozy.clicks).toBe(26)
    expect(cozy.visits).toBe(20)
    expect(cozy.ctr).toBeCloseTo(26 / 160)
    expect(cozy.visitsPerCafe).toBe(10)
  })

  test('a cafe with two tags counts toward both', () => {
    const rows = perVibeTraffic(cafes, [vibe('a', 'cozy'), vibe('a', 'quiet')])
    expect(rows.map((r) => r.visits)).toEqual([15, 15])
  })

  test('orders by visits, then clicks, then label', () => {
    const rows = perVibeTraffic(cafes, [vibe('a', 'z', 'Zen'), vibe('b', 'b', 'Brew'), vibe('c', 'c', 'Calm')])
    expect(rows.map((r) => r.label)).toEqual(['Zen', 'Brew', 'Calm'])
  })

  test('keeps a tag whose cafes have no traffic, with a null CTR', () => {
    const rows = perVibeTraffic(cafes, [vibe('missing', 'ghost')])
    expect(rows[0]).toMatchObject({ cafes: 1, impressions: 0, ctr: null, enough: false })
  })

  test('dedupes the same cafe and tag pair', () => {
    const rows = perVibeTraffic(cafes, [vibe('a', 'cozy'), vibe('a', 'cozy')])
    expect(rows[0]?.cafes).toBe(1)
  })

  test('flags low impression volume', () => {
    const rows = perVibeTraffic(cafes, [vibe('a', 'big'), vibe('c', 'small')])
    expect(rows.find((r) => r.tagId === 'big')?.enough).toBe(true)
    expect(rows.find((r) => r.tagId === 'small')?.enough).toBe(false)
    expect(VIBE_MIN_IMPRESSIONS).toBe(50)
  })

  test('returns nothing without vibe rows', () => {
    expect(perVibeTraffic(cafes, [])).toEqual([])
  })

  test('parses vibe rows defensively', () => {
    expect(parseVibeRows([{ shop_id: 'a', tag_id: 't', slug: 's', label: 'Cozy' }, { shop_id: 'a' }, 4]))
      .toEqual([{ shop_id: 'a', tag_id: 't', slug: 's', label: 'Cozy' }])
    expect(parseVibeRows(undefined)).toEqual([])
  })
})
