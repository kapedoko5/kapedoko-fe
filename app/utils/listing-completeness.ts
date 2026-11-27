import type { ShopRow, ShopAmenityVerificationRow, WeeklyHours } from '../types/shop'
import { ownerCafeEditPath } from './owner-nav'

export const COMPLETENESS_VIBE_TARGET = 5
/** wifi, seating, outlets, payment */
export const COMPLETENESS_AMENITY_TARGET = 4

export type CompletenessItemId = 'logo' | 'hours' | 'phone' | 'photos' | 'vibes' | 'amenities' | 'poster'

export type ListingCompletenessInput = {
  shopId: string
  hasLogo: boolean
  hasHours: boolean
  hasPhone: boolean
  photoCount: number
  /** Featured photo cap for this listing (3 free, 8 with the feature). */
  photoCap: number
  vibeCount: number
  /** Distinct amenity groups with an approved owner proof. */
  verifiedAmenityCount: number
  hasPoster: boolean
}

export type CompletenessItem = {
  id: CompletenessItemId
  label: string
  weight: number
  /** 0 to 1. */
  fraction: number
  done: boolean
  /** "2 of 5" style progress for partly done items, empty otherwise. */
  progress: string
  /** What to do when not done. */
  action: string
  /** Editor that fixes it. */
  to: string
}

export type ListingCompleteness = {
  /** 0 to 100. */
  score: number
  items: CompletenessItem[]
  missing: CompletenessItem[]
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

export function hoursAreSet(hours: WeeklyHours | null | undefined): boolean {
  if (!hours) return false
  return Object.values(hours).some((day) => day && day.kind !== 'closed')
}

export function verifiedAmenityGroups(rows: ShopAmenityVerificationRow[], shopId: string): number {
  const groups = new Set<string>()
  for (const row of rows) {
    if (row.shop_id !== shopId || row.status !== 'approved') continue
    if (row.include_wifi) groups.add('wifi')
    if (row.include_seating) groups.add('seating')
    if (row.include_outlets) groups.add('outlets')
    if (row.include_payment) groups.add('payment')
  }
  return groups.size
}

export function completenessInputFromShop(
  shop: Pick<ShopRow, 'id' | 'logo_object_key' | 'hours' | 'contact_number' | 'gallery_object_keys'>,
  extra: { photoCap: number, vibeCount: number, verifiedAmenityCount: number, hasPoster: boolean },
): ListingCompletenessInput {
  return {
    shopId: shop.id,
    hasLogo: Boolean(shop.logo_object_key?.trim()),
    hasHours: hoursAreSet(shop.hours),
    hasPhone: Boolean(shop.contact_number?.trim()),
    photoCount: shop.gallery_object_keys?.length ?? 0,
    photoCap: extra.photoCap,
    vibeCount: extra.vibeCount,
    verifiedAmenityCount: extra.verifiedAmenityCount,
    hasPoster: extra.hasPoster,
  }
}

export function scoreListing(input: ListingCompletenessInput): ListingCompleteness {
  const editor = ownerCafeEditPath(input.shopId)
  const verify = editor === '/owner/cafes' ? editor : `${editor}/verify`
  const cap = Math.max(1, input.photoCap)
  const photos = Math.max(0, Math.floor(input.photoCount))
  const vibes = Math.max(0, Math.floor(input.vibeCount))
  const amenities = Math.max(0, Math.floor(input.verifiedAmenityCount))
  const partial = (have: number, target: number) => (have > 0 && have < target ? `${have} of ${target}` : '')

  const items: CompletenessItem[] = [
    {
      id: 'logo',
      label: 'Logo',
      weight: 15,
      fraction: input.hasLogo ? 1 : 0,
      done: input.hasLogo,
      progress: '',
      action: 'Add your logo',
      to: editor,
    },
    {
      id: 'hours',
      label: 'Opening hours',
      weight: 20,
      fraction: input.hasHours ? 1 : 0,
      done: input.hasHours,
      progress: '',
      action: 'Set your hours',
      to: editor,
    },
    {
      id: 'phone',
      label: 'Phone number',
      weight: 10,
      fraction: input.hasPhone ? 1 : 0,
      done: input.hasPhone,
      progress: '',
      action: 'Add a phone number',
      to: editor,
    },
    {
      id: 'photos',
      label: 'Featured photos',
      weight: 20,
      fraction: clamp01(photos / cap),
      done: photos >= cap,
      progress: partial(photos, cap),
      action: photos >= cap ? '' : 'Add featured photos',
      to: editor,
    },
    {
      id: 'vibes',
      label: 'Vibe tags',
      weight: 15,
      fraction: clamp01(vibes / COMPLETENESS_VIBE_TARGET),
      done: vibes >= COMPLETENESS_VIBE_TARGET,
      progress: partial(vibes, COMPLETENESS_VIBE_TARGET),
      action: 'Pick vibe tags',
      to: editor,
    },
    {
      id: 'amenities',
      label: 'Verified amenities',
      weight: 10,
      fraction: clamp01(amenities / COMPLETENESS_AMENITY_TARGET),
      done: amenities >= COMPLETENESS_AMENITY_TARGET,
      progress: partial(amenities, COMPLETENESS_AMENITY_TARGET),
      action: 'Verify WiFi, outlets, seating or payment',
      to: verify,
    },
    {
      id: 'poster',
      label: 'Poster',
      weight: 10,
      fraction: input.hasPoster ? 1 : 0,
      done: input.hasPoster,
      progress: '',
      action: 'Hang a poster',
      to: '/owner/ads',
    },
  ]
  const score = Math.round(items.reduce((sum, item) => sum + item.weight * item.fraction, 0))
  return { score, items, missing: items.filter((item) => !item.done) }
}
