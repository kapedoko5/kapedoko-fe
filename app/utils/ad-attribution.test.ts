import { describe, expect, test } from 'bun:test'
import {
  adEventIsValid,
  adStatsByCampaign,
  createAdCooldown,
  featuredTotalsFromEvents,
  hasAdTraffic,
  parseAdStats,
  summarizeAdStats,
} from './ad-attribution'

const CAMPAIGN = '11111111-1111-4111-8111-111111111111'
const SHOP = '22222222-2222-4222-8222-222222222222'

describe('adEventIsValid', () => {
  test('banners need a campaign id', () => {
    expect(adEventIsValid({ placement: 'banner', campaignId: CAMPAIGN })).toBe(true)
    expect(adEventIsValid({ placement: 'banner' })).toBe(false)
    expect(adEventIsValid({ placement: 'banner', campaignId: 'nope' })).toBe(false)
  })

  test('featured events need a cafe and no campaign', () => {
    expect(adEventIsValid({ placement: 'featured', shopId: SHOP })).toBe(true)
    expect(adEventIsValid({ placement: 'featured' })).toBe(false)
    expect(adEventIsValid({ placement: 'featured', shopId: SHOP, campaignId: CAMPAIGN })).toBe(false)
  })
})

describe('createAdCooldown', () => {
  test('blocks the same ad event inside the window only', () => {
    const allow = createAdCooldown(2000)
    expect(allow('banner', 'click', CAMPAIGN, null, 1000)).toBe(true)
    expect(allow('banner', 'click', CAMPAIGN, null, 2500)).toBe(false)
    expect(allow('banner', 'impression', CAMPAIGN, null, 2500)).toBe(true)
    expect(allow('featured', 'click', null, SHOP, 2500)).toBe(true)
    expect(allow('banner', 'click', CAMPAIGN, null, 3500)).toBe(true)
  })
})

describe('ad stats', () => {
  const rows = parseAdStats([
    { campaign_id: CAMPAIGN, shop_id: SHOP, placement: 'banner', label: 'Holiday', impressions: 100, clicks: 5 },
    { campaign_id: null, shop_id: SHOP, placement: 'featured', label: null, impressions: '40', clicks: '8' },
    { campaign_id: null, shop_id: null, placement: 'sidebar', impressions: 1, clicks: 1 },
    null,
  ])

  test('drops unknown placements and coerces counts', () => {
    expect(rows).toHaveLength(2)
    expect(rows[1]?.impressions).toBe(40)
  })

  test('splits banner and featured with CTR', () => {
    const summary = summarizeAdStats(rows)
    expect(summary.banner).toEqual({ impressions: 100, clicks: 5, ctr: 0.05 })
    expect(summary.featured).toEqual({ impressions: 40, clicks: 8, ctr: 0.2 })
    expect(hasAdTraffic(summary)).toBe(true)
  })

  test('has no CTR without impressions and reports no traffic when empty', () => {
    const summary = summarizeAdStats([])
    expect(summary.banner.ctr).toBeNull()
    expect(hasAdTraffic(summary)).toBe(false)
  })

  test('totals banners per campaign and ignores featured rows', () => {
    const map = adStatsByCampaign([
      ...rows,
      { campaignId: CAMPAIGN, shopId: SHOP, placement: 'banner', label: null, impressions: 10, clicks: 5 },
    ])
    expect(map.size).toBe(1)
    expect(map.get(CAMPAIGN)).toEqual({ impressions: 110, clicks: 10, ctr: 10 / 110 })
  })

  test('counts owner featured events by kind', () => {
    expect(featuredTotalsFromEvents(['impression', 'impression', 'click', null, 'other']))
      .toEqual({ impressions: 2, clicks: 1, ctr: 0.5 })
  })
})
