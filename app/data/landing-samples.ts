import type { Cafe } from '../types/cafe'
import { cafeMatchesFilter, type CafeFilterId } from '../utils/cafe-filters'

/**
 * Fictional sample cafes for the web landing page only.
 * None of these are listed shops; every bag prints a "Sample" origin line.
 */
export interface LandingSampleVibe {
  label: string
  lucideIcon: string
  color: string
}

export interface LandingSampleCafe {
  id: string
  name: string
  /** Always "Sample · <area>" so a visitor never mistakes it for a listing. */
  origin: string
  hours: string
  wifi: boolean | null
  plug: boolean | null
  vibe?: LandingSampleVibe
}

export const LANDING_SAMPLE_CAFES: LandingSampleCafe[] = [
  { id: 's1', name: 'Kapihan sa Kanto', origin: 'Sample · Quezon City', hours: '7am – 10pm', wifi: true, plug: true },
  { id: 's2', name: 'Tasa & Tala', origin: 'Sample · Makati', hours: '8am – 9pm', wifi: true, plug: null },
  { id: 's3', name: 'Bean There Cebu', origin: 'Sample · Cebu City', hours: '9am – 6pm', wifi: null, plug: null },
  { id: 's4', name: 'Sulok Roasters', origin: 'Sample · Davao City', hours: '6am – 12mn', wifi: true, plug: true },
  { id: 's5', name: 'Mainit Pa', origin: 'Sample · Pasig', hours: '10am – 8pm', wifi: false, plug: true },
  { id: 's6', name: 'Barako Bench', origin: 'Sample · Taguig', hours: '7am – 7pm', wifi: true, plug: false },
]

/** Fallback vibe stickers when the live catalog cannot load. Labels only, no shop data. */
export const LANDING_FALLBACK_VIBES: (LandingSampleVibe & { id: string })[] = [
  { id: 'quiet', label: 'Quiet corner', lucideIcon: 'volume-x', color: '#1F6F6B' },
  { id: 'study', label: 'Study mode', lucideIcon: 'book-open', color: '#3B5BA9' },
  { id: 'cozy', label: 'Cozy', lucideIcon: 'sofa', color: '#D9793B' },
  { id: 'music', label: 'Good music', lucideIcon: 'music', color: '#8E4FB0' },
  { id: 'green', label: 'Plants', lucideIcon: 'leaf', color: '#3E8E41' },
  { id: 'late', label: 'Late night', lucideIcon: 'moon', color: '#2F3A56' },
]

/** Landing spotlight toggles: the two work filters from the real Home filter list. */
export const LANDING_SPOTLIGHT_FILTERS = ['wifi', 'plugs'] as const satisfies readonly CafeFilterId[]
export type LandingSpotlightFilter = (typeof LANDING_SPOTLIGHT_FILTERS)[number]

/** Run a sample through the real Home filter predicate. */
export function sampleMatchesFilters(sample: LandingSampleCafe, filters: readonly CafeFilterId[]): boolean {
  const probe = {
    popular: false,
    work: { wifi: sample.wifi, plug: sample.plug },
  } as unknown as Cafe
  return filters.every((filter) => cafeMatchesFilter(probe, filter))
}

export function amenityWord(value: boolean | null): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Unknown'
}
