import { isShopId } from './approved-shops'
import { trafficRatio } from './shop-traffic'

export const AD_PLACEMENTS = ['banner', 'featured'] as const
export type AdPlacement = (typeof AD_PLACEMENTS)[number]

export const AD_EVENT_KINDS = ['impression', 'click'] as const
export type AdEventKind = (typeof AD_EVENT_KINDS)[number]

export const AD_EVENT_COOLDOWN_MS = 2000

export type AdStatRow = {
  campaignId: string | null
  shopId: string | null
  placement: AdPlacement
  label: string | null
  impressions: number
  clicks: number
}

export type AdTotals = {
  impressions: number
  clicks: number
  ctr: number | null
}

export type AdPlacementSummary = Record<AdPlacement, AdTotals>

const PLACEMENT_LABEL: Record<AdPlacement, string> = {
  banner: 'Home banners',
  featured: 'Featured cafes',
}

export function adPlacementLabel(placement: AdPlacement): string {
  return PLACEMENT_LABEL[placement]
}

export function isAdPlacement(value: unknown): value is AdPlacement {
  return typeof value === 'string' && (AD_PLACEMENTS as readonly string[]).includes(value)
}

/**
 * Whether an ad event may be sent. Banners need a campaign id; featured events
 * need a cafe id and never carry a campaign (matches the table's shape check).
 */
export function adEventIsValid(input: {
  placement: AdPlacement
  campaignId?: string | null
  shopId?: string | null
}): boolean {
  const campaign = input.campaignId?.trim() || ''
  const shop = input.shopId?.trim() || ''
  if (input.placement === 'banner') return isShopId(campaign)
  return isShopId(shop) && !campaign
}

export function createAdCooldown(ms = AD_EVENT_COOLDOWN_MS) {
  const last = new Map<string, number>()
  return (
    placement: AdPlacement,
    kind: AdEventKind,
    campaignId: string | null | undefined,
    shopId: string | null | undefined,
    now = Date.now(),
  ) => {
    const key = `${placement}:${kind}:${campaignId ?? ''}:${shopId ?? ''}`
    const previous = last.get(key)
    if (previous != null && now - previous < ms) return false
    last.set(key, now)
    return true
  }
}

export function parseAdStats(rows: unknown): AdStatRow[] {
  if (!Array.isArray(rows)) return []
  const next: AdStatRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    if (!isAdPlacement(item.placement)) continue
    const impressions = Number(item.impressions)
    const clicks = Number(item.clicks)
    next.push({
      campaignId: typeof item.campaign_id === 'string' ? item.campaign_id : null,
      shopId: typeof item.shop_id === 'string' ? item.shop_id : null,
      placement: item.placement,
      label: typeof item.label === 'string' ? item.label : null,
      impressions: Number.isFinite(impressions) ? impressions : 0,
      clicks: Number.isFinite(clicks) ? clicks : 0,
    })
  }
  return next
}

function totals(impressions: number, clicks: number): AdTotals {
  return { impressions, clicks, ctr: trafficRatio(clicks, impressions) }
}

/** Banner vs featured totals. */
export function summarizeAdStats(rows: AdStatRow[]): AdPlacementSummary {
  const sums = { banner: [0, 0], featured: [0, 0] } as Record<AdPlacement, [number, number]>
  for (const row of rows) {
    sums[row.placement][0] += row.impressions
    sums[row.placement][1] += row.clicks
  }
  return {
    banner: totals(sums.banner[0], sums.banner[1]),
    featured: totals(sums.featured[0], sums.featured[1]),
  }
}

/** Per banner campaign totals, keyed by campaign id. */
export function adStatsByCampaign(rows: AdStatRow[]): Map<string, AdTotals> {
  const sums = new Map<string, [number, number]>()
  for (const row of rows) {
    if (row.placement !== 'banner' || !row.campaignId) continue
    const sum = sums.get(row.campaignId) ?? [0, 0]
    sum[0] += row.impressions
    sum[1] += row.clicks
    sums.set(row.campaignId, sum)
  }
  return new Map([...sums].map(([id, [impressions, clicks]]) => [id, totals(impressions, clicks)]))
}

/** Count featured rows an owner can read (from ad_campaign_events). */
export function featuredTotalsFromEvents(kinds: Array<string | null | undefined>): AdTotals {
  let impressions = 0
  let clicks = 0
  for (const kind of kinds) {
    if (kind === 'impression') impressions += 1
    else if (kind === 'click') clicks += 1
  }
  return totals(impressions, clicks)
}

export function hasAdTraffic(summary: AdPlacementSummary): boolean {
  return AD_PLACEMENTS.some((placement) => summary[placement].impressions + summary[placement].clicks > 0)
}
