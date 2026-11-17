import { describe, expect, test } from 'bun:test'
import {
  amenityBagPress,
  amenityBagValue,
  amenityCardLabel,
  amenityEvidenceLabel,
  amenityFactMeta,
  amenityFilterHint,
  amenityGapCopyFromStatus,
  amenityPressLabel,
  amenityStampKind,
  auditQueueRows,
  DEFAULT_AMENITY_CONFIG,
  resolveAmenity,
  trustedPositive,
  unknownAmenityStatus,
  workFactsFromResolutions,
} from './amenity-status'

const day = (offset: number, now = '2026-10-02T00:00:00.000Z') => {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString()
}

const votes = (list: Array<'yes' | 'no' | 'unsure'>, at = '2026-09-01T00:00:00.000Z') =>
  list.map((vote) => ({ vote, votedAt: at }))

describe('amenity resolution mirror', () => {
  const now = new Date('2026-10-02T00:00:00.000Z')

  test('1 no evidence is unknown', () => {
    expect(resolveAmenity({ now })).toEqual(unknownAmenityStatus())
  })

  test('2 seed only is reported', () => {
    expect(resolveAmenity({
      seed: { result: 'available', observedAt: '2026-08-01T00:00:00.000Z' },
      now,
    })).toMatchObject({ availability: 'available', confidence: 'reported' })
  })

  test('3 one yes review is reported', () => {
    expect(resolveAmenity({ votes: votes(['yes']), now })).toMatchObject({
      availability: 'available',
      confidence: 'reported',
      decidedCount: 1,
    })
  })

  test('4 two yes reviews are reported', () => {
    expect(resolveAmenity({ votes: votes(['yes', 'yes']), now })).toMatchObject({
      availability: 'available',
      confidence: 'reported',
    })
  })

  test('5 three decided 2-1 is community confirmed available', () => {
    expect(resolveAmenity({ votes: votes(['yes', 'yes', 'no']), now })).toMatchObject({
      availability: 'available',
      confidence: 'community_confirmed',
    })
  })

  test('6 three decided 1-2 is community confirmed unavailable', () => {
    expect(resolveAmenity({ votes: votes(['yes', 'no', 'no']), now })).toMatchObject({
      availability: 'unavailable',
      confidence: 'community_confirmed',
    })
  })

  test('7 four decided 2-2 is mixed community confirmed', () => {
    expect(resolveAmenity({ votes: votes(['yes', 'yes', 'no', 'no']), now })).toMatchObject({
      availability: 'mixed',
      confidence: 'community_confirmed',
    })
  })

  test('8 two decided 1-1 is mixed reported', () => {
    expect(resolveAmenity({ votes: votes(['yes', 'no']), now })).toMatchObject({
      availability: 'mixed',
      confidence: 'reported',
    })
  })

  test('9 three unsure reviews stay unknown', () => {
    expect(resolveAmenity({ votes: votes(['unsure', 'unsure', 'unsure']), now })).toEqual(unknownAmenityStatus())
  })

  test('10 two decided plus one unsure is reported not confirmed', () => {
    expect(resolveAmenity({ votes: votes(['yes', 'yes', 'unsure']), now })).toMatchObject({
      availability: 'available',
      confidence: 'reported',
    })
  })

  test('11 flagged votes are omitted by the caller', () => {
    expect(resolveAmenity({ votes: votes(['yes', 'yes']), now }).confidence).toBe('reported')
  })

  test('owner proof is owner verified and beats community', () => {
    const resolved = resolveAmenity({
      owner: { reviewedAt: '2026-09-20T00:00:00.000Z', wifiDownloadMbps: 42 },
      votes: votes(['no', 'no', 'no']),
      now,
    })
    expect(resolved).toMatchObject({
      availability: 'available',
      confidence: 'owner_verified',
      wifiSpeed: 'fast',
    })
    expect(trustedPositive(resolved)).toBe(true)
    expect(amenityCardLabel('wifi', resolved)).toBe('Verified')
    expect(amenityStampKind(resolved)).toBe('owner')
    expect(amenityBagPress(resolved, resolved)).toBe('Verified · Sep 20, 2026')
  })

  test('newer owner proof beats an older team audit', () => {
    expect(resolveAmenity({
      audit: { result: 'unavailable', auditedAt: '2026-08-01T00:00:00.000Z' },
      owner: { reviewedAt: '2026-09-20T00:00:00.000Z', wifiDownloadMbps: 12 },
      now,
    })).toMatchObject({
      availability: 'available',
      confidence: 'owner_verified',
      wifiSpeed: 'okay',
    })
  })

  test('newer team audit still beats owner proof', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-10-01T00:00:00.000Z' },
      owner: { reviewedAt: '2026-09-20T00:00:00.000Z', wifiDownloadMbps: 80 },
      now,
    })).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
    })
  })

  test('12 team audit with no reviews is team verified', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-09-01T00:00:00.000Z' },
      now,
    })).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
      needsRecheck: false,
      isStale: false,
    })
  })

  test('13 two recent opposite votes are not enough to recheck', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-08-01T00:00:00.000Z' },
      votes: votes(['no', 'no'], '2026-09-01T00:00:00.000Z'),
      now,
    }).needsRecheck).toBe(false)
  })

  test('14 three recent opposite votes with majority trigger recheck and keep audit value', () => {
    const resolved = resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-08-01T00:00:00.000Z' },
      votes: votes(['no', 'no', 'no'], '2026-09-01T00:00:00.000Z'),
      now,
    })
    expect(resolved).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
      needsRecheck: true,
    })
  })

  test('15 three recent votes that still agree do not recheck', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-08-01T00:00:00.000Z' },
      votes: votes(['yes', 'yes', 'no'], '2026-09-01T00:00:00.000Z'),
      now,
    }).needsRecheck).toBe(false)
  })

  test('16 recent 2-2 tie does not recheck', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-08-01T00:00:00.000Z' },
      votes: votes(['yes', 'yes', 'no', 'no'], '2026-09-01T00:00:00.000Z'),
      now,
    }).needsRecheck).toBe(false)
  })

  test('17 opposite votes older than 90 days do not recheck', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: day(-200, now.toISOString()) },
      votes: votes(['no', 'no', 'no'], day(-100, now.toISOString())),
      now,
    }).needsRecheck).toBe(false)
  })

  test('18 opposite votes before the audit do not recheck', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-09-01T00:00:00.000Z' },
      votes: votes(['no', 'no', 'no'], '2026-08-01T00:00:00.000Z'),
      now,
    }).needsRecheck).toBe(false)
  })

  test('19 audit 179 days old is not stale', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: day(-179, now.toISOString()) },
      now,
    }).isStale).toBe(false)
  })

  test('20 audit 181 days old is stale and still trusted', () => {
    const resolved = resolveAmenity({
      audit: { result: 'available', auditedAt: day(-181, now.toISOString()) },
      now,
    })
    expect(resolved.isStale).toBe(true)
    expect(trustedPositive(resolved)).toBe(true)
  })

  test('21 stale plus recheck keeps both flags', () => {
    const resolved = resolveAmenity({
      audit: { result: 'available', auditedAt: day(-181, now.toISOString()) },
      votes: votes(['no', 'no', 'no'], day(-1, now.toISOString())),
      now,
    })
    expect(resolved.isStale).toBe(true)
    expect(resolved.needsRecheck).toBe(true)
    expect(resolved.availability).toBe('available')
  })

  test('22 later correction audit wins', () => {
    expect(resolveAmenity({
      audit: { result: 'unavailable', auditedAt: '2026-09-20T00:00:00.000Z' },
      now,
    }).availability).toBe('unavailable')
  })

  test('24 voided audit is omitted by the caller and reviews remain', () => {
    expect(resolveAmenity({
      votes: votes(['yes', 'yes']),
      now,
    }).confidence).toBe('reported')
  })

  test('25 one review outranks a seed and does not count the seed as a vote', () => {
    expect(resolveAmenity({
      votes: votes(['no']),
      seed: { result: 'available', observedAt: '2026-01-01T00:00:00.000Z' },
      now,
    })).toMatchObject({
      availability: 'unavailable',
      confidence: 'reported',
      decidedCount: 1,
    })
  })

  test('26 unknown audit result falls through to community', () => {
    expect(resolveAmenity({
      audit: { result: 'unknown', auditedAt: '2026-09-01T00:00:00.000Z' },
      votes: votes(['yes', 'yes', 'yes']),
      now,
    })).toMatchObject({
      availability: 'available',
      confidence: 'community_confirmed',
    })
  })

  test('27 long-stay unknown when stance is unknown even if wifi is available', () => {
    expect(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-09-01T00:00:00.000Z', longStayStance: 'unknown' },
      now,
    }).wifiTimeLimit).toBeNull()
  })

  test('28 long-stay welcome sets unlimited on a positive wifi audit', () => {
    expect(resolveAmenity({
      audit: {
        result: 'available',
        auditedAt: '2026-09-01T00:00:00.000Z',
        longStayStance: 'welcome',
        wifiDownloadMbps: 40,
      },
      now,
    })).toMatchObject({ wifiTimeLimit: 'unlimited', wifiSpeed: 'fast' })
  })

  test('raising the decided minimum keeps a 2-1 split reported', () => {
    expect(resolveAmenity({
      votes: votes(['yes', 'yes', 'no']),
      config: { communityMinDecided: 5 },
      now,
    }).confidence).toBe('reported')
  })
})

describe('trusted filters and labels', () => {
  test('filters include only trusted positive statuses', () => {
    expect(trustedPositive(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-09-01T00:00:00.000Z' },
    }))).toBe(true)
    expect(trustedPositive(resolveAmenity({ votes: votes(['yes']) }))).toBe(false)
    expect(trustedPositive(resolveAmenity({ votes: votes(['yes', 'yes', 'no', 'no']) }))).toBe(false)
    expect(trustedPositive(resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-08-01T00:00:00.000Z' },
      votes: votes(['no', 'no', 'no'], '2026-09-01T00:00:00.000Z'),
    }))).toBe(false)
    expect(trustedPositive(resolveAmenity({
      audit: { result: 'available', auditedAt: day(-181) },
      now: new Date('2026-10-02T00:00:00.000Z'),
    }))).toBe(true)
    expect(trustedPositive(resolveAmenity({
      owner: { reviewedAt: '2026-09-20T00:00:00.000Z' },
    }))).toBe(true)
  })

  test('card copy names each display state', () => {
    expect(amenityCardLabel('wifi', unknownAmenityStatus())).toBe('Unknown')
    expect(amenityCardLabel('wifi', resolveAmenity({ votes: votes(['yes']) }))).toBe('Reported')
    expect(amenityCardLabel('wifi', resolveAmenity({ votes: votes(['no']) }))).toBe('Reported: no WiFi')
    expect(amenityCardLabel('outlets', resolveAmenity({ votes: votes(['yes', 'yes', 'yes']) }))).toBe('KapéBeans')
    expect(amenityCardLabel('outlets', resolveAmenity({ votes: votes(['no', 'no', 'no']) }))).toBe('No outlets')
    expect(amenityCardLabel('wifi', resolveAmenity({ votes: votes(['yes', 'no']) }))).toBe('Mixed reports')
    expect(amenityCardLabel('wifi', resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-09-01T00:00:00.000Z' },
    }))).toBe('Verified')
    expect(amenityPressLabel('wifi', resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-09-01T00:00:00.000Z' },
    }))).toBe('Verified')
    expect(amenityCardLabel('wifi', resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-08-01T00:00:00.000Z' },
      votes: votes(['no', 'no', 'no'], '2026-09-01T00:00:00.000Z'),
    }))).toBe('Needs recheck')
    const verified = resolveAmenity({
      audit: { result: 'available', auditedAt: '2026-10-02T00:00:00.000Z' },
      votes: votes(['yes', 'yes', 'yes']),
    })
    expect(amenityStampKind(verified)).toBe('team')
    expect(amenityFactMeta(verified)).toBe('Oct 2, 2026')
    expect(amenityEvidenceLabel(verified)).toBeNull()
    expect(amenityStampKind(resolveAmenity({ votes: votes(['yes', 'yes', 'yes']) }))).toBe('community')
    expect(amenityEvidenceLabel(resolveAmenity({ votes: votes(['yes', 'yes', 'yes']) }))).toBe('3 KapéBeans')
    expect(amenityStampKind(unknownAmenityStatus())).toBe('unknown')
    expect(amenityBagValue('wifi', verified)).toBe('Yes')
    expect(amenityBagPress(verified, verified)).toBe('Verified · Oct 2, 2026')
    expect(amenityBagPress(
      resolveAmenity({ votes: votes(['yes', 'yes', 'yes']) }),
      resolveAmenity({ votes: votes(['yes', 'yes', 'yes']) }),
    )).toBe('KapéBeans')
  })

  test('gap copy stays unknown until both amenities are trusted negatives', () => {
    const wifi = resolveAmenity({ votes: votes(['no', 'no', 'no']) })
    const outlets = resolveAmenity({ votes: votes(['no', 'no', 'no']) })
    expect(amenityGapCopyFromStatus(unknownAmenityStatus(), unknownAmenityStatus())).toBe('WiFi and outlets unknown')
    expect(amenityGapCopyFromStatus(wifi, outlets)).toBe('No WiFi or power outlets')
  })

  test('maps resolution rows onto work facts for filters', () => {
    const work = workFactsFromResolutions([
      {
        shop_id: '1',
        amenity_key: 'wifi',
        availability: 'available',
        confidence: 'team_verified',
        source_at: '2026-09-01T00:00:00.000Z',
        decided_count: 0,
        yes_count: 0,
        no_count: 0,
        is_stale: false,
        needs_recheck: false,
        wifi_speed: 'fast',
        wifi_time_limit: 'unlimited',
      },
      {
        shop_id: '1',
        amenity_key: 'outlets',
        availability: 'available',
        confidence: 'community_confirmed',
        source_at: '2026-09-01T00:00:00.000Z',
        decided_count: 3,
        yes_count: 3,
        no_count: 0,
        is_stale: false,
        needs_recheck: false,
        outlet_reliability: 'easy',
      },
      {
        shop_id: '1',
        amenity_key: 'long_stay_wifi',
        availability: 'available',
        confidence: 'team_verified',
        source_at: '2026-09-01T00:00:00.000Z',
        decided_count: 0,
        yes_count: 0,
        no_count: 0,
        is_stale: false,
        needs_recheck: false,
      },
    ])
    expect(work.wifi).toBe(true)
    expect(work.plug).toBe(true)
    expect(work.longStay).toBe(true)
    expect(work.wifiSpeed).toBe('fast')
    expect(work.outletReliability).toBe('easy')
  })

  test('filter hint only appears on amenity chips', () => {
    expect(amenityFilterHint('wifi')).toMatch(/team-verified/)
    expect(amenityFilterHint('near')).toBeNull()
    expect(DEFAULT_AMENITY_CONFIG.communityMajorityRatio).toBe(0.5)
  })

  test('audit queue keeps recheck before stale and hides current rows', () => {
    expect(auditQueueRows([
      { shop_id: 'fresh', needs_recheck: false, is_stale: false, source_at: '2025-01-01T00:00:00.000Z' },
      { shop_id: 'stale-old', needs_recheck: false, is_stale: true, source_at: '2025-06-01T00:00:00.000Z' },
      { shop_id: 'stale-new', needs_recheck: false, is_stale: true, source_at: '2026-01-01T00:00:00.000Z' },
      { shop_id: 'recheck', needs_recheck: true, is_stale: true, source_at: '2026-09-01T00:00:00.000Z' },
    ]).map((row) => row.shop_id)).toEqual(['recheck', 'stale-old', 'stale-new'])
  })
})
