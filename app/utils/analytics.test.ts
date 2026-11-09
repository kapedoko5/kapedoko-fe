import { describe, expect, test } from 'bun:test'
import { unknownAmenityStatus } from './amenity-status'
import type { CafeAmenityStatus } from '../types/shop'
import {
  ANALYTICS_EVENTS,
  cardViewKey,
  classifySearchQuery,
  confidenceBucketFromCafe,
  confidenceBucketFromLegacyStats,
  confidenceBucketFromStatus,
  conservativeConfidenceBucket,
  createSessionDedupe,
  isAnalyticsEventName,
  modalConfidenceBucket,
  normalizeAcquisitionSource,
  parseDetailSource,
  scrubEventProperties,
  shouldCapture,
  type CommonAnalyticsProperties,
} from './analytics'
import { UNKNOWN_WORK } from './shop-mapper'

const common: CommonAnalyticsProperties = {
  app_version: '1.0.0',
  platform: 'web',
  auth_state: 'guest',
  acquisition_source: 'direct',
}

const status = (partial: Partial<CafeAmenityStatus>): CafeAmenityStatus => ({
  ...unknownAmenityStatus(),
  ...partial,
})

describe('shouldCapture', () => {
  test('blocks unset or declined consent', () => {
    expect(shouldCapture({ client: true, enabled: true, hasKey: true, consent: null })).toBe(false)
    expect(shouldCapture({ client: true, enabled: true, hasKey: true, consent: 'declined' })).toBe(false)
  })

  test('blocks when the env flag is off or the key is missing', () => {
    expect(shouldCapture({ client: true, enabled: false, hasKey: true, consent: 'granted' })).toBe(false)
    expect(shouldCapture({ client: true, enabled: true, hasKey: false, consent: 'granted' })).toBe(false)
    expect(shouldCapture({ client: false, enabled: true, hasKey: true, consent: 'granted' })).toBe(false)
  })

  test('allows capture after consent on the client', () => {
    expect(shouldCapture({ client: true, enabled: true, hasKey: true, consent: 'granted' })).toBe(true)
  })
})

describe('event catalog', () => {
  test('drops unknown event names', () => {
    expect(isAnalyticsEventName('review_submitted')).toBe(false)
    expect(isAnalyticsEventName('check_in_submitted')).toBe(false)
    expect(isAnalyticsEventName(ANALYTICS_EVENTS.CAFE_DETAIL_VIEWED)).toBe(true)
    expect(isAnalyticsEventName(ANALYTICS_EVENTS.CHECK_IN_STARTED)).toBe(true)
  })

  test('strips forbidden and unknown keys', () => {
    const payload = scrubEventProperties(
      ANALYTICS_EVENTS.SEARCH_PERFORMED,
      {
        query_type: 'name',
        result_count: 3,
        zero_results: false,
        query: 'best wifi',
        email: 'a@b.c',
        lat: 14.6,
        extra: 'nope',
      },
      common,
    )
    expect(payload).toEqual({
      ...common,
      query_type: 'name',
      result_count: 3,
      zero_results: false,
    })
  })
})

describe('classifySearchQuery', () => {
  test('maps a known area even inside extra words', () => {
    expect(classifySearchQuery('best wifi in San Roque!!')).toEqual({
      query_type: 'area',
      area_name: 'san_roque',
    })
  })

  test('treats a cafe name as name search', () => {
    expect(classifySearchQuery('Kape Batik')).toEqual({ query_type: 'name' })
  })
})

describe('normalizeAcquisitionSource', () => {
  test('maps known UTM sources and collapses the rest', () => {
    expect(normalizeAcquisitionSource({ utmSource: 'Instagram', native: false })).toBe('instagram')
    expect(normalizeAcquisitionSource({ utmSource: 'random-blog', native: false })).toBe('other')
  })

  test('uses organic for search referrers and direct otherwise', () => {
    expect(normalizeAcquisitionSource({
      referrerHost: 'www.google.com',
      native: false,
    })).toBe('organic')
    expect(normalizeAcquisitionSource({ native: true })).toBe('direct')
    expect(normalizeAcquisitionSource({ native: false })).toBe('direct')
  })
})

describe('session dedupe', () => {
  test('throttles the same cafe card per surface', () => {
    const seen = createSessionDedupe()
    expect(seen.once(cardViewKey('a', 'home'))).toBe(true)
    expect(seen.once(cardViewKey('a', 'home'))).toBe(false)
    expect(seen.once(cardViewKey('a', 'search'))).toBe(true)
  })
})

describe('confidence buckets', () => {
  test('legacy stats under the review threshold are unknown', () => {
    expect(confidenceBucketFromLegacyStats({
      total_reviews: 2,
      wifi_available_pct: 100,
      power_available_pct: 100,
    })).toBe('unknown')
  })

  test('legacy stats treat a 50 percent amenity split as mixed', () => {
    expect(confidenceBucketFromLegacyStats({
      total_reviews: 3,
      wifi_available_pct: 50,
      power_available_pct: 80,
    })).toBe('mixed')
  })

  test('legacy stats with a decisive majority are community confirmed', () => {
    expect(confidenceBucketFromLegacyStats({
      total_reviews: 3,
      wifi_available_pct: 80,
      power_available_pct: 80,
    })).toBe('community_confirmed')
  })

  test('resolver mixed availability maps to mixed', () => {
    expect(confidenceBucketFromStatus(status({
      availability: 'mixed',
      confidence: 'community_confirmed',
    }))).toBe('mixed')
  })

  test('cafe bucket uses the lower-trust amenity', () => {
    expect(confidenceBucketFromCafe({
      work: {
        ...UNKNOWN_WORK,
        wifiStatus: status({ availability: 'available', confidence: 'team_verified' }),
        outletsStatus: unknownAmenityStatus(),
      },
    })).toBe('unknown')
  })

  test('conservative and modal helpers', () => {
    expect(conservativeConfidenceBucket(['team_verified', 'reported'])).toBe('reported')
    expect(modalConfidenceBucket(['team_verified', 'team_verified', 'unknown'])).toBe('team_verified')
    expect(modalConfidenceBucket(['team_verified', 'unknown'])).toBe('mixed')
  })
})

describe('detail source', () => {
  test('accepts only the closed enum', () => {
    expect(parseDetailSource('promotion')).toBe('promotion')
    expect(parseDetailSource('https://evil.example')).toBe('feed')
  })
})
