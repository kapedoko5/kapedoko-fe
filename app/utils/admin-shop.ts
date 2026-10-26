import { addressError, cafeNameError } from './identity'
import { isValidWeeklyHours } from './hours'
import { isValidPhone } from './phone'
import { logoFileError } from './logo'
import type { ShopStatus, WeeklyHours } from '../types/shop'

export function shopStatusWord(status: ShopStatus): string {
  if (status === 'approved') return 'Approved'
  if (status === 'pending') return 'Pending'
  if (status === 'hidden') return 'Hidden'
  return 'Rejected'
}

export interface AdminCafeInput {
  name: string
  address: string
  lat: number | null
  lng: number | null
  phone: string
  hours: WeeklyHours | null
  logoFile: File | null
}

export function isValidLatitude(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

export function adminCafeErrors(input: AdminCafeInput): {
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
    pin: isValidLatitude(input.lat) && isValidLongitude(input.lng) ? null : 'Pin the cafe on the map.',
    phone: !phone || isValidPhone(phone) ? null : 'Use a phone number like 0917 123 4567.',
    hours: isValidWeeklyHours(input.hours) ? null : 'Check the opening hours and try again.',
    logo: logoFileError(input.logoFile),
  }
}

export function adminCafeHasErrors(input: AdminCafeInput): boolean {
  return Object.values(adminCafeErrors(input)).some(Boolean)
}

const ADMIN_ASSET_KEY = /^(shop-logos|ad-banners|audit-photos)\/[A-Za-z0-9][A-Za-z0-9/_.:-]*$/
const ADMIN_ASSET_KEY_LIMIT = 80

export function uniqueDeletableAdminObjectKeys(value: unknown, limit = ADMIN_ASSET_KEY_LIMIT): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const seen = new Set<string>()
  const keys: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const key = item.trim().replace(/^\/+/, '')
    if (!key || !ADMIN_ASSET_KEY.test(key) || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
    if (keys.length >= limit) break
  }
  return keys
}

export function parseDeletedAdminShop(data: unknown): { id: string; name: string; objectKeys: string[] } | null {
  const row = Array.isArray(data) ? data[0] : data
  const parsed = typeof row === 'string'
    ? (() => {
      try {
        return JSON.parse(row) as unknown
      }
      catch {
        return null
      }
    })()
    : row
  if (!parsed || typeof parsed !== 'object') return null
  const rec = parsed as Record<string, unknown>
  const id = typeof rec.id === 'string' ? rec.id : ''
  const name = typeof rec.name === 'string' ? rec.name : ''
  if (!id) return null
  return {
    id,
    name,
    objectKeys: uniqueDeletableAdminObjectKeys(rec.object_keys ?? rec.objectKeys),
  }
}

export function missingDeleteAdminShopCopy(message: string): string | null {
  if (!/schema cache|does not exist|delete_admin_shop/i.test(message)) return null
  return 'Apply db/20261026_delete_admin_shop.sql in the SQL editor, then try again.'
}

export function deleteCafeTitle(name: string): string {
  return `Delete ${name}?`
}

export function deleteCafeMessage(): string {
  return 'This removes the listing from Home, Map, and the admin desk. Reviews, visits, and unused photos go with it. It cannot be undone.'
}

export function deleteCafeAction(): string {
  return 'Delete cafe'
}

export function deleteCafeBusyLabel(): string {
  return 'Deleting…'
}

export function deleteCafeDoneCopy(name: string): string {
  return `${name} was deleted.`
}

export type CafeDeskAction = 'edit' | 'publish' | 'unpublish' | 'approve' | 'reject' | 'delete'

export function cafeDeskActions(status: ShopStatus): CafeDeskAction[] {
  const actions: CafeDeskAction[] = ['edit']
  if (status === 'pending') actions.push('approve', 'reject')
  if (status === 'hidden') actions.push('publish')
  if (status === 'approved') actions.push('unpublish')
  actions.push('delete')
  return actions
}

export function cafeDeskActionLabel(action: CafeDeskAction): string {
  if (action === 'edit') return 'Edit'
  if (action === 'publish') return 'Publish'
  if (action === 'unpublish') return 'Unpublish'
  if (action === 'approve') return 'Approve'
  if (action === 'reject') return 'Reject'
  return 'Delete'
}

export function cafeDeskActionTone(action: CafeDeskAction): 'default' | 'danger' {
  return action === 'delete' || action === 'reject' || action === 'unpublish' ? 'danger' : 'default'
}

export function cafeDeskConfirmTitle(action: Exclude<CafeDeskAction, 'edit'>, name: string): string {
  if (action === 'publish') return `Publish ${name}?`
  if (action === 'unpublish') return `Unpublish ${name}?`
  if (action === 'approve') return `Approve ${name}?`
  if (action === 'reject') return `Reject ${name}?`
  return deleteCafeTitle(name)
}

export function cafeDeskConfirmMessage(action: Exclude<CafeDeskAction, 'edit'>): string {
  if (action === 'publish' || action === 'approve') return 'It goes live on Home and Map.'
  if (action === 'unpublish') return 'It leaves Home and Map until you publish it again.'
  if (action === 'reject') return 'It stays off Home and Map. Say why.'
  return deleteCafeMessage()
}

export function cafeDeskConfirmAction(action: Exclude<CafeDeskAction, 'edit'>): string {
  if (action === 'publish') return 'Publish'
  if (action === 'unpublish') return 'Unpublish'
  if (action === 'approve') return 'Approve'
  if (action === 'reject') return 'Reject cafe'
  return deleteCafeAction()
}

export function cafeDeskBusyLabel(action: Exclude<CafeDeskAction, 'edit'>): string {
  if (action === 'publish') return 'Publishing…'
  if (action === 'unpublish') return 'Unpublishing…'
  if (action === 'approve') return 'Approving…'
  if (action === 'reject') return 'Rejecting…'
  return deleteCafeBusyLabel()
}

export function cafeDeskDoneCopy(action: Exclude<CafeDeskAction, 'edit'>, name: string): string {
  if (action === 'publish' || action === 'approve') return `${name} is on Home and Map.`
  if (action === 'unpublish') return `${name} left Home and Map.`
  if (action === 'reject') return `${name} stays off Home and Map.`
  return deleteCafeDoneCopy(name)
}

export function cafeDeskConfirmVariant(action: Exclude<CafeDeskAction, 'edit'>): 'default' | 'destructive' {
  return action === 'delete' || action === 'reject' || action === 'unpublish' ? 'destructive' : 'default'
}
