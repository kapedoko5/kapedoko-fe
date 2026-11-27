import { trafficRatio, type ShopTrafficCafeRow } from './shop-traffic'

/** Below this many impressions a tag's CTR is mostly noise. */
export const VIBE_MIN_IMPRESSIONS = 50

export type ActiveVibeRow = {
  shop_id: string
  tag_id: string
  slug: string
  label: string
}

export type VibeTrafficRow = {
  tagId: string
  slug: string
  label: string
  /** Cafes that carry the tag. */
  cafes: number
  impressions: number
  clicks: number
  visits: number
  ctr: number | null
  visitsPerCafe: number | null
  /** False when impressions are too few for the CTR to be trusted. */
  enough: boolean
}

export function parseVibeRows(rows: unknown): ActiveVibeRow[] {
  if (!Array.isArray(rows)) return []
  const out: ActiveVibeRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const shopId = typeof item.shop_id === 'string' ? item.shop_id : ''
    const tagId = typeof item.tag_id === 'string' ? item.tag_id : ''
    const label = typeof item.label === 'string' ? item.label : ''
    if (!shopId || !tagId || !label) continue
    out.push({ shop_id: shopId, tag_id: tagId, slug: typeof item.slug === 'string' ? item.slug : '', label })
  }
  return out
}

/**
 * Traffic per vibe tag. A cafe with several tags counts toward each one, so
 * rows do not add up to the total. Most visits first, then clicks, then label.
 */
export function perVibeTraffic(
  cafeRows: ShopTrafficCafeRow[],
  vibeRows: ActiveVibeRow[],
): VibeTrafficRow[] {
  const byShop = new Map(cafeRows.map((row) => [row.shopId, row]))
  const tags = new Map<string, { slug: string, label: string, shops: Set<string> }>()
  for (const vibe of vibeRows) {
    const tag = tags.get(vibe.tag_id) ?? { slug: vibe.slug, label: vibe.label, shops: new Set<string>() }
    tag.shops.add(vibe.shop_id)
    tags.set(vibe.tag_id, tag)
  }
  const list: VibeTrafficRow[] = []
  for (const [tagId, tag] of tags) {
    let impressions = 0
    let clicks = 0
    let visits = 0
    for (const shopId of tag.shops) {
      const row = byShop.get(shopId)
      if (!row) continue
      impressions += row.impressions
      clicks += row.clicks
      visits += row.visits
    }
    const cafes = tag.shops.size
    list.push({
      tagId,
      slug: tag.slug,
      label: tag.label,
      cafes,
      impressions,
      clicks,
      visits,
      ctr: trafficRatio(clicks, impressions),
      visitsPerCafe: cafes > 0 ? visits / cafes : null,
      enough: impressions >= VIBE_MIN_IMPRESSIONS,
    })
  }
  return list.sort((a, b) =>
    b.visits - a.visits || b.clicks - a.clicks || a.label.localeCompare(b.label))
}
