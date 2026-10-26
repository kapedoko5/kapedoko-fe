import { describe, expect, test } from 'bun:test'
import {
  METRO_MANILA_CENTER,
  CEBU_CITY_REGIONS,
  DAVAO_CITY_REGIONS,
  boundsContain,
  boundsFromRadius,
  clampQueryBounds,
  coverageBounds,
  isInCoverage,
  isInRegion,
  padBounds,
  pointInBounds,
} from './geography'
import {
  allDayEveryDay,
  isOpenNow,
  isValidClock,
  isValidWeeklyHours,
  sameHoursEveryDay,
  summarizeHours,
} from './hours'
import { isValidPhone, optionalPhone } from './phone'
import { cafeNameError, isValidAddress, isValidCafeName } from './identity'
import { amenitiesFromStats, amenityGapCopy, mapShopToCafe, shopImageUrl, shopLogoUrl, UNKNOWN_WORK, workFactsFromStats } from './shop-mapper'
import { KAPEDOKO_MARK_SRC, logoFileError } from './logo'
import { formatShopStreet } from './geocode'
import { authUserId } from './auth'
import { suggestCafes } from './cafe-search'
import { googleMapsDirectionsUrl } from './maps'
import type { Cafe } from '../types/cafe'
import type { ShopRow } from '../types/shop'

describe('philippines coverage', () => {
  test('accepts the fallback center', () => {
    expect(isInCoverage(METRO_MANILA_CENTER)).toBe(true)
  })

  test('accepts cities across the Philippines', () => {
    expect(isInCoverage({ lat: 14.6507, lng: 121.1029 })).toBe(true) // Marikina
    expect(isInCoverage({ lat: 14.5547, lng: 121.0244 })).toBe(true) // Makati
    expect(isInCoverage({ lat: 14.619, lng: 121.051 })).toBe(true) // Quezon City
    expect(isInCoverage({ lat: 14.423, lng: 121.047 })).toBe(true) // Muntinlupa
    expect(isInCoverage({ lat: 14.5894, lng: 120.9842 })).toBe(true) // Manila
    expect(isInCoverage({ lat: 14.586, lng: 121.175 })).toBe(true) // Antipolo
    expect(isInCoverage({ lat: 14.359, lng: 121.056 })).toBe(true) // San Pedro
    expect(isInCoverage({ lat: 16.4023, lng: 120.596 })).toBe(true) // Baguio
    expect(isInCoverage({ lat: 10.3157, lng: 123.8854 })).toBe(true) // Cebu
    expect(isInCoverage({ lat: 10.7202, lng: 122.5621 })).toBe(true) // Iloilo
    expect(isInCoverage({ lat: 11.9674, lng: 121.9248 })).toBe(true) // Boracay
    expect(isInCoverage({ lat: 9.3068, lng: 123.3054 })).toBe(true) // Dumaguete
    expect(isInCoverage({ lat: 11.2444, lng: 125.0039 })).toBe(true) // Tacloban
    expect(isInCoverage({ lat: 8.4542, lng: 124.6319 })).toBe(true) // Cagayan de Oro
    expect(isInCoverage({ lat: 7.1907, lng: 125.4553 })).toBe(true) // Davao
    expect(isInCoverage({ lat: 6.1164, lng: 125.1716 })).toBe(true) // General Santos
    expect(isInCoverage({ lat: 9.7392, lng: 118.7353 })).toBe(true) // Puerto Princesa
    expect(isInCoverage({ lat: 6.9214, lng: 122.079 })).toBe(true) // Zamboanga
    expect(isInCoverage({ lat: 5.0292, lng: 119.7731 })).toBe(true) // Bongao
  })

  test('catalog cities include Cebu City and Davao City halls and exclude neighbors', () => {
    expect(CEBU_CITY_REGIONS.some((region) => isInRegion({ lat: 10.3157, lng: 123.8854 }, region))).toBe(true)
    expect(CEBU_CITY_REGIONS.some((region) => isInRegion({ lat: 10.332, lng: 123.942 }, region))).toBe(false)
    expect(DAVAO_CITY_REGIONS.some((region) => isInRegion({ lat: 7.1907, lng: 125.4553 }, region))).toBe(true)
    expect(DAVAO_CITY_REGIONS.some((region) => isInRegion({ lat: 7.447, lng: 125.808 }, region))).toBe(false)
  })

  test('rejects points outside the Philippines', () => {
    expect(isInCoverage({ lat: 1.3521, lng: 103.8198 })).toBe(false) // Singapore
    expect(isInCoverage({ lat: 35.6762, lng: 139.6503 })).toBe(false) // Tokyo
    expect(isInCoverage({ lat: 5.9804, lng: 116.0735 })).toBe(false) // Kota Kinabalu
    expect(isInCoverage({ lat: 13.5, lng: 119.0 })).toBe(false) // open sea west of Luzon
  })

  test('fallback sits inside the region bounds', () => {
    const bounds = coverageBounds()
    expect(METRO_MANILA_CENTER.lat).toBeGreaterThan(bounds.south)
    expect(METRO_MANILA_CENTER.lat).toBeLessThan(bounds.north)
    expect(METRO_MANILA_CENTER.lng).toBeGreaterThan(bounds.west)
    expect(METRO_MANILA_CENTER.lng).toBeLessThan(bounds.east)
  })

  test('viewport queries pad and clamp map bounds', () => {
    const origin = METRO_MANILA_CENTER
    const tight = boundsFromRadius(origin, 1_000)
    const padded = padBounds(tight, 0.3)
    expect(boundsContain(padded, tight)).toBe(true)
    expect(pointInBounds(origin, tight)).toBe(true)

    const city = boundsFromRadius(origin, 20_000)
    const clamped = clampQueryBounds(origin, city, 8_000)
    expect(clamped.north - clamped.south).toBeLessThan(city.north - city.south)
    expect(pointInBounds(origin, clamped)).toBe(true)
  })
})

describe('hours', () => {
  test('validates clock strings', () => {
    expect(isValidClock('09:00')).toBe(true)
    expect(isValidClock('24:00')).toBe(false)
    expect(isValidClock('9:00')).toBe(false)
  })

  test('same hours fill the week', () => {
    const hours = sameHoursEveryDay('08:00', '18:00')
    expect(isValidWeeklyHours(hours)).toBe(true)
    expect(summarizeHours(hours)).toBe('8:00am–6:00pm')
  })

  test('24 hours is always open', () => {
    expect(isOpenNow(allDayEveryDay(), new Date('2026-09-07T12:00:00+08:00'))).toBe(true)
  })

  test('overnight hours carry past midnight', () => {
    const hours = sameHoursEveryDay('22:00', '02:00')
    expect(isOpenNow(hours, new Date('2026-09-07T23:30:00+08:00'))).toBe(true)
    expect(isOpenNow(hours, new Date('2026-09-08T01:30:00+08:00'))).toBe(true)
    expect(isOpenNow(hours, new Date('2026-09-08T03:00:00+08:00'))).toBe(false)
  })
})

describe('phone and identity', () => {
  test('accepts PH mobile numbers', () => {
    expect(isValidPhone('+63 917 123 4567')).toBe(true)
    expect(isValidPhone('09171234567')).toBe(true)
    expect(isValidPhone('abc')).toBe(false)
    expect(optionalPhone('')).toBeNull()
  })

  test('validates cafe names and addresses', () => {
    expect(isValidCafeName('Yardstick')).toBe(true)
    expect(cafeNameError('')).toBe('Enter the cafe name.')
    expect(isValidAddress('Shoe Ave, Marikina')).toBe(true)
    expect(isValidAddress('Short')).toBe(false)
  })
})

describe('auth user id', () => {
  test('reads id from a user object or sub from JWT claims', () => {
    expect(authUserId({ id: 'user-1' })).toBe('user-1')
    expect(authUserId({ sub: 'user-2', email: 'a@b.com' })).toBe('user-2')
    expect(authUserId(null)).toBeNull()
  })
})

describe('shop street line', () => {
  test('prefers road and barangay over the Nominatim dump', () => {
    expect(formatShopStreet({
      display_name: 'Bayan-Bayanan Avenue, Amang Rodriguez Village, Concepcion Uno, District II, Marikina, Eastern Manila District, Metro Manila, 1807, Philippines',
      address: { road: 'Bayan-Bayanan Avenue', suburb: 'Concepcion Uno', city: 'Marikina' },
    })).toBe('Bayan-Bayanan Avenue, Concepcion Uno, Marikina')
  })

  test('strips region noise from a display name', () => {
    expect(formatShopStreet({
      display_name: 'Shoe Ave, San Roque, Marikina, Metro Manila, 1800, Philippines',
    })).toBe('Shoe Ave, San Roque, Marikina')
  })

  test('keeps the Nominatim city instead of forcing Marikina', () => {
    expect(formatShopStreet({
      display_name: '26th Street, Bonifacio Global City, Taguig, Metro Manila, 1634, Philippines',
      address: { road: '26th Street', suburb: 'Bonifacio Global City', city: 'Taguig' },
    })).toBe('26th Street, Bonifacio Global City, Taguig')
  })
})

describe('amenities from reviews', () => {
  test('stays unknown below the review threshold', () => {
    expect(amenitiesFromStats({
      shop_id: '1',
      total_reviews: 2,
      wifi_yes_count: 2,
      wifi_available_pct: 100,
      wifi_speed_mode: 'fast',
      wifi_time_limit_mode: 'unlimited',
      power_yes_count: 2,
      power_available_pct: 100,
      recommend_pct: 100,
    })).toEqual([])
  })

  test('says when amenities are still unconfirmed', () => {
    expect(workFactsFromStats({
      shop_id: '1',
      total_reviews: 2,
      wifi_yes_count: 2,
      wifi_available_pct: 100,
      wifi_speed_mode: 'fast',
      wifi_time_limit_mode: 'unlimited',
      power_yes_count: 2,
      power_available_pct: 100,
      recommend_pct: 100,
    }).known).toBe(false)
    expect(amenityGapCopy(UNKNOWN_WORK, [])).toBe('WiFi and outlets unknown')
    expect(amenityGapCopy({
      ...UNKNOWN_WORK,
      known: true,
      wifi: false,
      plug: false,
    }, 'none')).toBe('No WiFi or power outlets')
  })

  test('requires enough reviews before claiming no amenities', () => {
    expect(amenitiesFromStats({
      shop_id: '1',
      total_reviews: 5,
      wifi_yes_count: 0,
      wifi_available_pct: 0,
      wifi_speed_mode: null,
      wifi_time_limit_mode: null,
      power_yes_count: 0,
      power_available_pct: 0,
      recommend_pct: 40,
    })).toBe('none')
  })
})

describe('logo files', () => {
  test('rejects oversized or wrong-type files', () => {
    const png = { type: 'image/png', size: 1200 } as File
    const pdf = { type: 'application/pdf', size: 1200 } as File
    const huge = { type: 'image/jpeg', size: 3 * 1024 * 1024 } as File
    expect(logoFileError(png)).toBeNull()
    expect(logoFileError(pdf)).toBe('Use a JPG, PNG, or WebP image.')
    expect(logoFileError(huge)).toBe('Keep the logo under 2 MB.')
  })
})

describe('shop image urls', () => {
  const shop = {
    logo_object_key: 'shop-logos/user/logo.png',
    cover_photo_url: null as string | null,
  }

  test('builds a public r2.dev url', () => {
    expect(shopImageUrl(shop, 'https://pub-abc.r2.dev/')).toBe(
      'https://pub-abc.r2.dev/shop-logos/user/logo.png',
    )
  })

  test('ignores the private S3 API host', () => {
    expect(
      shopImageUrl(shop, 'https://80fe00aa3cade8afa8a9436eb980192f.r2.cloudflarestorage.com'),
    ).toBe(KAPEDOKO_MARK_SRC)
  })

  test('exposes a logo url only for public assets', () => {
    expect(shopLogoUrl(shop, 'https://pub-abc.r2.dev')).toBe(
      'https://pub-abc.r2.dev/shop-logos/user/logo.png',
    )
    expect(shopLogoUrl(shop, '')).toBeNull()
  })
})

describe('shop to cafe mapping', () => {
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
    logo_object_key: 'shop-logos/user/logo.png',
    contact_number: null,
    status: 'approved',
    submitted_by: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: '2026-09-09T00:00:00.000Z',
    updated_at: '2026-09-09T00:00:00.000Z',
  }

  test('carries the effective marker tier and public logo', () => {
    const cafe = mapShopToCafe(shop, null, 'https://pub-abc.r2.dev', 'promoted')
    expect(cafe.markerTier).toBe('promoted')
    expect(cafe.image).toBe('https://pub-abc.r2.dev/shop-logos/user/logo.png')
  })

  test('defaults unpaid shops to the standard pin', () => {
    expect(mapShopToCafe(shop).markerTier).toBe('standard')
  })

  test('carries OSM source for attribution', () => {
    expect(mapShopToCafe({ ...shop, source: 'openstreetmap' }).source).toBe('openstreetmap')
  })

  test('carries team-visit payment facts', () => {
    expect(mapShopToCafe(shop).payment).toBeNull()
    expect(mapShopToCafe(shop, null, undefined, 'standard', undefined, {
      qr: 'available',
      card: 'unavailable',
      cash: 'available',
      sourceAt: '2026-10-02T00:00:00.000Z',
    }).payment).toEqual({
      qr: 'available',
      card: 'unavailable',
      cash: 'available',
      sourceAt: '2026-10-02T00:00:00.000Z',
    })
  })
})

describe('cafe search suggestions', () => {
  const stub = (id: string, name: string, address: string, lat: number, lng: number): Cafe => ({
    id,
    name,
    address,
    image: '',
    photos: [],
    open: true,
    status: 'Open',
    hoursHint: '',
    amenities: [],
    work: { ...UNKNOWN_WORK },
    popular: false,
    rating: 0,
    ratingLabel: 'New',
    checkIns30d: 0,
    reviews: [],
    lat,
    lng,
    markerTier: 'standard',
  })

  test('ranks name prefix matches ahead of address hits', () => {
    const origin = { lat: 14.5547, lng: 121.0244 }
    const cafes = [
      stub('far', 'Other Cup', 'Makati Avenue, Makati', 14.6, 121.08),
      stub('near', 'Makati Cafe', 'Makati Avenue, Makati', 14.5547, 121.0244),
      stub('name', 'Makati Roasters', 'Poblacion, Makati', 14.57, 121.03),
    ]

    expect(suggestCafes(cafes, 'maka', origin).map((cafe) => cafe.id)).toEqual([
      'near',
      'name',
      'far',
    ])
  })
})

describe('google maps directions', () => {
  test('builds a free Google Maps directions url from coordinates', () => {
    expect(googleMapsDirectionsUrl(14.5547, 121.0244)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=14.5547%2C121.0244',
    )
  })
})
