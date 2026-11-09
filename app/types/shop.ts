export type ShopStatus = 'pending' | 'approved' | 'rejected' | 'hidden'

export type MarkerTier = 'standard' | 'partner' | 'promoted'

export type ShopPlacementKind = 'partner' | 'sponsored'

export interface ShopPlacementRow {
  id: string
  shop_id: string
  kind: ShopPlacementKind
  starts_at: string
  ends_at: string
  created_by: string | null
  created_at: string
}

export interface ShopMarkerTierRow {
  shop_id: string
  marker_tier: MarkerTier
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type DayHours =
  | { kind: 'open'; open: string; close: string }
  | { kind: 'closed' }
  | { kind: 'all_day' }

export type WeeklyHours = Record<DayKey, DayHours>

export type ShopSource = 'openstreetmap' | 'user' | 'admin'
export type OsmElementType = 'node' | 'way' | 'relation'
export type ShopClaimStatus = 'pending' | 'verified' | 'rejected'

export interface ShopRow {
  id: string
  name: string
  description: string | null
  address: string
  latitude: number
  longitude: number
  categories: string[]
  hours: WeeklyHours | null
  cover_photo_url: string | null
  logo_object_key: string | null
  contact_number: string | null
  status: ShopStatus
  submitted_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  source?: ShopSource | null
  osm_type?: OsmElementType | null
  osm_id?: number | null
  imported_at?: string | null
  created_at: string
  updated_at: string
}

export type ReviewTriState = 'yes' | 'no' | 'unsure'
export type WifiSpeed = 'slow' | 'okay' | 'fast'
export type WifiTimeLimit = 'unlimited' | 'voucher' | 'purchase' | 'unsure'
export type PowerAccess = 'easy' | 'limited' | 'scarce'

export type AmenityAvailability = 'available' | 'unavailable' | 'mixed' | 'unknown'
export type AmenityConfidence = 'team_verified' | 'community_confirmed' | 'reported' | 'unknown'

export interface CafeAmenityStatus {
  availability: AmenityAvailability
  confidence: AmenityConfidence
  sourceAt: string | null
  isStale: boolean
  needsRecheck: boolean
  decidedCount: number
  yesCount: number
  noCount: number
  wifiSpeed: WifiSpeed | null
  wifiTimeLimit: WifiTimeLimit | null
  outletReliability: PowerAccess | null
}

export interface CafeWorkFacts {
  known: boolean
  wifi: boolean | null
  longStay: boolean | null
  wifiSpeed: WifiSpeed | null
  wifiTimeLimit: WifiTimeLimit | null
  plug: boolean | null
  outletReliability: PowerAccess | null
  wifiStatus: CafeAmenityStatus
  outletsStatus: CafeAmenityStatus
  longStayWifiStatus: CafeAmenityStatus
}
export type NoiseLevel = 'quiet' | 'mixed' | 'loud'
export type StayFit = 'long' | 'short' | 'unsure'
export type BusynessLevel = 'quiet' | 'comfortable' | 'busy' | 'full'

export interface ShopReviewStatsRow {
  shop_id: string
  total_reviews: number
  wifi_yes_count: number | null
  wifi_available_pct: number | null
  wifi_speed_mode: string | null
  wifi_time_limit_mode: string | null
  power_yes_count: number | null
  power_available_pct: number | null
  power_access_mode?: string | null
  recommend_pct: number | null
  visit_again_pct?: number | null
  matcha_yes_count?: number | null
  matcha_available_pct?: number | null
  noise_mode?: string | null
  stay_fit_mode?: string | null
}

export interface ShopReviewRow {
  id: string
  shop_id: string
  user_id: string
  wifi_available: ReviewTriState
  wifi_speed: WifiSpeed | null
  wifi_time_limit: WifiTimeLimit | null
  power_available: ReviewTriState
  power_access: PowerAccess | null
  serves_matcha: ReviewTriState
  noise: NoiseLevel
  stay_fit: StayFit
  recommend: boolean
  visit_again: boolean
  comment: string | null
  flagged_at: string | null
  created_at: string
  updated_at: string
}

export interface ShopReviewInsert {
  shop_id: string
  user_id: string
  wifi_available: ReviewTriState
  wifi_speed: WifiSpeed | null
  wifi_time_limit: WifiTimeLimit | null
  power_available: ReviewTriState
  power_access: PowerAccess | null
  serves_matcha: ReviewTriState
  noise: NoiseLevel
  stay_fit: StayFit
  recommend: boolean
  visit_again: boolean
  comment: string | null
}

export interface ShopReviewPublicRow {
  id: string
  shop_id: string
  created_at: string
  updated_at: string
  author_name: string
  wifi_available: ReviewTriState
  wifi_speed: WifiSpeed | null
  wifi_time_limit: WifiTimeLimit | null
  power_available: ReviewTriState
  power_access: PowerAccess | null
  serves_matcha: ReviewTriState
  noise: NoiseLevel
  stay_fit: StayFit
  recommend: boolean
  visit_again: boolean
  comment: string | null
}

export interface ShopBusynessNowRow {
  shop_id: string
  level: BusynessLevel
  report_count: number
  last_reported_at: string
}

export interface ShopBusynessInsert {
  shop_id: string
  user_id: string
  level: BusynessLevel
}

export interface ShopCheckinStatsRow {
  shop_id: string
  checkins_30d: number
  last_checkin_at: string
}

export interface ShopCheckinTotalsRow {
  checkins_30d: number
}

export interface ShopClaimRow {
  id: string
  shop_id: string
  claimant_id: string
  status: ShopClaimStatus
  evidence_note: string
  contact_email: string | null
  contact_phone: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type ProfileRole = 'user' | 'cafe-owner' | 'admin' | 'auditor'

export interface ProfileRow {
  id: string
  display_name: string | null
  role: ProfileRole
  created_at: string
  updated_at: string
}

export interface FavoriteRow {
  user_id: string
  shop_id: string
  created_at: string
}

export type ContentReportTarget = 'review' | 'shop_photo'
export type ContentReportStatus = 'open' | 'hidden' | 'dismissed'

export interface ContentReportRow {
  id: string
  reporter_id: string
  target_type: ContentReportTarget
  review_id: string | null
  shop_id: string | null
  reason: string | null
  status: ContentReportStatus
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  review_text?: string | null
}

export interface ShopInsert {
  name: string
  address: string
  latitude: number
  longitude: number
  hours: WeeklyHours
  contact_number: string | null
  logo_object_key: string | null
  submitted_by: string
  status: 'pending'
}

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}
