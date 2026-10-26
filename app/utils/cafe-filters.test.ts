import { describe, expect, test } from 'bun:test'
import type { Cafe } from '../types/cafe'
import { UNKNOWN_WORK } from './shop-mapper'
import { cafeMatchesFilter, filterCafes } from './cafe-filters'
import { destinationPoint } from './geo'

function cafe(partial: Partial<Cafe> & Pick<Cafe, 'id' | 'name'>): Cafe {
  return {
    address: 'Makati',
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
    lat: 14.55,
    lng: 121.02,
    markerTier: 'standard',
    ...partial,
  }
}

describe('live cafe filters', () => {
  const shops = [
    cafe({
      id: 'near',
      name: 'Near Cup',
      lat: 14.5547,
      lng: 121.0244,
      work: { ...UNKNOWN_WORK, known: true, wifi: true, longStay: true, wifiSpeed: 'fast', wifiTimeLimit: 'unlimited', plug: true, outletReliability: 'easy' },
      amenities: ['wifi', 'plug'],
      popular: true,
      rating: 5,
    }),
    cafe({
      id: 'far',
      name: 'Far Cup',
      lat: 14.7,
      lng: 121.1,
      work: { ...UNKNOWN_WORK, known: true, wifi: false, plug: true, outletReliability: 'scarce' },
      amenities: ['plug'],
    }),
    cafe({ id: 'new', name: 'New Cup' }),
  ]

  test('does not treat unconfirmed amenities as a match', () => {
    expect(cafeMatchesFilter(shops[2]!, 'wifi')).toBe(false)
    expect(cafeMatchesFilter(shops[2]!, 'plugs')).toBe(false)
    expect(cafeMatchesFilter(shops[2]!, 'long-stay')).toBe(false)
  })

  test('filters long-stay, fast wifi, and reliable outlets from aggregates', () => {
    expect(filterCafes(shops, { filter: 'long-stay' }).map((item) => item.id)).toEqual(['near'])
    expect(filterCafes(shops, { filter: 'fast-wifi' }).map((item) => item.id)).toEqual(['near'])
    expect(filterCafes(shops, { filter: 'reliable-outlets' }).map((item) => item.id)).toEqual(['near'])
    expect(filterCafes(shops, { filter: 'plugs' }).map((item) => item.id)).toEqual(['far', 'near'])
  })

  test('sorts Near You by real distance and leaves unknown shops in browse results', () => {
    const near = filterCafes(shops, { filter: 'near', origin: { lat: 14.5547, lng: 121.0244 } })
    expect(near.map((item) => item.id)[0]).toBe('near')
    expect(near.map((item) => item.id)).toContain('new')
  })

  test('keeps every shop when Near You has no origin, even with a radius', () => {
    const near = filterCafes(shops, {
      filter: 'near',
      radiusMeters: 5_000,
    })
    expect(near.map((item) => item.id).sort()).toEqual(['far', 'near', 'new'])
  })

  test('limits Near You to shops inside the selected radius, including the boundary', () => {
    const origin = { lat: 14.5547, lng: 121.0244 }
    const atFour = destinationPoint(origin, 4_000, 90)
    const justOutside = destinationPoint(origin, 5_001, 180)
    const shopsWithRange = [
      shops[0]!,
      cafe({ id: 'edge', name: 'Edge Cup', lat: atFour.lat, lng: atFour.lng }),
      cafe({ id: 'beyond', name: 'Beyond Cup', lat: justOutside.lat, lng: justOutside.lng }),
    ]

    expect(filterCafes(shopsWithRange, {
      filter: 'near',
      origin,
      radiusMeters: 0,
    }).map((item) => item.id)).toEqual(['near'])

    expect(filterCafes(shopsWithRange, {
      filter: 'near',
      origin,
      radiusMeters: 5_000,
    }).map((item) => item.id)).toEqual(['near', 'edge'])
  })

  test('ignores radius when the filter is not Near You', () => {
    const origin = { lat: 14.5547, lng: 121.0244 }
    expect(filterCafes(shops, {
      filter: 'plugs',
      origin,
      radiusMeters: 5_000,
    }).map((item) => item.id)).toEqual(['far', 'near'])
  })

  test('limits another filter to nearby shops and sorts those by distance', () => {
    const origin = { lat: 14.5547, lng: 121.0244 }
    const atTwo = destinationPoint(origin, 2_000, 45)
    const shopsWithRange = [
      shops[1]!,
      cafe({
        id: 'edge',
        name: 'Edge Plug',
        lat: atTwo.lat,
        lng: atTwo.lng,
        work: { ...UNKNOWN_WORK, known: true, plug: true },
        amenities: ['plug'],
      }),
      shops[0]!,
    ]

    expect(filterCafes(shopsWithRange, {
      filter: 'plugs',
      origin,
      radiusMeters: 5_000,
      nearby: true,
    }).map((item) => item.id)).toEqual(['near', 'edge'])

    expect(filterCafes(shopsWithRange, {
      filter: 'popular',
      origin,
      radiusMeters: 5_000,
      nearby: true,
    }).map((item) => item.id)).toEqual(['near'])
  })
})
