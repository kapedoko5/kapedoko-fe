export const PLACEMENT_FEATURE_IDS = [
  'featured_photos',
  'ad_poster',
  'analytics',
  'theme',
  'home_carousel',
] as const

export type PlacementFeatureId = (typeof PLACEMENT_FEATURE_IDS)[number]

export type PlacementFeatures = Record<PlacementFeatureId, boolean>

export const ALWAYS_ON_PLACEMENT_FEATURES = [
  {
    id: 'listing',
    label: 'Hours, phone, and map pin',
    hint: 'Always on for a claimed, approved cafe.',
  },
  {
    id: 'name',
    label: 'Cafe name',
    hint: 'A name change waits on a light admin review.',
  },
  {
    id: 'logo',
    label: 'Logo',
    hint: 'Always on.',
  },
  {
    id: 'vibe_tags',
    label: 'Vibe tags',
    hint: 'Always on.',
  },
  {
    id: 'amenity_verify',
    label: 'Amenity verification',
    hint: 'WiFi, seating, outlets, and payment proof. Always on.',
  },
] as const

export const TOGGLE_PLACEMENT_FEATURES: {
  id: PlacementFeatureId
  label: string
  hint: string
}[] = [
  {
    id: 'featured_photos',
    label: 'Full featured photos (8)',
    hint: 'Off keeps the free listing cap of 3.',
  },
  {
    id: 'ad_poster',
    label: 'Ad Poster',
    hint: 'Owner can hang a poster on the cafe page.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    hint: 'Owner desk traffic for this cafe.',
  },
  {
    id: 'theme',
    label: 'Theme',
    hint: 'Owner can ink buttons, words, and stock on the cafe page.',
  },
  {
    id: 'home_carousel',
    label: 'Home carousel',
    hint: 'Optional reach on Home when no admin banner is live.',
  },
]

export function emptyPlacementFeatures(): PlacementFeatures {
  return {
    featured_photos: false,
    ad_poster: false,
    analytics: false,
    theme: false,
    home_carousel: false,
  }
}

export function defaultPlacementFeatures(kind: 'partner' | 'sponsored'): PlacementFeatures {
  if (kind === 'sponsored') {
    return {
      featured_photos: true,
      ad_poster: true,
      analytics: true,
      theme: true,
      home_carousel: false,
    }
  }
  return {
    featured_photos: true,
    ad_poster: false,
    analytics: false,
    theme: false,
    home_carousel: false,
  }
}

export function placementFeaturesPayload(
  features: Partial<PlacementFeatures> | Record<string, boolean> | null | undefined,
): PlacementFeatures {
  const next = emptyPlacementFeatures()
  if (!features) return next
  for (const id of PLACEMENT_FEATURE_IDS) {
    next[id] = Boolean(features[id])
  }
  return next
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 't' || value === 1) return true
  if (value === 'false' || value === 'f' || value === 0) return false
  return fallback
}

export function parsePlacementFeatures(
  row: {
    kind?: 'partner' | 'sponsored' | string
    features?: unknown
    show_on_home?: boolean | null
  } | null | undefined,
): PlacementFeatures {
  const kind = row?.kind === 'sponsored' ? 'sponsored' : 'partner'
  const defaults = defaultPlacementFeatures(kind)
  const raw = row?.features
  const bag = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null
  const next = emptyPlacementFeatures()
  for (const id of PLACEMENT_FEATURE_IDS) {
    next[id] = asBoolean(bag?.[id], defaults[id])
  }
  if (bag?.home_carousel == null && row?.show_on_home != null) {
    next.home_carousel = Boolean(row.show_on_home)
  }
  return next
}

export function enabledPlacementFeatureLabels(features: PlacementFeatures): string[] {
  return TOGGLE_PLACEMENT_FEATURES.filter((item) => features[item.id]).map((item) => item.label)
}

export function placementFeaturesSummary(features: PlacementFeatures): string {
  const labels = enabledPlacementFeatureLabels(features)
  if (labels.length === 0) return 'Defaults only (pin + always-on listing tools)'
  return labels.join(' · ')
}
