/** Real Poblacion, Makati streets for first-run map teaching. Not a listed cafe. */
export const ONBOARDING_TEACH_MAP = {
  lat: 14.56525,
  lng: 121.02955,
  startZoom: 12.6,
  endZoom: 16.6,
  label: 'Exact location',
} as const

export type MapsAppKind = 'apple' | 'google'

export function mapsAppFromUserAgent(userAgent: string): MapsAppKind {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'apple'
  return 'google'
}

export function mapsAppForClient(input: {
  platform?: string | null
  userAgent?: string | null
}): MapsAppKind {
  const platform = (input.platform ?? '').trim().toLowerCase()
  if (platform === 'ios') return 'apple'
  if (platform === 'android') return 'google'
  return mapsAppFromUserAgent(input.userAgent ?? '')
}

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${lat},${lng}`,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function appleMapsDirectionsUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    daddr: `${lat},${lng}`,
    dirflg: 'd',
  })
  return `https://maps.apple.com/?${params.toString()}`
}

export function directionsUrl(
  lat: number,
  lng: number,
  kind: MapsAppKind = 'google',
): string {
  return kind === 'apple' ? appleMapsDirectionsUrl(lat, lng) : googleMapsDirectionsUrl(lat, lng)
}

export function mapsLinkOpensInNewTab(kind: MapsAppKind, platform?: string | null): boolean {
  const native = (platform ?? '').trim().toLowerCase()
  if (native === 'ios' || native === 'android' || kind === 'apple') return false
  return true
}

export function cafeHasMapPoint(lat: number, lng: number): boolean {
  const nextLat = Number(lat)
  const nextLng = Number(lng)
  return Number.isFinite(nextLat) && Number.isFinite(nextLng) && !(nextLat === 0 && nextLng === 0)
}

export function cafePlaceLine(address: string, name: string): string {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) return parts.slice(-2).join(', ')
  if (parts[0] && parts[0].toLowerCase() !== name.toLowerCase()) return parts[0]
  return name
}
