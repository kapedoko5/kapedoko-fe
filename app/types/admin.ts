import type { DayHours, MarkerTier, ProfileRole, ShopPlacementKind, ShopPlacementRow, ShopStatus, WeeklyHours } from './shop'

export type AdminNavId =
  | 'dashboard'
  | 'cafes'
  | 'audits'
  | 'verifications'
  | 'requests'
  | 'claims'
  | 'partnerships'
  | 'ads'
  | 'events'
  | 'badges'
  | 'vibe-tags'
  | 'price-marks'
  | 'users'
  | 'moderation'

export interface AdminNavItem {
  id: AdminNavId
  label: string
  href: string
}

export interface AdminDashboardCounts {
  pending: number
  approved: number
  rejected: number
  hidden: number
  pendingClaims: number
  openReports: number
  activePlacements: number
  activeAds: number
  activeEvents: number
  activeBadges: number
  users: number
  checkIns30d: number
}

export type BadgeLucideId =
  | 'gem'
  | 'award'
  | 'trophy'
  | 'star'
  | 'crown'
  | 'sparkles'
  | 'heart'
  | 'flame'
  | 'coffee'
  | 'leaf'
  | 'map-pin'
  | 'medal'
  | 'badge-check'
  | 'gift'

export interface CafeBadge {
  id: string
  slug: string
  label: string
  color: string
  lucideIcon: BadgeLucideId
  iconUrl: string | null
}

export interface BadgeNameRow {
  id: string
  label: string
  slug: string
  color: string
  lucide_icon: string
  icon_object_key: string | null
  enabled: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface BadgeAwardRow {
  id: string
  badge_id: string
  starts_at: string
  ends_at: string
  enabled: boolean
  cancelled_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface BadgeAwardShopRow {
  award_id: string
  shop_id: string
}

export interface ActiveShopBadgeRow {
  shop_id: string
  badge_id: string
  slug: string
  label: string
  color: string
  lucide_icon: string
  icon_object_key: string | null
  starts_at: string
  ends_at: string
}

export type BadgeAwardLifecycle = 'scheduled' | 'live' | 'ended'

export type VibeTagLucideId =
  | 'coffee'
  | 'leaf'
  | 'heart'
  | 'flame'
  | 'sparkles'
  | 'sun'
  | 'moon'
  | 'music'
  | 'headphones'
  | 'book-open'
  | 'users'
  | 'volume-x'
  | 'volume-2'
  | 'lamp'
  | 'camera'
  | 'wind'
  | 'cat'
  | 'sofa'
  | 'palmtree'
  | 'landmark'

export interface CafeVibeTag {
  id: string
  slug: string
  label: string
  lucideIcon: VibeTagLucideId
  color: string
}

export interface VibeTagNameRow {
  id: string
  label: string
  slug: string
  lucide_icon: string
  color: string
  enabled: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ShopVibeTagRow {
  shop_id: string
  tag_id: string
  created_at?: string
}

export interface ActiveShopVibeTagRow {
  shop_id: string
  tag_id: string
  slug: string
  label: string
  lucide_icon: string
  color: string
}

export type AdDestinationKind = 'cafe' | 'internal' | 'external'

export type AdCampaignState = 'live' | 'scheduled' | 'ended'

export interface AdCampaignRow {
  id: string
  shop_id: string | null
  banner_object_key: string
  starts_at: string
  ends_at: string
  enabled: boolean
  cancelled_at: string | null
  label: string | null
  priority: number
  destination_kind: AdDestinationKind
  destination_url: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ActiveAdCampaignRow {
  id: string
  shop_id: string | null
  banner_object_key: string
  starts_at: string
  ends_at: string
  priority: number
  label: string | null
  destination_kind: AdDestinationKind
  destination_url: string | null
}

export type PlacementLifecycle = 'current' | 'scheduled' | 'ended'

export interface AdminUserRow {
  id: string
  email: string | null
  displayName: string | null
  role: ProfileRole
  banned: boolean
  createdAt: string | null
  lastSignInAt: string | null
  shopCount: number
  reviewCount: number
}

export interface AdminUsersResponse {
  users: AdminUserRow[]
  total: number
  page: number
  perPage: number
}

export interface AdminCafeDraft {
  name: string
  address: string
  lat: number | null
  lng: number | null
  phone: string
  hours: WeeklyHours
  logoFile: File | null
  logoObjectKey: string | null
}

export type { DayHours, MarkerTier, ShopPlacementKind, ShopPlacementRow, ShopStatus, WeeklyHours }
