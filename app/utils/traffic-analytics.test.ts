import { describe, expect, test } from 'bun:test'
import {
  analyticsEmptyKind,
  buildAnalyticsQuery,
  dailySeries,
  formatFunnelRate,
  formatKpiChange,
  funnelSteps,
  kpiDelta,
  parseAnalyticsQuery,
  percentChange,
  rankSources,
  splitTrafficPeriods,
} from './traffic-analytics'
import { tallyFromDaily, type ShopTrafficDailyRow } from './shop-traffic'

const row = (
  partial: Partial<ShopTrafficDailyRow> & Pick<ShopTrafficDailyRow, 'kind' | 'hits'>,
): ShopTrafficDailyRow => ({
  shop_id: partial.shop_id ?? 'a',
  surface: partial.surface ?? 'home',
  day: partial.day ?? '2026-11-19',
  kind: partial.kind,
  hits: partial.hits,
})

const NOW = new Date('2026-11-19T12:00:00+08:00')

describe('period split', () => {
  test('7 days: current is Nov 13-19, previous is Nov 6-12', () => {
    const split = splitTrafficPeriods(
      [
        row({ day: '2026-11-05', kind: 'card_click', hits: 1 }),
        row({ day: '2026-11-06', kind: 'card_click', hits: 2 }),
        row({ day: '2026-11-12', kind: 'card_click', hits: 3 }),
        row({ day: '2026-11-13', kind: 'card_click', hits: 4 }),
        row({ day: '2026-11-19', kind: 'card_click', hits: 5 }),
        row({ day: '2026-11-20', kind: 'card_click', hits: 9 }),
      ],
      7,
      { now: NOW },
    )
    expect([split.currentFrom, split.currentTo]).toEqual(['2026-11-13', '2026-11-19'])
    expect([split.previousFrom, split.previousTo]).toEqual(['2026-11-06', '2026-11-12'])
    expect(split.current.map((r) => r.hits)).toEqual([4, 5])
    expect(split.previous.map((r) => r.hits)).toEqual([2, 3])
  })

  test('respects cafe filter and empty input', () => {
    const split = splitTrafficPeriods(
      [row({ shop_id: 'b', kind: 'card_click', hits: 4 })],
      30,
      { now: NOW, shopIds: ['a'] },
    )
    expect(split.current).toEqual([])
    expect(splitTrafficPeriods([], 30, { now: NOW }).previous).toEqual([])
  })
})

describe('change vs previous', () => {
  test('percent change handles zero and null', () => {
    expect(percentChange(15, 10)).toBe(0.5)
    expect(percentChange(5, 10)).toBe(-0.5)
    expect(percentChange(5, 0)).toBe(null)
    expect(percentChange(0, 0)).toBe(null)
    expect(percentChange(null, 4)).toBe(null)
    expect(percentChange(4, undefined)).toBe(null)
    expect(percentChange(0, 10)).toBe(-1)
  })

  test('hides the chip below the minimum previous count', () => {
    const low = kpiDelta('impressions', 30, 10)
    expect(low.reliable).toBe(false)
    expect(low.direction).toBe(null)
    expect(low.difference).toBe(20)
    const ok = kpiDelta('impressions', 30, 20)
    expect(ok.reliable).toBe(true)
    expect(ok.direction).toBe('up')
    expect(kpiDelta('visits', 3, 5).direction).toBe('down')
    expect(kpiDelta('visits', 5, 5).direction).toBe('flat')
    expect(kpiDelta('visits', 5, 0).reliable).toBe(false)
  })

  test('formats change with a real minus sign', () => {
    expect(formatKpiChange(0.256)).toBe('+25.6%')
    expect(formatKpiChange(-0.5)).toBe('−50%')
    expect(formatKpiChange(0)).toBe('0%')
    expect(formatKpiChange(null)).toBe('—')
  })

  test('empty states', () => {
    const none = tallyFromDaily([])
    const some = tallyFromDaily([row({ kind: 'card_impression', hits: 3 })])
    expect(analyticsEmptyKind(none, none)).toBe('just-enabled')
    expect(analyticsEmptyKind(none, some)).toBe('no-traffic')
    expect(analyticsEmptyKind(some, none)).toBe(null)
  })
})

describe('daily series', () => {
  test('fills quiet days and buckets kinds', () => {
    const series = dailySeries(
      [
        row({ day: '2026-11-18', kind: 'detail_view', hits: 2 }),
        row({ day: '2026-11-18', kind: 'call', hits: 1 }),
        row({ day: '2026-11-18', kind: 'card_click', hits: 4 }),
      ],
      '2026-11-17',
      '2026-11-19',
    )
    expect(series).toEqual([
      { day: '2026-11-17', impressions: 0, clicks: 0, visits: 0, actions: 0 },
      { day: '2026-11-18', impressions: 0, clicks: 4, visits: 2, actions: 1 },
      { day: '2026-11-19', impressions: 0, clicks: 0, visits: 0, actions: 0 },
    ])
  })
})

describe('funnel', () => {
  test('steps with conversion from previous and from top', () => {
    const tally = tallyFromDaily([
      row({ kind: 'card_impression', hits: 100 }),
      row({ kind: 'card_click', hits: 20 }),
      row({ kind: 'detail_view', hits: 10 }),
      row({ kind: 'navigate', hits: 2 }),
      row({ kind: 'call', hits: 1 }),
    ])
    const steps = funnelSteps(tally)
    expect(steps.map((s) => s.label)).toEqual(['Impressions', 'Card clicks', 'Cafe page', 'Actions'])
    expect(steps.map((s) => s.count)).toEqual([100, 20, 10, 3])
    expect(steps[0]?.fromPrevious).toBe(null)
    expect(steps[1]?.fromPrevious).toBe(0.2)
    expect(steps[2]?.fromPrevious).toBe(0.5)
    expect(steps[3]?.fromPrevious).toBeCloseTo(0.3)
    expect(steps[3]?.fromTop).toBeCloseTo(0.03)
  })

  test('zero steps give null rates and rates over 100% are labelled', () => {
    const steps = funnelSteps(tallyFromDaily([row({ kind: 'detail_view', hits: 4 })]))
    expect(steps[1]?.fromPrevious).toBe(null)
    expect(steps[2]?.fromPrevious).toBe(null)
    expect(steps[3]?.fromPrevious).toBe(0)
    expect(formatFunnelRate(1.4)).toBe('100%+')
    expect(formatFunnelRate(0.123)).toBe('12.3%')
    expect(formatFunnelRate(null)).toBe('—')
  })
})

describe('sources', () => {
  test('ranks by visits with share and CTR, dropping silent surfaces', () => {
    const list = rankSources([
      row({ surface: 'home', kind: 'card_impression', hits: 10 }),
      row({ surface: 'home', kind: 'card_click', hits: 2 }),
      row({ surface: 'home', kind: 'detail_view', hits: 1 }),
      row({ surface: 'map', kind: 'detail_view', hits: 3 }),
      row({ surface: 'search', kind: 'call', hits: 5 }),
    ])
    expect(list.map((s) => s.surface)).toEqual(['map', 'home'])
    expect(list[0]?.share).toBe(0.75)
    expect(list[1]?.share).toBe(0.25)
    expect(list[1]?.ctr).toBe(0.2)
    expect(list[0]?.ctr).toBe(null)
    expect(list.reduce((sum, s) => sum + (s.share ?? 0), 0)).toBe(1)
  })

  test('no visits means no share, and empty input is empty', () => {
    const list = rankSources([row({ surface: 'home', kind: 'card_impression', hits: 4 })])
    expect(list[0]?.share).toBe(null)
    expect(rankSources([])).toEqual([])
  })
})

describe('Visits redefinition', () => {
  test('visits equal cafe page opens and never add card clicks', () => {
    const tally = tallyFromDaily([
      row({ kind: 'card_click', hits: 7 }),
      row({ kind: 'detail_view', hits: 7 }),
      row({ surface: 'map', kind: 'detail_view', hits: 2 }),
    ])
    expect(tally.visits).toBe(9)
    expect(tally.visits).toBe(tally.detailViews)
  })
})

describe('url query', () => {
  test('reads valid values', () => {
    expect(parseAnalyticsQuery({ tab: 'records', range: '7' })).toEqual({ tab: 'records', range: 7 })
    expect(parseAnalyticsQuery({ tab: ['traffic', 'x'], range: ['7'] })).toEqual({ tab: 'traffic', range: 7 })
  })

  test('falls back on invalid, hidden or missing values', () => {
    expect(parseAnalyticsQuery({ tab: 'nope', range: '90' })).toEqual({ tab: 'statistics', range: 90 })
    expect(parseAnalyticsQuery({ range: '365' }).range).toBe(30)
    expect(parseAnalyticsQuery({ range: 'abc' })).toEqual({ tab: 'statistics', range: 30 })
    expect(parseAnalyticsQuery({ range: '7.5' }).range).toBe(30)
    expect(parseAnalyticsQuery({ tab: 42, range: {} })).toEqual({ tab: 'statistics', range: 30 })
    expect(parseAnalyticsQuery(null)).toEqual({ tab: 'statistics', range: 30 })
    expect(parseAnalyticsQuery(undefined)).toEqual({ tab: 'statistics', range: 30 })
  })

  test('builds a query that keeps other keys and drops defaults', () => {
    expect(buildAnalyticsQuery({ foo: 'bar', tab: 'old' }, { tab: 'records', range: 7 }))
      .toEqual({ foo: 'bar', tab: 'records', range: '7' })
    expect(buildAnalyticsQuery({ tab: 'records', range: '7' }, { tab: 'statistics', range: 30 })).toEqual({})
  })
})
