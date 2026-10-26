import { describe, expect, test } from 'bun:test'
import type { Cafe } from '../types/cafe'
import { UNKNOWN_WORK } from './shop-mapper'
import { destinationPoint } from './geo'
import { cafesInsideNearbyRadius, nearbyPreviewBounds } from './nearby-preview'

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

describe('nearby preview radius', () => {
  const origin = { lat: 14.5547, lng: 121.0244 }
  const atFour = destinationPoint(origin, 4_000, 90)
  const justOutside = destinationPoint(origin, 5_001, 180)
  const shops = [
    cafe({ id: 'near', name: 'Near Cup', lat: origin.lat, lng: origin.lng }),
    cafe({ id: 'edge', name: 'Edge Cup', lat: atFour.lat, lng: atFour.lng }),
    cafe({ id: 'beyond', name: 'Beyond Cup', lat: justOutside.lat, lng: justOutside.lng }),
  ]

  test('returns no cafes without a real origin', () => {
    expect(cafesInsideNearbyRadius(shops, null, 5_000)).toEqual([])
    expect(cafesInsideNearbyRadius(shops, undefined, 5_000)).toEqual([])
  })

  test('keeps shops inside the selected radius, including the origin', () => {
    expect(cafesInsideNearbyRadius(shops, origin, 0).map((item) => item.id)).toEqual(['near'])
    expect(cafesInsideNearbyRadius(shops, origin, 5_000).map((item) => item.id)).toEqual(['near', 'edge'])
  })

  test('rebuilds the included set when the selected radius changes', () => {
    expect(cafesInsideNearbyRadius(shops, origin, 1_000).map((item) => item.id)).toEqual(['near'])
    expect(cafesInsideNearbyRadius(shops, origin, 20_000).map((item) => item.id)).toEqual([
      'near',
      'edge',
      'beyond',
    ])
  })

  test('builds a bounding box around the selected radius', () => {
    const bounds = nearbyPreviewBounds(origin, 5_000)
    expect(bounds.south).toBeLessThan(origin.lat)
    expect(bounds.north).toBeGreaterThan(origin.lat)
    expect(bounds.west).toBeLessThan(origin.lng)
    expect(bounds.east).toBeGreaterThan(origin.lng)
  })
})
