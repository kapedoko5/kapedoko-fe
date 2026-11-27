import { describe, expect, test } from 'bun:test'
import { INSIGHT_MIN, buildInsights, busiestWeekday, weekdayOfDay, type InsightInput } from './analytics-insights'
import { hourlyGrid } from './peak-hours'
import { tallyFromDaily, type ShopTrafficDailyRow } from './shop-traffic'

const row = (
  partial: Partial<ShopTrafficDailyRow> & Pick<ShopTrafficDailyRow, 'kind' | 'hits'>,
): ShopTrafficDailyRow => ({
  shop_id: 'a',
  surface: partial.surface ?? 'home',
  day: partial.day ?? '2026-11-19',
  kind: partial.kind,
  hits: partial.hits,
})

const input = (
  current: ShopTrafficDailyRow[],
  previous: ShopTrafficDailyRow[] = [],
  extra: Partial<InsightInput> = {},
): InsightInput => ({
  current: tallyFromDaily(current),
  previous: tallyFromDaily(previous),
  currentRows: current,
  editorPath: '/owner/cafes/x',
  ...extra,
})

describe('directions per visit', () => {
  test('flags a fall against the previous period', () => {
    const list = buildInsights(input(
      [row({ kind: 'detail_view', hits: 100 }), row({ kind: 'navigate', hits: 10 })],
      [row({ kind: 'detail_view', hits: 100 }), row({ kind: 'navigate', hits: 30 })],
      { editorPath: null },
    ))
    const hit = list.find((item) => item.id === 'directions-drop')
    expect(hit?.tone).toBe('attention')
    expect(hit?.body).toContain('10%')
    expect(hit?.body).toContain('30%')
    expect(hit?.cta).toBeUndefined()
  })

  test('stays quiet below the visit threshold', () => {
    const few = INSIGHT_MIN.directionsVisits - 1
    const list = buildInsights(input(
      [row({ kind: 'detail_view', hits: few }), row({ kind: 'navigate', hits: 0 })],
      [row({ kind: 'detail_view', hits: 100 }), row({ kind: 'navigate', hits: 50 })],
    ))
    expect(list.find((item) => item.id === 'directions-drop')).toBeUndefined()
  })

  test('stays quiet when the rate held or rose', () => {
    const list = buildInsights(input(
      [row({ kind: 'detail_view', hits: 100 }), row({ kind: 'navigate', hits: 30 })],
      [row({ kind: 'detail_view', hits: 100 }), row({ kind: 'navigate', hits: 30 })],
    ))
    expect(list.find((item) => item.id === 'directions-drop')).toBeUndefined()
  })

  test('stays quiet when the previous period had no directions', () => {
    const list = buildInsights(input(
      [row({ kind: 'detail_view', hits: 100 })],
      [row({ kind: 'detail_view', hits: 100 })],
    ))
    expect(list.find((item) => item.id === 'directions-drop')).toBeUndefined()
  })
})

describe('few photos', () => {
  const taps = [row({ kind: 'detail_view', hits: 40 }), row({ kind: 'photo_view', hits: 20 })]

  test('suggests more photos when taps are high and the listing is under its cap', () => {
    const hit = buildInsights(input(taps, [], { photoCount: 1, photoCap: 3 })).find((i) => i.id === 'photos-few')
    expect(hit?.cta?.to).toBe('/owner/cafes/x')
  })

  test('stays quiet at the cap, with unknown counts, or with few taps', () => {
    expect(buildInsights(input(taps, [], { photoCount: 3, photoCap: 3 })).some((i) => i.id === 'photos-few')).toBe(false)
    expect(buildInsights(input(taps)).some((i) => i.id === 'photos-few')).toBe(false)
    const quiet = [row({ kind: 'detail_view', hits: 40 }), row({ kind: 'photo_view', hits: 5 })]
    expect(buildInsights(input(quiet, [], { photoCount: 0, photoCap: 3 })).some((i) => i.id === 'photos-few')).toBe(false)
  })
})

describe('no search traffic', () => {
  test('speaks when there is volume but no Search surface', () => {
    const rows = [row({ kind: 'card_impression', hits: 60, surface: 'home' })]
    expect(buildInsights(input(rows)).some((i) => i.id === 'no-search')).toBe(true)
  })

  test('stays quiet with search traffic or low volume', () => {
    const withSearch = [
      row({ kind: 'card_impression', hits: 60, surface: 'home' }),
      row({ kind: 'card_impression', hits: 1, surface: 'search' }),
    ]
    expect(buildInsights(input(withSearch)).some((i) => i.id === 'no-search')).toBe(false)
    const low = [row({ kind: 'card_impression', hits: INSIGHT_MIN.searchTraffic - 1 })]
    expect(buildInsights(input(low)).some((i) => i.id === 'no-search')).toBe(false)
  })
})

describe('busiest day and time', () => {
  test('finds the Manila weekday of a day string', () => {
    expect(weekdayOfDay('2026-11-21')).toBe(6)
    expect(weekdayOfDay('nope')).toBeNull()
  })

  test('picks a weekday that clearly stands out', () => {
    const rows = [
      row({ kind: 'detail_view', hits: 30, day: '2026-11-21' }),
      row({ kind: 'detail_view', hits: 10, day: '2026-11-18' }),
      row({ kind: 'detail_view', hits: 10, day: '2026-11-19' }),
    ]
    expect(busiestWeekday(rows)?.dow).toBe(6)
  })

  test('stays quiet at low volume or with an even spread', () => {
    expect(busiestWeekday([row({ kind: 'detail_view', hits: 10, day: '2026-11-21' })])).toBeNull()
    const even = Array.from({ length: 7 }, (_, i) =>
      row({ kind: 'detail_view', hits: 10, day: `2026-11-${String(15 + i).padStart(2, '0')}` }))
    expect(busiestWeekday(even)).toBeNull()
  })

  test('busiest time uses check-ins on their own and needs enough of them', () => {
    const grid = hourlyGrid([{ shop_id: 'a', hour_start: '2026-11-21T07:00:00Z', report_count: 12 }])
    const hit = buildInsights(input([], [], { checkinGrid: grid })).find((i) => i.id === 'busiest-time')
    expect(hit?.body).toContain('Saturday, 3 PM to 4 PM')
    const thin = hourlyGrid([{ shop_id: 'a', hour_start: '2026-11-21T07:00:00Z', report_count: 3 }])
    expect(buildInsights(input([], [], { checkinGrid: thin })).some((i) => i.id === 'busiest-time')).toBe(false)
  })
})

describe('ordering and limits', () => {
  test('shows at most three, attention first', () => {
    const current = [
      row({ kind: 'detail_view', hits: 100, day: '2026-11-21' }),
      row({ kind: 'navigate', hits: 5 }),
      row({ kind: 'photo_view', hits: 40 }),
      row({ kind: 'card_impression', hits: 100, surface: 'home' }),
    ]
    const previous = [row({ kind: 'detail_view', hits: 100 }), row({ kind: 'navigate', hits: 40 })]
    const grid = hourlyGrid([{ shop_id: 'a', hour_start: '2026-11-21T07:00:00Z', report_count: 20 }])
    const list = buildInsights(input(current, previous, { photoCount: 0, photoCap: 3, checkinGrid: grid }))
    expect(list).toHaveLength(3)
    expect(list[0]?.id).toBe('directions-drop')
    expect(buildInsights(input(current, previous, { photoCount: 0, photoCap: 3, checkinGrid: grid }), 1)).toHaveLength(1)
  })

  test('no traffic yields no insight', () => {
    expect(buildInsights(input([]))).toEqual([])
  })
})
