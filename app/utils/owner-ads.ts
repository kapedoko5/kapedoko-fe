import type { ShopRow } from '../types/shop'

export const SHOP_GALLERY_MAX = 8
export const SHOP_POSTER_MAX_BYTES = 4 * 1024 * 1024
export const SHOP_PHOTO_MAX_BYTES = 4 * 1024 * 1024

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type OwnerPosterScope = 'one' | 'several'

export interface ShopPosterRow {
  id: string
  shop_id: string
  poster_object_key: string
  created_at: string
}

export interface LiveShopPosterRow {
  id: string
  shop_id: string
  poster_object_key: string
  created_at: string
}

export function posterFileError(file: File | null, required = true): string | null {
  if (!file) return required ? 'Upload a poster image.' : null
  if (!IMAGE_TYPES.has(file.type)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size > SHOP_POSTER_MAX_BYTES) return 'Keep the poster under 4 MB.'
  return null
}

export function featuredPhotoFileError(file: File | null): string | null {
  if (!file) return 'Choose a photo to upload.'
  if (!IMAGE_TYPES.has(file.type)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size > SHOP_PHOTO_MAX_BYTES) return 'Keep each photo under 4 MB.'
  return null
}

export function featuredPhotoCountError(count: number): string | null {
  if (count < 0) return 'Choose photos to keep.'
  if (count > SHOP_GALLERY_MAX) return `Keep featured photos to ${SHOP_GALLERY_MAX}.`
  return null
}

export function ownerPosterShopIds(input: {
  ownedIds: readonly string[]
  scope: OwnerPosterScope
  oneId: string
  severalIds: readonly string[]
}): string[] {
  const owned = new Set(input.ownedIds)
  if (input.ownedIds.length === 1) {
    const only = input.ownedIds[0]
    return only && owned.has(only) ? [only] : []
  }
  if (input.scope === 'one') {
    return owned.has(input.oneId) ? [input.oneId] : []
  }
  return [...new Set(input.severalIds.filter((id) => owned.has(id)))]
}

export function ownerPosterCafeError(shopIds: readonly string[]): string | null {
  if (shopIds.length === 0) return 'Choose at least one cafe.'
  return null
}

export function ownerPosterReplaceNames(
  shopIds: readonly string[],
  liveShopIds: ReadonlySet<string>,
  shopName: (id: string) => string,
): string[] {
  return shopIds.filter((id) => liveShopIds.has(id)).map((id) => shopName(id))
}

export function ownerPosterReplaceCopy(names: readonly string[]): string | null {
  if (!names.length) return null
  if (names.length === 1) return `Posting replaces the current poster at ${names[0]}.`
  if (names.length === 2) return `Posting replaces the current posters at ${names[0]} and ${names[1]}.`
  const rest = names.slice(0, -1).join(', ')
  return `Posting replaces the current posters at ${rest}, and ${names.at(-1)}.`
}

export function ownerAdsEmptyCopy(): string {
  return 'No posters hanging yet. Upload one above and choose which cafes should show it.'
}

export function ownerAdsNoCafesCopy(): string {
  return 'A verified cafe has to land on this shelf before you can hang a poster.'
}

export function ownerAdsLede(): string {
  return 'One poster at a time on each cafe. Visitors see it on that cafe’s page, not on Home.'
}

export function ownerTakeDownTitle(cafeName: string): string {
  return `Take down the poster at ${cafeName}?`
}

export function ownerTakeDownMessage(): string {
  return 'It leaves that cafe’s page immediately. Other cafes keep their posters.'
}

export function missingOwnerMediaSqlCopy(message: string): string | null {
  if (!/schema cache|does not exist|publish_owner_poster|end_owner_poster|list_my_shop_posters|gallery_object_keys|p_gallery_object_keys/i.test(message)) {
    return null
  }
  return 'Apply db/20261114_owner_cafe_media.sql in the SQL editor, then try again.'
}

export function ownerPosterScopeForOwned(ownedCount: number): OwnerPosterScope {
  return ownedCount > 1 ? 'several' : 'one'
}

export function livePosterByShopId(rows: readonly ShopPosterRow[]): Map<string, ShopPosterRow> {
  return new Map(rows.map((row) => [row.shop_id, row]))
}

export function approvedOwnedCafes(shops: readonly ShopRow[]): ShopRow[] {
  return shops.filter((shop) => shop.status === 'approved')
}
