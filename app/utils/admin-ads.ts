import type { AdCampaignState, AdDestinationKind } from '~/types/admin'

export function campaignWindowError(startsAt: string, endsAt: string, now = new Date()): string | null {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return 'Choose a start and end time.'
  }
  if (end <= start) return 'Choose an end date after the start date.'
  if (end <= now) return 'Choose an end time in the future.'
  return null
}

export function isAdCampaignActive(
  campaign: {
    enabled?: boolean
    cancelled_at?: string | null
    starts_at: string
    ends_at: string
  },
  now = new Date(),
): boolean {
  if (campaign.enabled === false || campaign.cancelled_at) return false
  const start = new Date(campaign.starts_at).getTime()
  const end = new Date(campaign.ends_at).getTime()
  const at = now.getTime()
  return Number.isFinite(start) && Number.isFinite(end) && start <= at && end > at
}

export function adCampaignState(
  campaign: {
    enabled?: boolean
    cancelled_at?: string | null
    starts_at: string
    ends_at: string
  },
  now = new Date(),
): AdCampaignState {
  if (campaign.enabled === false || campaign.cancelled_at) return 'ended'
  if (isAdCampaignActive(campaign, now)) return 'live'
  if (new Date(campaign.starts_at).getTime() > now.getTime()) return 'scheduled'
  return 'ended'
}

export const BANNER_MAX_BYTES = 4 * 1024 * 1024
export const BANNER_MIN_WIDTH = 640
export const BANNER_MIN_RATIO = 2
export const BANNER_MAX_RATIO = 4.5

const BANNER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AD_UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const INTERNAL_CAFE_PATH = new RegExp(`^/app/cafes/${AD_UUID}$`)
const INTERNAL_EVENT_PATH = new RegExp(`^/app/events/${AD_UUID}$`)
const INTERNAL_CAFE_ID = new RegExp(`^/app/cafes/(${AD_UUID})$`)
const INTERNAL_EVENT_ID = new RegExp(`^/app/events/(${AD_UUID})$`)

export function bannerFileHint(): string {
  return 'JPG, PNG, or WebP. Wide ~3:1, at least 640px across, under 4 MB. 1920×640 works well. Home shows the full 3:1 frame, up to 640px tall.'
}

export function bannerFileError(file: File | null, required = true): string | null {
  if (!file) return required ? 'Upload a banner image.' : null
  if (!BANNER_TYPES.has(file.type)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size > BANNER_MAX_BYTES) return 'Keep the banner under 4 MB.'
  return null
}

export function bannerAspectError(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return 'Could not read that image.'
  }
  if (width < BANNER_MIN_WIDTH) return 'Use a banner at least 640 pixels wide.'
  const ratio = width / height
  if (ratio < BANNER_MIN_RATIO || ratio > BANNER_MAX_RATIO) {
    return 'Use a wide banner, about 3:1.'
  }
  return null
}

export function sortActiveAds<T extends { priority?: number; starts_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0)
    if (priority) return priority
    return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  })
}

export function featuredAdCopy(cafeName: string, label?: string | null): { name: string; place: string } {
  const campaign = label?.trim() ?? ''
  return {
    name: cafeName,
    place: campaign && campaign !== cafeName ? campaign : '',
  }
}

export function adBannerIsBleed(_label?: string | null): boolean {
  return true
}

export function adDestinationKind(
  row: { destination_kind?: AdDestinationKind | null; shop_id?: string | null },
): AdDestinationKind {
  if (row.destination_kind === 'internal' || row.destination_kind === 'external') return row.destination_kind
  return 'cafe'
}

export function isInternalAdPath(path: string): boolean {
  const trimmed = path.trim()
  if (!trimmed || trimmed.includes('//')) return false
  if (trimmed === '/app' || trimmed === '/app/map' || trimmed === '/app/search') return true
  return INTERNAL_CAFE_PATH.test(trimmed) || INTERNAL_EVENT_PATH.test(trimmed)
}

export function isExternalAdUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:' && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export type InternalAdTarget =
  | { type: 'home' }
  | { type: 'map' }
  | { type: 'search' }
  | { type: 'cafe'; id: string }
  | { type: 'event'; id: string }

export function parseInternalAdPath(path: string): InternalAdTarget | null {
  const trimmed = path.trim()
  if (!isInternalAdPath(trimmed)) return null
  if (trimmed === '/app') return { type: 'home' }
  if (trimmed === '/app/map') return { type: 'map' }
  if (trimmed === '/app/search') return { type: 'search' }
  const cafe = trimmed.match(INTERNAL_CAFE_ID)
  if (cafe?.[1]) return { type: 'cafe', id: cafe[1] }
  const event = trimmed.match(INTERNAL_EVENT_ID)
  if (event?.[1]) return { type: 'event', id: event[1] }
  return null
}

export function adDestinationError(
  kind: AdDestinationKind,
  shopId: string,
  url: string,
): string | null {
  if (kind === 'cafe') {
    return shopId.trim() ? null : 'Choose an approved cafe.'
  }
  if (kind === 'internal') {
    const path = url.trim()
    if (!path) return 'Enter an in-app path.'
    return isInternalAdPath(path)
      ? null
      : 'Use an in-app path like /app, /app/map, /app/cafes/…, or /app/events/…'
  }
  if (kind === 'external') {
    const link = url.trim()
    if (!link) return 'Enter an https link.'
    return isExternalAdUrl(link) ? null : 'Use an https link.'
  }
  return 'Choose a destination.'
}

export function adDestinationLabel(
  ad: {
    destination_kind?: AdDestinationKind | null
    shop_id?: string | null
    destination_url?: string | null
  },
  shopName: string,
): string {
  const kind = adDestinationKind(ad)
  if (kind === 'cafe') return shopName || 'Cafe'
  return ad.destination_url?.trim() || (kind === 'internal' ? 'In-app path' : 'External link')
}

export type AdListStateFilter = 'all' | AdCampaignState

export function adWindowOverlaps(
  startsAt: string,
  endsAt: string,
  windowFrom: string,
  windowTo: string,
): boolean {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  const from = windowFrom ? new Date(windowFrom).getTime() : Number.NEGATIVE_INFINITY
  const to = windowTo ? new Date(windowTo).getTime() : Number.POSITIVE_INFINITY
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false
  return start < to && end > from
}

export function missingAdDestinationSqlCopy(message: string): string | null {
  if (!/schema cache|does not exist|column \S+ does not exist/i.test(message)) return null
  if (!/destination_kind|destination_url|ad_campaigns/i.test(message)) return null
  return 'Apply db/20261123_ad_campaign_destinations.sql in the SQL editor, then try again.'
}

export function adListMatches(
  ad: {
    shop_id?: string | null
    destination_url?: string | null
    starts_at: string
    ends_at: string
    enabled?: boolean
    cancelled_at?: string | null
  },
  filters: {
    cafeQuery: string
    windowFrom: string
    windowTo: string
    state: AdListStateFilter
  },
  shopName: string,
  now = new Date(),
): boolean {
  const query = filters.cafeQuery.trim().toLowerCase()
  if (query) {
    const haystack = `${shopName} ${ad.destination_url ?? ''}`.toLowerCase()
    if (!haystack.includes(query)) return false
  }
  if ((filters.windowFrom || filters.windowTo) && !adWindowOverlaps(ad.starts_at, ad.ends_at, filters.windowFrom, filters.windowTo)) {
    return false
  }
  if (filters.state !== 'all' && adCampaignState(ad, now) !== filters.state) return false
  return true
}
