import type { ShopClaimRow, ShopClaimStatus, ShopRow, WeeklyHours } from '../types/shop'
import { addressError, cafeNameError } from './identity'
import { formatHoursHint, isOpenNow, isValidWeeklyHours } from './hours'
import { logoFileError } from './logo'
import { isValidPhone } from './phone'
import { parseProfileRole } from './profile-role'

export interface OwnerCafeInput {
  name: string
  address: string
  lat: number | null
  lng: number | null
  phone: string
  hours: WeeklyHours | null
  logoFile: File | null
}

export function isValidOwnerLatitude(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidOwnerLongitude(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

export function ownerCafeErrors(input: OwnerCafeInput): {
  name: string | null
  address: string | null
  pin: string | null
  phone: string | null
  hours: string | null
  logo: string | null
} {
  const phone = input.phone.trim()
  return {
    name: cafeNameError(input.name),
    address: addressError(input.address),
    pin: isValidOwnerLatitude(input.lat) && isValidOwnerLongitude(input.lng) ? null : 'Pin the cafe on the map.',
    phone: !phone || isValidPhone(phone) ? null : 'Use a phone number like 0917 123 4567.',
    hours: isValidWeeklyHours(input.hours) ? null : 'Check the opening hours and try again.',
    logo: logoFileError(input.logoFile),
  }
}

export function ownerCafeHasErrors(input: OwnerCafeInput): boolean {
  return Object.values(ownerCafeErrors(input)).some(Boolean)
}

export function ownerLogoPayload(input: { logoFile: File | null; logoObjectKey: string | null }): string | null {
  if (input.logoFile) return null
  const key = input.logoObjectKey?.trim().replace(/^\/+/, '') ?? ''
  return key || null
}

/** Staff use the admin desk. Cafe owners and claimants use this one. */
export function ownerStaffRedirect(role: string | null | undefined): string | null {
  if (role === 'admin') return '/admin'
  if (role === 'auditor') return '/admin/audits'
  return null
}

export function canAccessOwnerDesk(input: {
  role: string | null | undefined
  claimCount: number
}): boolean {
  if (ownerStaffRedirect(input.role)) return false
  if (parseProfileRole(input.role) === 'cafe-owner') return true
  return input.claimCount > 0
}

export function ownerLoginDeniedCopy(): string {
  return 'This desk is for people who manage a cafe or have a claim waiting. Claim a listed cafe in the app first.'
}

export function ownerForbiddenCopy(): string {
  return 'This desk is for cafe owners. Claim a listed cafe in the app, then an admin verifies it.'
}

export function waitingOwnerClaims(claims: ShopClaimRow[]): ShopClaimRow[] {
  return claims.filter((claim) => claim.status === 'pending' || claim.status === 'rejected')
}

export function ownerClaimsForFilter(
  claims: ShopClaimRow[],
  filter: ShopClaimStatus | 'all',
): ShopClaimRow[] {
  if (filter === 'all') return claims
  return claims.filter((claim) => claim.status === filter)
}

export function ownerClaimsEmptyCopy(filter: ShopClaimStatus | 'all'): string {
  if (filter === 'pending') return 'No claims waiting on admin.'
  if (filter === 'verified') return 'No verified cafes yet. An admin stamps a claim before a listing lands on this shelf.'
  if (filter === 'rejected') return 'No rejected claims.'
  return 'Claims you send wait here until an admin verifies them.'
}

export function ownerCafesEmptyCopy(): string {
  return 'No cafes on this shelf yet. After an admin verifies a claim, the listing lands here so you can keep hours and contact current.'
}

export function ownerDeskCafesEmptyCopy(waitingCount: number): string {
  if (waitingCount > 0) return 'Nothing on the shelf yet. The rail above is what still waits on admin.'
  return ownerCafesEmptyCopy()
}

export function ownerHoursLine(hours: WeeklyHours | null | undefined): string {
  return formatHoursHint(hours)
}

export function ownerCafeIsClosed(hours: WeeklyHours | null | undefined, now = new Date()): boolean {
  return !isOpenNow(hours, now)
}

export function ownerLiveCopy(shop: Pick<ShopRow, 'status'>): string {
  if (shop.status === 'approved') return 'On Home and Map'
  if (shop.status === 'hidden') return 'Unpublished. An admin has to publish it before it shows on Home and Map.'
  if (shop.status === 'rejected') return 'Not listed'
  return 'Pending review. It stays off Home and Map until an admin approves it.'
}

export function ownerEditorLede(): string {
  return 'These details go live on Home and Map. Featured photos show on the cafe page. WiFi and outlets still come from visitor reviews. Publish status stays with admin.'
}

export function unmarkedWaitingClaims(claims: ShopClaimRow[], noticedIds: readonly string[]): ShopClaimRow[] {
  const seen = new Set(noticedIds)
  return waitingOwnerClaims(claims).filter((claim) => !seen.has(claim.id))
}

export function mergeNoticedClaimIds(current: readonly string[], waiting: ShopClaimRow[]): string[] {
  return [...new Set([...current, ...waiting.map((claim) => claim.id)])]
}
