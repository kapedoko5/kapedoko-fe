import { isShopId } from './approved-shops'

export const ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', href: '/admin' },
  { id: 'cafes', label: 'Cafes', href: '/admin/cafes' },
  { id: 'audits', label: 'Audits', href: '/admin/audits' },
  { id: 'requests', label: 'Requests', href: '/admin/requests' },
  { id: 'claims', label: 'Claims', href: '/admin/claims' },
  { id: 'partnerships', label: 'Partnerships', href: '/admin/partnerships' },
  { id: 'ads', label: 'Ads', href: '/admin/ads' },
  { id: 'users', label: 'Users', href: '/admin/users' },
  { id: 'moderation', label: 'Moderation', href: '/admin/moderation' },
] as const

/** Parent target for a nested admin page. Always an explicit route — never history.back(). */
export type AdminBackNav = {
  to: string
  label: string
}

function adminPathOnly(path: string): string {
  const raw = path.split(/[?#]/)[0] || path
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw
}

function queryShop(query: { shop?: unknown } | undefined): string {
  const value = query?.shop
  const shop = Array.isArray(value) ? String(value[0] || '') : typeof value === 'string' ? value : ''
  return shop.trim()
}

/**
 * Resolve the section parent for nested admin routes.
 * Section indexes (`/admin/cafes`, `/admin/audits`, …) return null so their headers stay unchanged.
 *
 * @param path Current admin pathname (query/hash ignored).
 * @param query Route query. `shop` on `/admin/audits/new` sends back to that cafe's audit history.
 */
export function adminBackNav(
  path: string,
  query?: { shop?: unknown },
): AdminBackNav | null {
  const current = adminPathOnly(path)

  if (current === '/admin/audits/new') {
    const shop = queryShop(query)
    if (isShopId(shop)) return { to: `/admin/audits/${shop}`, label: 'Cafe audits' }
    return { to: '/admin/audits', label: 'Audits' }
  }

  if (current.startsWith('/admin/audits/') && current !== '/admin/audits/') {
    return { to: '/admin/audits', label: 'Audits' }
  }

  if (current.startsWith('/admin/cafes/') && current !== '/admin/cafes/') {
    return { to: '/admin/cafes', label: 'Cafes' }
  }

  return null
}

export function staffNav(role: 'admin' | 'auditor' | string | null | undefined) {
  if (role === 'auditor') return ADMIN_NAV.filter((item) => item.id === 'audits')
  return [...ADMIN_NAV]
}

export function adminNavIdFromPath(path: string): (typeof ADMIN_NAV)[number]['id'] {
  if (path.includes('/audits')) return 'audits'
  if (path.startsWith('/admin/cafes')) return 'cafes'
  if (path.startsWith('/admin/requests')) return 'requests'
  if (path.startsWith('/admin/claims')) return 'claims'
  if (path.startsWith('/admin/partnerships')) return 'partnerships'
  if (path.startsWith('/admin/ads')) return 'ads'
  if (path.startsWith('/admin/users')) return 'users'
  if (path.startsWith('/admin/moderation')) return 'moderation'
  return 'dashboard'
}

export function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

export function fromLocalInput(value: string): string {
  const date = new Date(value)
  return date.toISOString()
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
