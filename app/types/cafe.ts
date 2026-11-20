import type { CafeBadge, CafeVibeTag } from './admin'
import type { BusynessLevel, CafeWorkFacts, MarkerTier } from './shop'

export type { CafeBadge, CafeVibeTag }

export type Amenity = 'wifi' | 'plug'
export type PaymentKind = 'qr' | 'card' | 'cash'
export type PaymentResult = 'available' | 'unavailable' | 'unknown'

export type CafeFactSource = 'team' | 'owner'

export interface CafePayment {
  qr: PaymentResult
  card: PaymentResult
  cash: PaymentResult
  sourceAt: string | null
  source?: CafeFactSource | null
}

export interface CafeSeating {
  count: number
  source: CafeFactSource
  sourceAt: string | null
}

export interface LatLng {
  lat: number
  lng: number
}

export interface CafeReview {
  id: string
  name: string
  quote: string
  wifiVotes: number
  outletVotes: number
}

export interface CafeInsight {
  count: number
  title: string
  body: string
}

export interface Cafe {
  id: string
  name: string
  address: string
  image: string
  photos: string[]
  poster?: string | null
  open: boolean
  status: string
  hoursHint: string
  phone?: string
  amenities: Amenity[] | 'none'
  work: CafeWorkFacts
  popular: boolean
  rating: number
  ratingLabel: string
  wifiInsight?: CafeInsight
  plugInsight?: CafeInsight
  matchaInsight?: CafeInsight
  busyness?: {
    level: BusynessLevel
    label: string
    count: number
  } | null
  checkIns30d: number
  reviews: CafeReview[]
  lat: number
  lng: number
  markerTier: MarkerTier
  source?: 'openstreetmap' | 'user' | 'admin' | null
  payment?: CafePayment | null
  seating?: CafeSeating | null
  badges: CafeBadge[]
  vibeTags: CafeVibeTag[]
  themeButtonHex?: string | null
  themeTextHex?: string | null
  themeBackgroundHex?: string | null
}
