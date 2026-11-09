import { isShopId } from './approved-shops'

export const OWNER_NAV = [
  { id: 'desk', label: 'Desk', href: '/owner' },
  { id: 'cafes', label: 'Cafes', href: '/owner/cafes' },
  { id: 'claims', label: 'Claims', href: '/owner/claims' },
] as const

export type OwnerNavId = (typeof OWNER_NAV)[number]['id']

export type OwnerBackNav = {
  to: string
  label: string
}

function ownerPathOnly(path: string): string {
  const raw = path.split(/[?#]/)[0] || path
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw
}

export function ownerNavIdFromPath(path: string): OwnerNavId {
  const current = ownerPathOnly(path)
  if (current.startsWith('/owner/cafes')) return 'cafes'
  if (current.startsWith('/owner/claims')) return 'claims'
  return 'desk'
}

/** Parent for nested owner routes. Always an explicit path — never history.back(). */
export function ownerBackNav(path: string): OwnerBackNav | null {
  const current = ownerPathOnly(path)
  if (current.startsWith('/owner/cafes/') && current !== '/owner/cafes/') {
    return { to: '/owner/cafes', label: 'Cafes' }
  }
  return null
}

export function isOwnerDeskPath(path: string): boolean {
  const current = ownerPathOnly(path)
  return current === '/owner' || current.startsWith('/owner/')
}

export function isOwnerLoginPath(path: string): boolean {
  const current = ownerPathOnly(path)
  return current === '/owner/login' || current.startsWith('/owner/login/')
}

export function ownerCafeEditPath(shopId: string): string {
  return isShopId(shopId) ? `/owner/cafes/${shopId}` : '/owner/cafes'
}

export function padOwnerDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatOwnerDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
