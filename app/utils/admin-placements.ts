import type { MarkerTier, ShopPlacementKind, ShopPlacementRow } from '../types/shop'
import type { PlacementLifecycle } from '../types/admin'
import { isPlacementActive, markerTierToKind } from './marker-tier'

export function placementWindowError(startsAt: string, endsAt: string): string | null {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return 'Choose a start and end time.'
  }
  if (end <= start) return 'Choose an end date after the start date.'
  return null
}

export function placementLifecycle(
  placement: Pick<ShopPlacementRow, 'starts_at' | 'ends_at'>,
  now = new Date(),
): PlacementLifecycle {
  const start = new Date(placement.starts_at).getTime()
  const end = new Date(placement.ends_at).getTime()
  const at = now.getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'ended'
  if (start > at) return 'scheduled'
  if (isPlacementActive(placement, now)) return 'current'
  return 'ended'
}

export function placementKindFromTier(tier: MarkerTier): ShopPlacementKind | 'standard' {
  return markerTierToKind(tier) ?? 'standard'
}

export function isHomeCarouselPlacement(
  placement: Pick<ShopPlacementRow, 'show_on_home' | 'starts_at' | 'ends_at'>,
  now = new Date(),
): boolean {
  return Boolean(placement.show_on_home) && isPlacementActive(placement, now)
}

export function homeCarouselShopIds(
  rows: readonly Pick<ShopPlacementRow, 'shop_id' | 'kind' | 'show_on_home' | 'starts_at' | 'ends_at'>[],
  now = new Date(),
): string[] {
  const live = rows.filter((row) => isHomeCarouselPlacement(row, now))
  const sponsored = live.filter((row) => row.kind === 'sponsored').map((row) => row.shop_id)
  const partners = live.filter((row) => row.kind === 'partner').map((row) => row.shop_id)
  return [...new Set([...sponsored, ...partners])]
}

export function missingPartnershipSqlCopy(message: string): string | null {
  if (!/schema cache|could not find the function|column \S+ does not exist|relation \S+ does not exist/i.test(message)) {
    return null
  }
  if (!/save_shop_placement|show_on_home|pending_name|review_owner_shop_name|p_features|shop_has_feature|shop_placements/i.test(message)) {
    return null
  }
  return 'Apply db/20261124_placement_home_carousel.sql, db/20261125_placement_features.sql, and db/20261126_placement_theme.sql in the SQL editor, then try again.'
}
