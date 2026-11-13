import { isShopId } from './approved-shops'

export const OWNER_NAV = [
  { id: 'desk', label: 'Desk', href: '/owner' },
  { id: 'cafes', label: 'Cafes', href: '/owner/cafes' },
  { id: 'ads', label: 'Ads', href: '/owner/ads' },
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
  if (current.startsWith('/owner/ads')) return 'ads'
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

/** Keep the top Ionic page visible after owner-desk navigations. */
export function settleOwnerIonPages() {
  if (typeof document === 'undefined') return
  const pages = [...document.querySelectorAll('ion-router-outlet .ion-page')]
  if (pages.length < 2) return
  pages.forEach((page, index) => {
    const top = index === pages.length - 1
    page.classList.toggle('ion-page-hidden', !top)
    if (top) {
      page.classList.remove('ion-page-invisible')
      page.removeAttribute('aria-hidden')
    } else {
      page.setAttribute('aria-hidden', 'true')
    }
  })
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
