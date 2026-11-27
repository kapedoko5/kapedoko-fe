import type { LatLng } from '../types/cafe'
import {
  statusFromResolutionRow,
  trustedPositive,
  type ShopAmenityResolutionRow,
} from './amenity-status'
import type { CafeFilterId } from './cafe-filters'
import { distanceMeters } from './geo'
import type { ShopReviewStatsRow } from '../types/shop'

/** Cards requested per scroll. The screen shows this page, not the whole catalog. */
export const CAFE_FEED_PAGE_SIZE = 12

/** Mirrors shop-mapper popular threshold: 3 reviews and 70% would recommend. */
export const POPULAR_REVIEW_MIN = 3
export const POPULAR_RECOMMEND_PCT = 70

const LOCATION_WAIT_MS = 3_000

export { LOCATION_WAIT_MS }

export type CafeFeedMode = 'nearby' | 'browse' | 'filter' | 'search'

export function cafeFeedMode(input: {
  filter: CafeFilterId
  query: string
  origin: LatLng | null
  nearby: boolean
  vibe?: boolean
}): CafeFeedMode {
  if (input.query.trim()) return 'search'
  const scoped = input.filter === 'near' || input.nearby
  if (scoped && input.origin) return 'nearby'
  if (input.filter !== 'near' || input.vibe) return 'filter'
  return 'browse'
}

export function feedCountLabel(loaded: number, total: number | null, hasMore: boolean): string {
  const noun = (count: number) => `${count} ${count === 1 ? 'shop' : 'shops'}`
  if (total == null) return noun(loaded)
  if (hasMore && loaded < total) return `${loaded} of ${noun(total)}`
  return noun(total)
}

export function slicePage<T>(items: readonly T[], offset: number, pageSize = CAFE_FEED_PAGE_SIZE): {
  page: T[]
  hasMore: boolean
  nextOffset: number
} {
  const start = Math.max(0, offset)
  const size = Math.max(1, pageSize)
  const page = items.slice(start, start + size)
  const nextOffset = start + page.length
  return {
    page,
    hasMore: nextOffset < items.length,
    nextOffset,
  }
}

export function rankShopsByDistance<T extends { id: string; name: string; lat: number; lng: number }>(
  shops: readonly T[],
  origin: LatLng,
  radiusMeters: number,
): T[] {
  return shops
    .filter((shop) => Number.isFinite(shop.lat) && Number.isFinite(shop.lng))
    .map((shop) => ({ shop, distance: distanceMeters(origin, shop) }))
    .filter((entry) => entry.distance <= radiusMeters)
    .sort((a, b) => (
      a.distance - b.distance
      || a.shop.name.localeCompare(b.shop.name)
      || a.shop.id.localeCompare(b.shop.id)
    ))
    .map((entry) => entry.shop)
}

export function isPopularReviewStats(
  row: Pick<ShopReviewStatsRow, 'total_reviews' | 'recommend_pct'>,
): boolean {
  return row.total_reviews >= POPULAR_REVIEW_MIN && (row.recommend_pct ?? 0) >= POPULAR_RECOMMEND_PCT
}

export function amenityFilterSpec(filter: CafeFilterId): {
  key: string
  wifiSpeed?: string
  outletReliability?: string
} | null {
  if (filter === 'wifi') return { key: 'wifi' }
  if (filter === 'plugs') return { key: 'outlets' }
  if (filter === 'long-stay') return { key: 'long_stay_wifi' }
  if (filter === 'fast-wifi') return { key: 'wifi', wifiSpeed: 'fast' }
  if (filter === 'reliable-outlets') return { key: 'outlets', outletReliability: 'easy' }
  return null
}

export function amenityRowMatchesFilter(row: ShopAmenityResolutionRow, filter: CafeFilterId): boolean {
  const spec = amenityFilterSpec(filter)
  if (!spec || row.amenity_key !== spec.key) return false
  const status = statusFromResolutionRow(row)
  if (!trustedPositive(status)) return false
  if (spec.wifiSpeed && status.wifiSpeed !== spec.wifiSpeed) return false
  if (spec.outletReliability && status.outletReliability !== spec.outletReliability) return false
  return true
}
