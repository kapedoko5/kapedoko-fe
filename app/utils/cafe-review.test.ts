import { describe, expect, test } from 'bun:test'
import type { ShopReviewPublicRow, ShopReviewStatsRow } from '../types/shop'
import {
  BUSYNESS_COOLDOWN_MS,
  chapterIssue,
  checkInAtStorageKey,
  checkInPath,
  cooldownRemainingMs,
  cooldownWaitCopy,
  draftToReviewInsert,
  readCheckInAt,
  writeCheckInAt,
  emptyReviewDraft,
  firstReviewChapter,
  isBusynessCooldown,
  isChapterComplete,
  mapPublicReview,
  monthCheckInCopy,
  busynessMeterFill,
  normalizeDraft,
  parseBusynessLevelQuery,
  plugInsightFromStats,
  REVIEW_COMMENT_MAX,
  reviewQuote,
  reviewRowToDraft,
  shouldSkipReviewBusyness,
  wifiInsightFromStats,
  type CafeReviewDraft,
} from './cafe-review'
import { amenitiesFromStats, mapShopToCafe, withCafeBusyness, withCafeCheckIns, withCafeReviews } from './shop-mapper'
import { isShopId, resolveLiveShopId, shopIdFromRoute } from './approved-shops'
import type { ShopRow } from '../types/shop'

const completeDraft = (): CafeReviewDraft => ({
  busyness: 'comfortable',
  wifiAvailable: 'yes',
  wifiSpeed: 'fast',
  wifiCap: 'voucher',
  powerAvailable: 'yes',
  powerAccess: 'easy',
  servesMatcha: 'yes',
  noise: 'quiet',
  stayFit: 'long',
  recommend: true,
  visitAgain: true,
  comment: '  Window seat had a plug.  ',
})

describe('review draft normalization', () => {
  test('clears wifi and power follow-ups when the amenity is not yes', () => {
    const draft = completeDraft()
    draft.wifiAvailable = 'no'
    draft.powerAvailable = 'unsure'
    const next = normalizeDraft(draft)
    expect(next.wifiSpeed).toBeNull()
    expect(next.wifiCap).toBeNull()
    expect(next.powerAccess).toBeNull()
  })

  test('keeps follow-ups when wifi and power are available', () => {
    const next = normalizeDraft(completeDraft())
    expect(next.wifiSpeed).toBe('fast')
    expect(next.wifiCap).toBe('voucher')
    expect(next.powerAccess).toBe('easy')
  })

  test('caps comments at 280 characters', () => {
    const draft = emptyReviewDraft()
    draft.comment = 'x'.repeat(400)
    expect(normalizeDraft(draft).comment).toHaveLength(REVIEW_COMMENT_MAX)
  })
})

describe('review chapters', () => {
  test('asks for busyness before leaving chapter 1', () => {
    expect(chapterIssue(1, emptyReviewDraft())).toBe('Pick how packed the cafe is right now.')
    expect(isChapterComplete(1, { ...emptyReviewDraft(), busyness: 'busy' })).toBe(true)
  })

  test('requires speed and cap only when wifi is yes', () => {
    const noWifi = { ...emptyReviewDraft(), wifiAvailable: 'no' as const }
    expect(chapterIssue(2, noWifi)).toBeNull()
    const yesWifi = { ...emptyReviewDraft(), wifiAvailable: 'yes' as const }
    expect(chapterIssue(2, yesWifi)).toBe('How was the WiFi speed?')
    expect(chapterIssue(2, { ...yesWifi, wifiSpeed: 'okay', wifiCap: 'unlimited' })).toBeNull()
  })

  test('requires outlet access only when sockets exist', () => {
    expect(chapterIssue(3, { ...emptyReviewDraft(), powerAvailable: 'no' })).toBeNull()
    expect(chapterIssue(3, { ...emptyReviewDraft(), powerAvailable: 'yes' })).toBe('Could you actually plug in?')
  })
})

describe('review upsert payload', () => {
  test('maps a complete draft onto the reviews insert shape', () => {
    expect(draftToReviewInsert(completeDraft(), 'shop-1', 'user-1')).toEqual({
      shop_id: 'shop-1',
      user_id: 'user-1',
      wifi_available: 'yes',
      wifi_speed: 'fast',
      wifi_time_limit: 'voucher',
      power_available: 'yes',
      power_access: 'easy',
      serves_matcha: 'yes',
      noise: 'quiet',
      stay_fit: 'long',
      recommend: true,
      visit_again: true,
      comment: 'Window seat had a plug.',
    })
  })

  test('rejects a draft that still has dependent wifi fields missing', () => {
    expect(() => draftToReviewInsert({
      ...completeDraft(),
      wifiSpeed: null,
    }, 'shop-1', 'user-1')).toThrow('How was the WiFi speed?')
  })

  test('round-trips a saved row back into the editor', () => {
    const insert = draftToReviewInsert(completeDraft(), 'shop-1', 'user-1')
    const draft = reviewRowToDraft({
      ...insert,
    }, 'quiet')
    expect(draft.wifiAvailable).toBe('yes')
    expect(draft.wifiCap).toBe('voucher')
    expect(draft.busyness).toBe('quiet')
    expect(draft.comment).toBe('Window seat had a plug.')
  })
})

describe('check-in helpers', () => {
  test('reads a valid crowd level from the login return query', () => {
    expect(parseBusynessLevelQuery('comfortable')).toBe('comfortable')
    expect(parseBusynessLevelQuery(['busy'])).toBe('busy')
    expect(parseBusynessLevelQuery('packed')).toBeNull()
    expect(parseBusynessLevelQuery(undefined)).toBeNull()
  })

  test('skips review busyness after a check-in', () => {
    const now = new Date('2026-09-09T04:00:00.000Z')
    const recent = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    const earlier = new Date(now.getTime() - BUSYNESS_COOLDOWN_MS - 1000).toISOString()
    expect(shouldSkipReviewBusyness('check-in')).toBe(true)
    expect(firstReviewChapter('check-in')).toBe(2)
    expect(shouldSkipReviewBusyness(undefined, recent, now)).toBe(true)
    expect(firstReviewChapter(undefined, recent, now)).toBe(2)
    expect(shouldSkipReviewBusyness('map')).toBe(false)
    expect(shouldSkipReviewBusyness(undefined, earlier, now)).toBe(false)
    expect(firstReviewChapter(undefined)).toBe(1)
  })

  test('keeps the chosen crowd level on the check-in return path', () => {
    const id = '2f1c8e6a-4b9d-4c3a-9f10-7a6b5c4d3e2f'
    expect(checkInPath(id)).toBe(`/app/cafes/${id}/check-in`)
    expect(checkInPath(id, 'quiet')).toBe(`/app/cafes/${id}/check-in?level=quiet`)
  })

  test('names the 30-day KapéBean count', () => {
    expect(monthCheckInCopy(0)).toBe('')
    expect(monthCheckInCopy(1)).toBe('1 KapéBean this month')
    expect(monthCheckInCopy(12)).toBe('12 KapéBeans this month')
  })

  test('fills one to four beans for how packed the cafe is', () => {
    expect(busynessMeterFill('quiet')).toBe(1)
    expect(busynessMeterFill('comfortable')).toBe(2)
    expect(busynessMeterFill('busy')).toBe(3)
    expect(busynessMeterFill('full')).toBe(4)
    expect(busynessMeterFill(null)).toBe(0)
  })
})

describe('busyness cooldown', () => {
  test('blocks a second check-in inside the 30 minute window', () => {
    const now = new Date('2026-09-09T04:00:00.000Z')
    const recent = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    expect(isBusynessCooldown(recent, now)).toBe(true)
    expect(isBusynessCooldown(recent, now, BUSYNESS_COOLDOWN_MS)).toBe(true)
  })

  test('allows a later visit after the window', () => {
    const now = new Date('2026-09-09T04:00:00.000Z')
    const earlier = new Date(now.getTime() - BUSYNESS_COOLDOWN_MS - 1000).toISOString()
    expect(isBusynessCooldown(earlier, now)).toBe(false)
    expect(isBusynessCooldown(null, now)).toBe(false)
  })

  test('counts remaining minutes for wait copy', () => {
    expect(cooldownWaitCopy(0)).toBe('You can check in again now.')
    expect(cooldownWaitCopy(1)).toBe('You can check in again in 1 minute.')
    expect(cooldownWaitCopy(60_000)).toBe('You can check in again in 1 minute.')
    expect(cooldownWaitCopy(60_001)).toBe('You can check in again in 2 minutes.')
    expect(cooldownWaitCopy(29 * 60_000)).toBe('You can check in again in 29 minutes.')
  })

  test('keys last check-in per user and cafe', () => {
    expect(checkInAtStorageKey('user-1', 'shop-1')).toBe('kapedoko-checkin-at:user-1:shop-1')
  })

  test('remembers last check-in in memory', () => {
    const at = new Date('2026-09-09T04:00:00.000Z')
    writeCheckInAt('user-1', 'shop-memory', at)
    expect(readCheckInAt('user-1', 'shop-memory')).toBe(at.toISOString())
    expect(readCheckInAt('user-1', 'shop-other')).toBeNull()
  })

  test('remaining ms is zero without a last check-in', () => {
    const now = new Date('2026-09-09T04:00:00.000Z')
    const recent = new Date(now.getTime() - 10 * 60 * 1000)
    expect(cooldownRemainingMs(null, now)).toBe(0)
    expect(cooldownRemainingMs(recent, now)).toBe(20 * 60 * 1000)
  })
})

describe('public review mapping', () => {
  const row: ShopReviewPublicRow = {
    id: 'rev-1',
    shop_id: 'shop-1',
    created_at: '2026-09-09T00:00:00.000Z',
    updated_at: '2026-09-09T00:00:00.000Z',
    author_name: 'Cy',
    wifi_available: 'yes',
    wifi_speed: 'fast',
    wifi_time_limit: 'unlimited',
    power_available: 'yes',
    power_access: 'limited',
    serves_matcha: 'yes',
    noise: 'mixed',
    stay_fit: 'long',
    recommend: true,
    visit_again: true,
    comment: null,
  }

  test('builds a quote from structured answers when comment is empty', () => {
    expect(reviewQuote(row)).toBe('WiFi felt fast. Had power sockets. Would recommend')
  })

  test('prefers the written suggestion when present', () => {
    expect(reviewQuote({ ...row, comment: '  Bring a dongle.  ' })).toBe('Bring a dongle.')
  })

  test('maps a public row onto a cafe review card', () => {
    expect(mapPublicReview(row)).toEqual({
      id: 'rev-1',
      name: 'Cy',
      quote: 'WiFi felt fast. Had power sockets. Would recommend',
      wifiVotes: 1,
      outletVotes: 1,
    })
  })
})

describe('aggregate insights', () => {
  const stats: ShopReviewStatsRow = {
    shop_id: 'shop-1',
    total_reviews: 5,
    wifi_yes_count: 4,
    wifi_available_pct: 80,
    wifi_speed_mode: 'fast',
    wifi_time_limit_mode: 'voucher',
    power_yes_count: 4,
    power_available_pct: 80,
    power_access_mode: 'easy',
    recommend_pct: 80,
    matcha_yes_count: 4,
    matcha_available_pct: 80,
  }

  test('shows wifi and outlet summaries from the first review', () => {
    const one = { ...stats, total_reviews: 1, wifi_yes_count: 1, wifi_available_pct: 100, power_yes_count: 1, power_available_pct: 100 }
    expect(wifiInsightFromStats(one)?.title).toBe('WiFi connection is available')
    expect(plugInsightFromStats(one)?.title).toBe('Power sockets are available')
    expect(amenitiesFromStats({ ...stats, total_reviews: 2 })).toEqual([])
  })

  test('names wifi speed and the voucher cap', () => {
    expect(wifiInsightFromStats(stats)).toEqual({
      count: 4,
      title: 'WiFi connection is available',
      body: 'WiFi connection is available in this coffee shop, with fast speed. A voucher or time cap comes up often.',
    })
  })

  test('names outlet access', () => {
    expect(plugInsightFromStats(stats)?.title).toBe('Power sockets are available')
  })

  test('attaches reviews and current busyness onto a mapped cafe', () => {
    const shop: ShopRow = {
      id: 'shop-1',
      name: 'Yardstick',
      description: null,
      address: 'Makati Avenue, Makati City',
      latitude: 14.5547,
      longitude: 121.0244,
      categories: [],
      hours: null,
      cover_photo_url: null,
      logo_object_key: null,
      contact_number: null,
      status: 'approved',
      submitted_by: null,
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: '2026-09-09T00:00:00.000Z',
      updated_at: '2026-09-09T00:00:00.000Z',
    }
    const cafe = withCafeBusyness(
      withCafeReviews(mapShopToCafe(shop, stats), [{
        id: 'rev-1',
        name: 'Cy',
        quote: 'Bring a dongle.',
        wifiVotes: 1,
        outletVotes: 1,
      }]),
      { shop_id: 'shop-1', level: 'busy', report_count: 3, last_reported_at: '2026-09-09T00:00:00.000Z' },
    )
    expect(cafe.wifiInsight?.title).toBe('WiFi connection is available')
    expect(cafe.reviews).toHaveLength(1)
    expect(cafe.busyness).toEqual({
      level: 'busy',
      label: 'Busy right now',
      count: 3,
    })
    expect(cafe.checkIns30d).toBe(0)
    expect(withCafeCheckIns(cafe, {
      shop_id: 'shop-1',
      checkins_30d: 12,
      last_checkin_at: '2026-10-26T00:00:00.000Z',
    }).checkIns30d).toBe(12)
  })
})

describe('review route shop id', () => {
  test('reads the cafe id from the review path when params are empty', () => {
    const id = '2f1c8e6a-4b9d-4c3a-9f10-7a6b5c4d3e2f'
    expect(shopIdFromRoute(`/app/cafes/${id}/review`)).toBe(id)
    expect(shopIdFromRoute(`/#/app/cafes/${id}/review`)).toBe(id)
    expect(shopIdFromRoute(`/app/cafes/${id}/claim`)).toBe(id)
    expect(shopIdFromRoute(`/#/app/cafes/${id}/claim`)).toBe(id)
    expect(shopIdFromRoute(`/app/cafes/${id}/edit`)).toBe(id)
    expect(shopIdFromRoute(`/app/cafes/${id}/check-in`)).toBe(id)
    expect(shopIdFromRoute(`/#/app/cafes/${id}/check-in?level=busy`)).toBe(id)
    expect(shopIdFromRoute(`/admin/cafes/${id}`)).toBe(id)
    expect(shopIdFromRoute(`/#/admin/cafes/${id}`)).toBe(id)
    expect(shopIdFromRoute(`/admin/audits/${id}`)).toBe(id)
    expect(shopIdFromRoute(`/#/admin/audits/${id}`)).toBe(id)
    expect(shopIdFromRoute('/app/map', undefined)).toBe('')
    expect(resolveLiveShopId('/admin/audits', '/admin/audits', undefined, {
      href: `/#/admin/audits/${id}`,
    })).toBe(id)
    expect(isShopId(id)).toBe(true)
    expect(isShopId('')).toBe(false)
    expect(isShopId('review')).toBe(false)
    expect(isShopId('claim')).toBe(false)
    expect(resolveLiveShopId('', '', undefined, { href: `/app/cafes/${id}/claim` })).toBe(id)
    expect(resolveLiveShopId('/app/cafes/claim', '/app/cafes/claim', 'claim', {
      href: `/app/cafes/${id}/claim`,
    })).toBe(id)
  })
})
