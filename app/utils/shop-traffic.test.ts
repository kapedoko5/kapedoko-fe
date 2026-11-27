import { describe, expect, test } from 'bun:test'
import {
  createTrafficCooldown,
  dailyBars,
  filterCafeTraffic,
  filterDailyRows,
  nextTrafficSort,
  sortCafeTraffic,
  formatTrafficRatio,
  availableTrafficTabs,
  isTrafficTabId,
  ownerAnalyticsEmptyCopy,
  ownerAnalyticsLockedCopy,
  promotionEmptyCopy,
  TRAFFIC_LEDGER_SURFACES,
  cafeAnalyticsPath,
  perCafeTraffic,
  perSurfaceTraffic,
  sortSurfaceTraffic,
  recordsFilterCounts,
  recordsKindsForFilter,
  shopTrafficConsentAllowsCapture,
  surfaceFromDetailSource,
  takeTrafficSurface,
  rememberTrafficSurface,
  tallyFromDaily,
  trafficLedgerEmptyCopy,
  trafficRangeStartDay,
  trafficRangeWindow,
  availableTrafficRanges,
  isMissingRpcError,
  rollupRowsToDaily,
  shopTrafficKindLabel,
  shopTrafficSurfaceLabel,
  isShopTrafficKind,
  isShopTrafficSurface,
  TRAFFIC_RANGES,
  trafficRatio,
  type ShopTrafficCafeRow,
  type ShopTrafficDailyRow,
} from './shop-traffic'

const row = (
  partial: Partial<ShopTrafficDailyRow> & Pick<ShopTrafficDailyRow, 'kind' | 'hits'>,
): ShopTrafficDailyRow => ({
  shop_id: partial.shop_id ?? 'cafe-a',
  surface: partial.surface ?? 'home',
  day: partial.day ?? '2026-11-19',
  kind: partial.kind,
  hits: partial.hits,
})

describe('surface mapping', () => {
  test('maps list sources onto traffic surfaces', () => {
    expect(surfaceFromDetailSource('feed')).toBe('home')
    expect(surfaceFromDetailSource('promotion')).toBe('promotion')
    expect(surfaceFromDetailSource('https://evil.example')).toBe('direct')
  })

  test('pending remember wins over the query, once', () => {
    rememberTrafficSurface('search')
    expect(takeTrafficSurface('map')).toBe('search')
    expect(takeTrafficSurface('map')).toBe('map')
    expect(takeTrafficSurface()).toBe('direct')
  })
})

describe('range', () => {
  test('7-day window includes today and six Manila days before', () => {
    expect(trafficRangeStartDay(7, new Date('2026-11-19T16:00:00+08:00'))).toBe('2026-11-13')
    expect(trafficRangeStartDay(30, new Date('2026-11-19T16:00:00+08:00'))).toBe('2026-10-21')
  })
})

describe('tallies', () => {
  test('sums kinds and derives CTR and engagement rate', () => {
    const tally = tallyFromDaily([
      row({ kind: 'card_impression', hits: 10 }),
      row({ kind: 'card_click', hits: 2 }),
      row({ kind: 'detail_view', hits: 4 }),
      row({ kind: 'navigate', hits: 1 }),
      row({ kind: 'call', hits: 1 }),
      row({ kind: 'photo_view', hits: 0 }),
    ])
    expect(tally.impressions).toBe(10)
    expect(tally.clicks).toBe(2)
    expect(tally.ctr).toBe(0.2)
    expect(tally.detailViews).toBe(4)
    expect(tally.visits).toBe(4)
    expect(tally.engagement).toBe(2)
    expect(tally.engagementRate).toBe(0.5)
    expect(formatTrafficRatio(tally.ctr)).toBe('20%')
  })

  test('CTR is blank with no impressions', () => {
    expect(trafficRatio(3, 0)).toBe(null)
    expect(formatTrafficRatio(null)).toBe('—')
  })

  test('filters by day, cafe, and surface', () => {
    const rows = filterDailyRows(
      [
        row({ day: '2026-11-10', kind: 'card_click', hits: 9 }),
        row({ day: '2026-11-19', kind: 'card_click', hits: 1, surface: 'search', shop_id: 'cafe-b' }),
        row({ day: '2026-11-19', kind: 'card_click', hits: 2, surface: 'home', shop_id: 'cafe-a' }),
      ],
      { fromDay: '2026-11-13', surfaces: ['home'], shopIds: ['cafe-a'] },
    )
    expect(rows).toEqual([
      row({ day: '2026-11-19', kind: 'card_click', hits: 2, surface: 'home', shop_id: 'cafe-a' }),
    ])
  })

  test('fills empty days on the bar chart', () => {
    const bars = dailyBars(
      [row({ day: '2026-11-19', kind: 'card_click', hits: 3 })],
      '2026-11-18',
      '2026-11-19',
    )
    expect(bars).toEqual([
      { day: '2026-11-18', clicks: 0, detailViews: 0 },
      { day: '2026-11-19', clicks: 3, detailViews: 0 },
    ])
  })

  test('lists every surface for a cafe, including quiet ones', () => {
    const list = perSurfaceTraffic([
      row({ surface: 'home', kind: 'card_click', hits: 3 }),
      row({ surface: 'home', kind: 'detail_view', hits: 1 }),
      row({ surface: 'search', kind: 'card_impression', hits: 8 }),
    ])
    expect(list.map((item) => item.surface)).toEqual(['home', 'search', 'map', 'favorites', 'promotion', 'direct', 'share'])
    expect(list[0]?.visits).toBe(1)
    expect(list[1]?.impressions).toBe(8)
    expect(list[2]?.clicks).toBe(0)
    expect(sortSurfaceTraffic(list, 'visits', 'desc')[0]?.surface).toBe('home')
  })

  test('lists cafes by clicks and keeps named cafes with zeros', () => {
    const list = perCafeTraffic(
      [
        row({ shop_id: 'b', kind: 'card_click', hits: 5 }),
        row({ shop_id: 'a', kind: 'card_click', hits: 1 }),
      ],
      [
        { id: 'a', name: 'Alpha' },
        { id: 'c', name: 'Quiet' },
      ],
    )
    expect(list.map((item) => item.shopId)).toEqual(['b', 'a', 'c'])
    expect(list[0]?.name).toBe('Unknown cafe')
    expect(list[2]?.clicks).toBe(0)
  })
})

describe('traffic ledger', () => {
  const cafe = (
    partial: Partial<ShopTrafficCafeRow> & Pick<ShopTrafficCafeRow, 'shopId' | 'name'>,
  ): ShopTrafficCafeRow => ({
    impressions: 0,
    clicks: 0,
    ctr: null,
    detailViews: 0,
    navigate: 0,
    call: 0,
    photos: 0,
    posters: 0,
    engagement: 0,
    engagementRate: null,
    visits: 0,
    ...partial,
  })

  test('searches by cafe name and keeps With traffic / No traffic apart', () => {
    const rows = [
      cafe({ shopId: 'a', name: 'Cy Cafe', clicks: 4, engagement: 1 }),
      cafe({ shopId: 'b', name: 'Quiet Bean' }),
      cafe({ shopId: 'c', name: 'Kape Sample', impressions: 8 }),
    ]
    expect(filterCafeTraffic(rows, { query: 'cy' }).map((item) => item.shopId)).toEqual(['a'])
    expect(filterCafeTraffic(rows, { activity: 'active' }).map((item) => item.shopId)).toEqual(['a', 'c'])
    expect(filterCafeTraffic(rows, { activity: 'quiet' }).map((item) => item.shopId)).toEqual(['b'])
    expect(filterCafeTraffic(rows, { query: 'bean', activity: 'quiet' }).map((item) => item.shopId)).toEqual(['b'])
    expect(filterCafeTraffic(rows, { query: 'bean', activity: 'active' })).toEqual([])
  })

  test('empty copy names search versus no traffic', () => {
    expect(trafficLedgerEmptyCopy({ query: 'xyz' })).toBe('No cafes match that search.')
    expect(trafficLedgerEmptyCopy({ activity: 'active' })).toBe('No café listing traffic in this window yet.')
    expect(trafficLedgerEmptyCopy({ activity: 'quiet' })).toBe('Every cafe in this window has traffic.')
    expect(trafficLedgerEmptyCopy({})).toBe('No cafes in this window.')
  })

  test('sorts a metric high to low, then low to high, with blanks last', () => {
    const rows = [
      cafe({ shopId: 'a', name: 'Alpha', clicks: 1, ctr: 0.1 }),
      cafe({ shopId: 'b', name: 'Beta', clicks: 9, ctr: null }),
      cafe({ shopId: 'c', name: 'Gamma', clicks: 4, ctr: 0.5 }),
    ]
    expect(sortCafeTraffic(rows, 'clicks', 'desc').map((item) => item.shopId)).toEqual(['b', 'c', 'a'])
    expect(sortCafeTraffic(rows, 'clicks', 'asc').map((item) => item.shopId)).toEqual(['a', 'c', 'b'])
    expect(sortCafeTraffic(rows, 'ctr', 'desc').map((item) => item.shopId)).toEqual(['c', 'a', 'b'])
    expect(sortCafeTraffic(rows, 'name', 'asc').map((item) => item.shopId)).toEqual(['a', 'b', 'c'])
    expect(nextTrafficSort('clicks', 'desc', 'clicks')).toEqual({ key: 'clicks', dir: 'asc' })
    expect(nextTrafficSort('clicks', 'desc', 'impressions')).toEqual({ key: 'impressions', dir: 'desc' })
    expect(nextTrafficSort('clicks', 'desc', 'name')).toEqual({ key: 'name', dir: 'asc' })
    expect(nextTrafficSort('clicks', 'desc', 'visits')).toEqual({ key: 'visits', dir: 'desc' })
    expect(sortCafeTraffic([
      cafe({ shopId: 'a', name: 'Alpha', visits: 2 }),
      cafe({ shopId: 'b', name: 'Beta', visits: 9 }),
      cafe({ shopId: 'c', name: 'Gamma', visits: 4 }),
    ], 'visits', 'desc').map((item) => item.shopId)).toEqual(['b', 'c', 'a'])
  })
})

describe('records filters', () => {
  test('maps chips onto kinds', () => {
    expect(recordsKindsForFilter('all')).toBe(null)
    expect(recordsKindsForFilter('visits')).toEqual(['detail_view'])
    expect(recordsKindsForFilter('engagement')).toEqual(['navigate', 'call', 'photo_view', 'poster_view'])
  })

  test('counts visits as café pages only, never card clicks or impressions', () => {
    expect(recordsFilterCounts([
      row({ kind: 'card_impression', hits: 4 }),
      row({ kind: 'detail_view', hits: 2 }),
      row({ kind: 'card_click', hits: 3 }),
      row({ kind: 'call', hits: 1, shop_id: 'cafe-b' }),
    ])).toEqual({
      all: 10,
      visits: 2,
      impressions: 4,
      clicks: 3,
      engagement: 1,
    })
    expect(recordsFilterCounts([
      row({ kind: 'card_impression', hits: 4 }),
      row({ kind: 'card_click', hits: 2 }),
      row({ kind: 'call', hits: 1, shop_id: 'cafe-b' }),
    ], 'cafe-a').visits).toBe(0)
  })
})

describe('cooldown', () => {
  test('blocks the same cafe kind and surface inside the window', () => {
    const allow = createTrafficCooldown(2000)
    expect(allow('a', 'card_click', 'home', 1000)).toBe(true)
    expect(allow('a', 'card_click', 'home', 2500)).toBe(false)
    expect(allow('a', 'card_click', 'home', 3001)).toBe(true)
    expect(allow('a', 'detail_view', 'home', 3001)).toBe(true)
  })
})

describe('consent gating', () => {
  test('records only after Allow', () => {
    expect(shopTrafficConsentAllowsCapture('granted')).toBe(true)
    expect(shopTrafficConsentAllowsCapture('declined')).toBe(false)
    expect(shopTrafficConsentAllowsCapture(null)).toBe(false)
    expect(shopTrafficConsentAllowsCapture('pending')).toBe(false)
  })
})

describe('tabs and ranges', () => {
  test('knows the four desk tabs and keeps Promotion off the Traffic chips', () => {
    expect(isTrafficTabId('statistics')).toBe(true)
    expect(isTrafficTabId('records')).toBe(true)
    expect(isTrafficTabId('traffic')).toBe(true)
    expect(isTrafficTabId('promotion')).toBe(true)
    expect(isTrafficTabId('vibes')).toBe(true)
    expect(isTrafficTabId('funnels')).toBe(false)
    expect(availableTrafficTabs('admin')).toContain('vibes')
    expect(availableTrafficTabs('owner')).not.toContain('vibes')
    expect(TRAFFIC_LEDGER_SURFACES).toEqual(['home', 'search', 'map', 'favorites', 'direct', 'share'])
    expect(promotionEmptyCopy()).toBe('No promotion traffic in this window yet.')
    expect(promotionEmptyCopy('xyz')).toBe('No cafes match that search.')
  })
})

describe('cafe desk path', () => {
  test('nests a cafe under admin or owner analytics', () => {
    expect(cafeAnalyticsPath('admin', 'cafe-a')).toBe('/admin/analytics/cafe-a')
    expect(cafeAnalyticsPath('owner', 'cafe-a')).toBe('/owner/analytics/cafe-a')
    expect(cafeAnalyticsPath('admin', '')).toBe('/admin/analytics')
  })
})

describe('owner empty copy', () => {
  test('waits for a live cafe when a claim is pending', () => {
    expect(ownerAnalyticsEmptyCopy(1)).toBe('Analytics appear after a cafe you manage is live.')
    expect(ownerAnalyticsEmptyCopy(0)).toBe('Claim a cafe to see how people find it.')
    expect(ownerAnalyticsLockedCopy()).toMatch(/partnership/)
  })
})

describe('poster views and the share surface', () => {
  test('knows the new kind and surface', () => {
    expect(isShopTrafficKind('poster_view')).toBe(true)
    expect(isShopTrafficSurface('share')).toBe(true)
    expect(isShopTrafficKind('poster')).toBe(false)
    expect(shopTrafficKindLabel('poster_view')).toBe('Poster')
    expect(shopTrafficSurfaceLabel('share')).toBe('Shared link')
    expect(TRAFFIC_LEDGER_SURFACES).toContain('share')
  })

  test('maps ?from=share onto the share surface', () => {
    expect(surfaceFromDetailSource('share')).toBe('share')
    expect(surfaceFromDetailSource('email')).toBe('direct')
  })

  test('poster views count as their own stat and as an action, not as photos', () => {
    const tally = tallyFromDaily([
      row({ kind: 'detail_view', hits: 4 }),
      row({ kind: 'photo_view', hits: 1 }),
      row({ kind: 'poster_view', hits: 2 }),
      row({ kind: 'navigate', hits: 1 }),
    ])
    expect(tally.photos).toBe(1)
    expect(tally.posters).toBe(2)
    expect(tally.engagement).toBe(4)
    expect(tally.engagementRate).toBe(1)
  })

  test('share traffic shows up as its own source row', () => {
    const share = perSurfaceTraffic([row({ kind: 'detail_view', hits: 3, surface: 'share' })])
      .find((item) => item.surface === 'share')
    expect(share?.visits).toBe(3)
  })
})

describe('rollup helpers', () => {
  test('offers 90 days only when the rollup RPC is available', () => {
    expect(TRAFFIC_RANGES).toEqual([7, 30, 90])
    expect(availableTrafficRanges(true)).toEqual([7, 30, 90])
    expect(availableTrafficRanges(false)).toEqual([7, 30])
  })

  test('builds an inclusive Manila window ending today', () => {
    const now = new Date('2026-11-27T20:00:00Z') // 2026-11-28 04:00 in Manila
    expect(trafficRangeWindow(7, now)).toEqual({ from: '2026-11-22', to: '2026-11-28' })
    expect(trafficRangeWindow(1, now)).toEqual({ from: '2026-11-28', to: '2026-11-28' })
  })

  test('recognizes a missing RPC but not other failures', () => {
    expect(isMissingRpcError({ code: 'PGRST202', message: 'x' })).toBe(true)
    expect(isMissingRpcError({ code: '42883', message: 'x' })).toBe(true)
    expect(isMissingRpcError({ message: 'Could not find the function public.shop_traffic_rollup' })).toBe(true)
    expect(isMissingRpcError({ code: 'P0001', message: 'Not allowed' })).toBe(false)
    expect(isMissingRpcError(new Error('network'))).toBe(false)
    expect(isMissingRpcError(null)).toBe(false)
  })

  test('maps rollup buckets onto daily rows and drops unknown values', () => {
    const rows = rollupRowsToDaily([
      { shop_id: 'a', kind: 'card_click', surface: 'home', bucket: '2026-11-20', hits: 3 },
      { shop_id: 'a', kind: 'poster_view', surface: 'share', bucket: '2026-11-21', hits: '2' },
      { shop_id: 'a', kind: 'future_kind', surface: 'home', bucket: '2026-11-21', hits: 1 },
      { shop_id: 'a', kind: 'call', surface: 'mars', bucket: '2026-11-21', hits: 1 },
      { shop_id: '', kind: 'call', surface: 'home', bucket: '2026-11-21', hits: 1 },
      { shop_id: 'a', kind: 'call', surface: 'home', hits: 1 },
      null,
    ])
    expect(rows).toEqual([
      { shop_id: 'a', kind: 'card_click', surface: 'home', day: '2026-11-20', hits: 3 },
      { shop_id: 'a', kind: 'poster_view', surface: 'share', day: '2026-11-21', hits: 2 },
    ])
    expect(rollupRowsToDaily(null)).toEqual([])
  })
})
