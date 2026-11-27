import { describe, expect, test } from 'bun:test'
import {
  completenessInputFromShop,
  hoursAreSet,
  scoreListing,
  verifiedAmenityGroups,
  type ListingCompletenessInput,
} from './listing-completeness'
import type { ShopAmenityVerificationRow, WeeklyHours } from '../types/shop'

const SHOP = '11111111-1111-4111-8111-111111111111'

const full: ListingCompletenessInput = {
  shopId: SHOP,
  hasLogo: true,
  hasHours: true,
  hasPhone: true,
  photoCount: 3,
  photoCap: 3,
  vibeCount: 5,
  verifiedAmenityCount: 4,
  hasPoster: true,
}

const empty: ListingCompletenessInput = {
  shopId: SHOP,
  hasLogo: false,
  hasHours: false,
  hasPhone: false,
  photoCount: 0,
  photoCap: 3,
  vibeCount: 0,
  verifiedAmenityCount: 0,
  hasPoster: false,
}

describe('listing completeness', () => {
  test('a full listing scores 100 with nothing missing', () => {
    const result = scoreListing(full)
    expect(result.score).toBe(100)
    expect(result.missing).toEqual([])
  })

  test('an empty listing scores 0 and lists everything', () => {
    const result = scoreListing(empty)
    expect(result.score).toBe(0)
    expect(result.missing).toHaveLength(7)
  })

  test('weights sum to 100', () => {
    expect(scoreListing(empty).items.reduce((sum, item) => sum + item.weight, 0)).toBe(100)
  })

  test('photos score against the cap, and the cap changes the bar', () => {
    const free = scoreListing({ ...empty, photoCount: 3, photoCap: 3 }).items.find((i) => i.id === 'photos')
    expect(free?.done).toBe(true)
    const partner = scoreListing({ ...empty, photoCount: 4, photoCap: 8 })
    const photos = partner.items.find((i) => i.id === 'photos')
    expect(photos?.done).toBe(false)
    expect(photos?.progress).toBe('4 of 8')
    expect(partner.score).toBe(10)
  })

  test('vibe tags count up to five and extras do not overflow', () => {
    expect(scoreListing({ ...empty, vibeCount: 2 }).score).toBe(6)
    expect(scoreListing({ ...empty, vibeCount: 9 }).score).toBe(15)
  })

  test('each missing item links to its editor', () => {
    const missing = scoreListing(empty).missing
    const to = (id: string) => missing.find((item) => item.id === id)?.to
    expect(to('logo')).toBe(`/owner/cafes/${SHOP}`)
    expect(to('hours')).toBe(`/owner/cafes/${SHOP}`)
    expect(to('phone')).toBe(`/owner/cafes/${SHOP}`)
    expect(to('photos')).toBe(`/owner/cafes/${SHOP}`)
    expect(to('vibes')).toBe(`/owner/cafes/${SHOP}`)
    expect(to('amenities')).toBe(`/owner/cafes/${SHOP}/verify`)
    expect(to('poster')).toBe('/owner/ads')
  })

  test('hours count only when a day is open', () => {
    const closed = { kind: 'closed' } as const
    const week = (monday: WeeklyHours['mon']): WeeklyHours => ({
      mon: monday, tue: closed, wed: closed, thu: closed, fri: closed, sat: closed, sun: closed,
    })
    expect(hoursAreSet(null)).toBe(false)
    expect(hoursAreSet(week(closed))).toBe(false)
    expect(hoursAreSet(week({ kind: 'open', open: '08:00', close: '17:00' }))).toBe(true)
    expect(hoursAreSet(week({ kind: 'all_day' }))).toBe(true)
  })

  test('counts distinct approved amenity groups for the shop only', () => {
    const base = {
      shop_id: SHOP, status: 'approved', include_wifi: false, include_seating: false,
      include_outlets: false, include_payment: false,
    }
    const rows = [
      { ...base, id: '1', include_wifi: true, include_outlets: true },
      { ...base, id: '2', include_wifi: true },
      { ...base, id: '3', status: 'pending', include_seating: true },
      { ...base, id: '4', shop_id: 'other', include_payment: true },
    ] as unknown as ShopAmenityVerificationRow[]
    expect(verifiedAmenityGroups(rows, SHOP)).toBe(2)
  })

  test('builds input from a shop row', () => {
    const input = completenessInputFromShop(
      { id: SHOP, logo_object_key: ' ', hours: null, contact_number: '0917', gallery_object_keys: ['a', 'b'] },
      { photoCap: 3, vibeCount: 1, verifiedAmenityCount: 0, hasPoster: false },
    )
    expect(input.hasLogo).toBe(false)
    expect(input.hasPhone).toBe(true)
    expect(input.photoCount).toBe(2)
  })
})
