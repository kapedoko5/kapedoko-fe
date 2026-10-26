import type { Cafe } from '../types/cafe'
import type { CafeAmenityStatus, CafeWorkFacts } from '../types/shop'
import type { CafeFilterId } from './cafe-filters'

export const ANALYTICS_EVENTS = {
  APP_OPENED: 'app_opened',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  SEARCH_PERFORMED: 'search_performed',
  FILTER_APPLIED: 'filter_applied',
  CAFE_CARD_VIEWED: 'cafe_card_viewed',
  CAFE_DETAIL_VIEWED: 'cafe_detail_viewed',
  CAFE_ACTION: 'cafe_action',
  MAP_OPENED: 'map_opened',
  LOCATION_PERMISSION: 'location_permission',
  AUTH_PROMPT_SHOWN: 'auth_prompt_shown',
  REVIEW_STARTED: 'review_started',
  CHECK_IN_STARTED: 'check_in_started',
  PROMOTION_VIEWED: 'promotion_viewed',
  PROMOTION_CLICKED: 'promotion_clicked',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export type ConfidenceBucket =
  | 'team_verified'
  | 'community_confirmed'
  | 'reported'
  | 'mixed'
  | 'unknown'

export type AnalyticsPlatform = 'web' | 'ios' | 'android'
export type AnalyticsAuthState = 'guest' | 'signed_in'
export type AcquisitionSource =
  | 'organic'
  | 'direct'
  | 'referral'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'google'
  | 'other'

export type CardSurface = 'home' | 'search' | 'map' | 'favorites'
export type DetailSource = 'feed' | 'map' | 'search' | 'favorites' | 'promotion'
export type CafeActionType = 'navigate' | 'call' | 'photo_view'
export type LocationPermissionResult = 'granted' | 'denied' | 'fallback_used'
export type AuthPromptTrigger = 'review' | 'submit' | 'report' | 'claim' | 'favorites_sync' | 'check_in'
export type PromotionKind = 'ad' | 'promoted' | 'partner'
export type OnboardingStep = 1 | 2 | 3
export type SearchQueryType = 'name' | 'area'

export const KNOWN_AREAS = [
  'marikina',
  'barangka',
  'calumpang',
  'concepcion_uno',
  'concepcion_dos',
  'fortune',
  'industrial_valley',
  'jesus_de_la_pena',
  'malanday',
  'marikina_heights',
  'nangka',
  'parang',
  'san_roque',
  'santa_elena',
  'santo_nino',
  'tanong',
  'tumana',
  'pasig',
  'quezon_city',
  'cainta',
  'san_mateo',
] as const

export type KnownArea = (typeof KNOWN_AREAS)[number]

export type CommonAnalyticsProperties = {
  app_version: string
  platform: AnalyticsPlatform
  auth_state: AnalyticsAuthState
  acquisition_source: AcquisitionSource
}

export type AnalyticsEventProps = {
  app_opened: { entry: 'cold' | 'resume' }
  onboarding_completed: { step_reached: 3 }
  onboarding_skipped: { step_reached: OnboardingStep }
  search_performed: {
    query_type: SearchQueryType
    result_count: number
    zero_results: boolean
    area_name?: KnownArea
  }
  filter_applied: {
    filter_name: CafeFilterId
    result_count: number
    confidence_bucket: ConfidenceBucket
  }
  cafe_card_viewed: {
    cafe_id: string
    surface: CardSurface
    confidence_bucket: ConfidenceBucket
  }
  cafe_detail_viewed: {
    cafe_id: string
    wifi_confidence: ConfidenceBucket
    outlet_confidence: ConfidenceBucket
    source: DetailSource
  }
  cafe_action: {
    cafe_id: string
    type: CafeActionType
    confidence_bucket: ConfidenceBucket
  }
  map_opened: Record<string, never>
  location_permission: { result: LocationPermissionResult }
  auth_prompt_shown: { trigger: AuthPromptTrigger }
  review_started: { cafe_id: string }
  check_in_started: { cafe_id: string }
  promotion_viewed: {
    promotion_id: string
    cafe_id: string
    promotion_kind: PromotionKind
    placement: 'home_rail'
  }
  promotion_clicked: {
    promotion_id: string
    cafe_id: string
    promotion_kind: PromotionKind
    placement: 'home_rail'
  }
}

export const FORBIDDEN_PROPERTY_KEYS = [
  'query',
  'email',
  'lat',
  'lng',
  'ssid',
  'notes',
  'review_text',
] as const

export type ConsentState = 'granted' | 'declined'

const EVENT_NAMES = new Set<string>(Object.values(ANALYTICS_EVENTS))

const CONFIDENCE_RANK: Record<ConfidenceBucket, number> = {
  unknown: 0,
  mixed: 1,
  reported: 2,
  community_confirmed: 3,
  team_verified: 4,
}

const DETAIL_SOURCES = new Set<DetailSource>(['feed', 'map', 'search', 'favorites', 'promotion'])
const AREA_SET = new Set<string>(KNOWN_AREAS)

const AREA_ALIASES: Array<[KnownArea, string[]]> = [
  ['concepcion_uno', ['concepcion uno', 'concepcion 1', 'concepcion i']],
  ['concepcion_dos', ['concepcion dos', 'concepcion 2', 'concepcion ii']],
  ['industrial_valley', ['industrial valley', 'ivc']],
  ['jesus_de_la_pena', ['jesus de la pena', 'jesus dela pena']],
  ['marikina_heights', ['marikina heights']],
  ['quezon_city', ['quezon city', 'qc']],
  ['santa_elena', ['santa elena', 'sta elena']],
  ['santo_nino', ['santo nino', 'sto nino']],
  ['san_roque', ['san roque']],
  ['san_mateo', ['san mateo']],
]

const UTM_SOURCE_MAP: Record<string, AcquisitionSource> = {
  instagram: 'instagram',
  ig: 'instagram',
  facebook: 'facebook',
  fb: 'facebook',
  tiktok: 'tiktok',
  google: 'google',
  referral: 'referral',
}

const SEARCH_REFERRERS = ['google.', 'bing.', 'duckduckgo.']

const ALLOWED_KEYS: Record<AnalyticsEventName, ReadonlySet<string>> = {
  app_opened: new Set(['entry']),
  onboarding_completed: new Set(['step_reached']),
  onboarding_skipped: new Set(['step_reached']),
  search_performed: new Set(['query_type', 'result_count', 'zero_results', 'area_name']),
  filter_applied: new Set(['filter_name', 'result_count', 'confidence_bucket']),
  cafe_card_viewed: new Set(['cafe_id', 'surface', 'confidence_bucket']),
  cafe_detail_viewed: new Set(['cafe_id', 'wifi_confidence', 'outlet_confidence', 'source']),
  cafe_action: new Set(['cafe_id', 'type', 'confidence_bucket']),
  map_opened: new Set(),
  location_permission: new Set(['result']),
  auth_prompt_shown: new Set(['trigger']),
  review_started: new Set(['cafe_id']),
  check_in_started: new Set(['cafe_id']),
  promotion_viewed: new Set(['promotion_id', 'cafe_id', 'promotion_kind', 'placement']),
  promotion_clicked: new Set(['promotion_id', 'cafe_id', 'promotion_kind', 'placement']),
}

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return EVENT_NAMES.has(value)
}

export function shouldCapture(options: {
  client: boolean
  enabled: boolean
  consent: ConsentState | null
  hasKey: boolean
}): boolean {
  return options.client && options.enabled && options.hasKey && options.consent === 'granted'
}

export function confidenceBucketFromStatus(status?: CafeAmenityStatus | null): ConfidenceBucket {
  if (!status) return 'unknown'
  if (status.availability === 'mixed') return 'mixed'
  if (
    status.confidence === 'team_verified'
    || status.confidence === 'community_confirmed'
    || status.confidence === 'reported'
    || status.confidence === 'unknown'
  ) {
    return status.confidence
  }
  return 'unknown'
}

export function conservativeConfidenceBucket(buckets: ConfidenceBucket[]): ConfidenceBucket {
  if (buckets.length === 0) return 'unknown'
  return buckets.reduce((lowest, bucket) => (
    CONFIDENCE_RANK[bucket] < CONFIDENCE_RANK[lowest] ? bucket : lowest
  ))
}

export function modalConfidenceBucket(buckets: ConfidenceBucket[]): ConfidenceBucket {
  if (buckets.length === 0) return 'unknown'
  const counts = new Map<ConfidenceBucket, number>()
  for (const bucket of buckets) {
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }
  let best: ConfidenceBucket | null = null
  let bestCount = 0
  let tied = false
  for (const [bucket, count] of counts) {
    if (count > bestCount) {
      best = bucket
      bestCount = count
      tied = false
    } else if (count === bestCount) {
      tied = true
    }
  }
  if (!best || tied) return 'mixed'
  return best
}

export function confidenceBucketFromCafe(cafe: Pick<Cafe, 'work'> | { work: CafeWorkFacts }): ConfidenceBucket {
  return conservativeConfidenceBucket([
    confidenceBucketFromStatus(cafe.work.wifiStatus),
    confidenceBucketFromStatus(cafe.work.outletsStatus),
  ])
}

export function confidenceBucketFromLegacyStats(stats?: {
  total_reviews: number
  wifi_available_pct: number | null
  power_available_pct: number | null
} | null): ConfidenceBucket {
  if (!stats || stats.total_reviews < 3) return 'unknown'
  if (stats.wifi_available_pct === 50 || stats.power_available_pct === 50) return 'mixed'
  return 'community_confirmed'
}

export function classifySearchQuery(query: string): {
  query_type: SearchQueryType
  area_name?: KnownArea
} {
  const normalized = normalizeSearchText(query)
  if (!normalized) return { query_type: 'name' }

  const aliased = applyAreaAliases(normalized)
  const exact = aliased.replace(/\s+/g, '_')
  if (isKnownArea(exact)) return { query_type: 'area', area_name: exact }

  const words = aliased.split(' ').filter(Boolean)
  let match: KnownArea | null = null
  for (const area of KNOWN_AREAS) {
    const parts = area.split('_')
    if (containsSequence(words, parts) && (!match || area.length > match.length)) {
      match = area
    }
  }
  if (match) return { query_type: 'area', area_name: match }
  return { query_type: 'name' }
}

export function normalizeAcquisitionSource(input: {
  utmSource?: string | null
  ref?: string | null
  referrerHost?: string | null
  native: boolean
}): AcquisitionSource {
  const utm = foldToken(input.utmSource)
  if (utm) return UTM_SOURCE_MAP[utm] ?? 'other'

  const ref = foldToken(input.ref)
  if (ref) return UTM_SOURCE_MAP[ref] ?? (ref === 'referral' ? 'referral' : 'other')

  if (input.native) return 'direct'
  const host = (input.referrerHost ?? '').toLowerCase()
  if (host && SEARCH_REFERRERS.some((prefix) => host.includes(prefix))) return 'organic'
  return 'direct'
}

export function parseDetailSource(value: unknown, fallback: DetailSource = 'feed'): DetailSource {
  if (typeof value === 'string' && DETAIL_SOURCES.has(value as DetailSource)) return value as DetailSource
  return fallback
}

let pendingDetailSource: DetailSource | null = null

export function rememberDetailSource(source: DetailSource) {
  pendingDetailSource = source
}

export function takeDetailSource(queryValue?: unknown): DetailSource {
  const pending = pendingDetailSource
  pendingDetailSource = null
  if (pending) return pending
  return parseDetailSource(queryValue, 'feed')
}

export function scrubEventProperties<E extends AnalyticsEventName>(
  event: E,
  props: Record<string, unknown>,
  common: CommonAnalyticsProperties,
): Record<string, string | number | boolean> | null {
  if (!isAnalyticsEventName(event)) return null
  const allowed = ALLOWED_KEYS[event]
  const next: Record<string, string | number | boolean> = { ...common }
  for (const [key, value] of Object.entries(props)) {
    if ((FORBIDDEN_PROPERTY_KEYS as readonly string[]).includes(key)) continue
    if (!allowed.has(key)) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value
    }
  }
  return next
}

export function createSessionDedupe() {
  const keys = new Set<string>()
  return {
    once(key: string): boolean {
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
    has(key: string): boolean {
      return keys.has(key)
    },
    clear() {
      keys.clear()
    },
  }
}

export const cardViewKey = (cafeId: string, surface: CardSurface) => `card:${surface}:${cafeId}`
export const promotionViewKey = (promotionId: string) => `promo:${promotionId}`
export const detailViewKey = (cafeId: string) => `detail:${cafeId}`
export const reviewStartKey = (cafeId: string) => `review:${cafeId}`
export const checkInStartKey = (cafeId: string) => `checkin:${cafeId}`
export const CARD_IMPRESSION_RATIO = 0.5
export const CARD_IMPRESSION_MS = 750
export const APP_RESUME_MS = 30 * 60 * 1000

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function applyAreaAliases(value: string): string {
  let next = ` ${value} `
  const aliases = [...AREA_ALIASES].sort((a, b) => b[1][0]!.length - a[1][0]!.length)
  for (const [area, phrases] of aliases) {
    const spaced = area.replace(/_/g, ' ')
    for (const phrase of [spaced, ...phrases]) {
      next = next.replaceAll(` ${phrase} `, ` ${spaced} `)
    }
  }
  return next.trim()
}

function containsSequence(words: string[], parts: string[]): boolean {
  if (parts.length === 0 || words.length < parts.length) return false
  for (let i = 0; i <= words.length - parts.length; i += 1) {
    if (parts.every((part, offset) => words[i + offset] === part)) return true
  }
  return false
}

function isKnownArea(value: string): value is KnownArea {
  return AREA_SET.has(value)
}

function foldToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}
