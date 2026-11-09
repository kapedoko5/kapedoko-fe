import type { DayHours, MarkerTier, ProfileRole, ShopPlacementKind, ShopPlacementRow, ShopStatus, WeeklyHours } from './shop'

export type AdminNavId =
  | 'dashboard'
  | 'cafes'
  | 'audits'
  | 'requests'
  | 'claims'
  | 'partnerships'
  | 'ads'
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
  users: number
  checkIns30d: number
}

export interface AdCampaignRow {
  id: string
  shop_id: string
  banner_object_key: string
  starts_at: string
  ends_at: string
  enabled: boolean
  cancelled_at: string | null
  label: string | null
  priority: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ActiveAdCampaignRow {
  id: string
  shop_id: string
  banner_object_key: string
  starts_at: string
  ends_at: string
  priority: number
  label: string | null
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
