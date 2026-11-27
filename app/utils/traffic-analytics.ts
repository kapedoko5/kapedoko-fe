import {
  SHOP_TRAFFIC_SURFACES,
  TRAFFIC_RANGES,
  TRAFFIC_TABS,
  filterDailyRows,
  manilaDateString,
  shiftManilaDay,
  shopTrafficSurfaceLabel,
  tallyFromDaily,
  trafficRangeStartDay,
  trafficRatio,
  type ShopTrafficDailyRow,
  type ShopTrafficSurface,
  type ShopTrafficTally,
  type TrafficRangeDays,
  type TrafficTabId,
} from './shop-traffic'

/* ---------- Period split and change ---------- */

export type TrafficPeriodSplit = {
  days: number
  currentFrom: string
  currentTo: string
  previousFrom: string
  previousTo: string
  current: ShopTrafficDailyRow[]
  previous: ShopTrafficDailyRow[]
}

/**
 * Split daily rows into the current window (ending today, Manila) and the
 * previous window of equal length directly before it.
 */
export function splitTrafficPeriods(
  rows: ShopTrafficDailyRow[],
  days: number,
  input: { now?: Date, shopIds?: string[] | null, surfaces?: ShopTrafficSurface[] | null } = {},
): TrafficPeriodSplit {
  const now = input.now ?? new Date()
  const currentTo = manilaDateString(now)
  const currentFrom = trafficRangeStartDay(days, now)
  const previousTo = shiftManilaDay(currentFrom, -1)
  const previousFrom = shiftManilaDay(currentFrom, -days)
  const base = { shopIds: input.shopIds ?? null, surfaces: input.surfaces ?? null }
  return {
    days,
    currentFrom,
    currentTo,
    previousFrom,
    previousTo,
    current: filterDailyRows(rows, { ...base, fromDay: currentFrom, toDay: currentTo }),
    previous: filterDailyRows(rows, { ...base, fromDay: previousFrom, toDay: previousTo }),
  }
}

/** Fractional change (0.25 = +25%). Null when there is nothing to compare against. */
export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous <= 0) return null
  return (current - previous) / previous
}

export type KpiMetric = 'impressions' | 'clicks' | 'visits' | 'actions'

/** Below these previous-period counts a percent change is noise, so show absolutes. */
export const KPI_MIN_COUNT: Record<KpiMetric, number> = {
  impressions: 20,
  clicks: 5,
  visits: 5,
  actions: 5,
}

export type KpiDelta = {
  /** Fractional change, null when not comparable. */
  change: number | null
  direction: 'up' | 'down' | 'flat' | null
  /** True when the change chip may be shown; false means show absolutes instead. */
  reliable: boolean
  current: number
  previous: number
  /** Absolute difference, always available. */
  difference: number
}

export function kpiDelta(
  metric: KpiMetric,
  current: number,
  previous: number,
): KpiDelta {
  const change = percentChange(current, previous)
  const reliable = change != null && previous >= KPI_MIN_COUNT[metric]
  let direction: KpiDelta['direction'] = null
  if (reliable && change != null) {
    const rounded = Math.round(change * 1000) / 10
    direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat'
  }
  return { change, direction, reliable, current, previous, difference: current - previous }
}

export function formatKpiChange(change: number | null): string {
  if (change == null) return '—'
  const pct = Math.round(Math.abs(change) * 1000) / 10
  if (pct === 0) return '0%'
  return `${change > 0 ? '+' : '−'}${pct}%`
}

export type TrafficEmptyKind = 'just-enabled' | 'no-traffic' | null

export function trafficTotal(tally: ShopTrafficTally): number {
  return tally.impressions + tally.clicks + tally.visits + tally.engagement
}

/**
 * just-enabled: nothing recorded in either window. no-traffic: the earlier
 * window had traffic but this one has none. null: there is traffic to show.
 */
export function analyticsEmptyKind(
  current: ShopTrafficTally,
  previous: ShopTrafficTally,
): TrafficEmptyKind {
  if (trafficTotal(current) > 0) return null
  return trafficTotal(previous) > 0 ? 'no-traffic' : 'just-enabled'
}

/* ---------- Daily series ---------- */

export type TrafficSeriesPoint = {
  day: string
  impressions: number
  clicks: number
  visits: number
  actions: number
}

export function eachDayInclusive(fromDay: string, toDay: string): string[] {
  const out: string[] = []
  let cursor = fromDay
  for (let i = 0; i < 400 && cursor <= toDay; i += 1) {
    out.push(cursor)
    cursor = shiftManilaDay(cursor, 1)
  }
  return out
}

export function dailySeries(
  rows: ShopTrafficDailyRow[],
  fromDay: string,
  toDay: string,
): TrafficSeriesPoint[] {
  const byDay = new Map<string, TrafficSeriesPoint>()
  for (const day of eachDayInclusive(fromDay, toDay)) {
    byDay.set(day, { day, impressions: 0, clicks: 0, visits: 0, actions: 0 })
  }
  for (const row of rows) {
    const point = byDay.get(row.day)
    if (!point) continue
    if (row.kind === 'card_impression') point.impressions += row.hits
    else if (row.kind === 'card_click') point.clicks += row.hits
    else if (row.kind === 'detail_view') point.visits += row.hits
    else point.actions += row.hits
  }
  return [...byDay.values()]
}

/* ---------- Funnel ---------- */

export type FunnelStep = {
  id: 'impressions' | 'clicks' | 'visits' | 'actions'
  label: string
  count: number
  /** Share of the previous step, null for the first step or when it is zero. */
  fromPrevious: number | null
  /** Share of the first step. */
  fromTop: number | null
}

/**
 * Impressions -> Card clicks -> Cafe page (visits) -> Actions.
 * Rates can pass 100%: map taps open the cafe page without a card click, and
 * one visit can hold several actions. Callers cap what they draw.
 */
export function funnelSteps(tally: ShopTrafficTally): FunnelStep[] {
  const counts: Array<[FunnelStep['id'], string, number]> = [
    ['impressions', 'Impressions', tally.impressions],
    ['clicks', 'Card clicks', tally.clicks],
    ['visits', 'Cafe page', tally.visits],
    ['actions', 'Actions', tally.engagement],
  ]
  const top = counts[0]![2]
  return counts.map(([id, label, count], index) => ({
    id,
    label,
    count,
    fromPrevious: index === 0 ? null : trafficRatio(count, counts[index - 1]![2]),
    fromTop: index === 0 ? null : trafficRatio(count, top),
  }))
}

export function formatFunnelRate(rate: number | null): string {
  if (rate == null) return '—'
  if (rate > 1) return '100%+'
  return `${Math.round(rate * 1000) / 10}%`
}

/* ---------- Sources ---------- */

export type SourceRow = {
  surface: ShopTrafficSurface
  name: string
  impressions: number
  clicks: number
  visits: number
  ctr: number | null
  /** Share of all visits (cafe page opens); null when there are no visits. */
  share: number | null
}

/** Ranked sources: most visits first, then clicks. Silent surfaces are dropped. */
export function rankSources(rows: ShopTrafficDailyRow[]): SourceRow[] {
  const by = new Map<ShopTrafficSurface, ShopTrafficDailyRow[]>()
  for (const surface of SHOP_TRAFFIC_SURFACES) by.set(surface, [])
  for (const row of rows) by.get(row.surface)?.push(row)
  const list = SHOP_TRAFFIC_SURFACES.map((surface) => {
    const tally = tallyFromDaily(by.get(surface) ?? [])
    return {
      surface,
      name: shopTrafficSurfaceLabel(surface),
      impressions: tally.impressions,
      clicks: tally.clicks,
      visits: tally.visits,
      ctr: tally.ctr,
      share: null as number | null,
    }
  }).filter((row) => row.impressions + row.clicks + row.visits > 0)
  const totalVisits = list.reduce((sum, row) => sum + row.visits, 0)
  for (const row of list) row.share = trafficRatio(row.visits, totalVisits)
  return list.sort((a, b) => b.visits - a.visits || b.clicks - a.clicks || b.impressions - a.impressions)
}

/* ---------- URL query ---------- */

export const DEFAULT_TRAFFIC_TAB: TrafficTabId = 'statistics'
export const DEFAULT_TRAFFIC_RANGE: TrafficRangeDays = 30

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0])
  return typeof value === 'string' ? value.trim() : ''
}

/** Read ?tab=&range= defensively. Anything unknown falls back to defaults. */
export function parseAnalyticsQuery(
  query: Record<string, unknown> | null | undefined,
  /** Tabs this desk offers. A tab outside the list falls back to the default. */
  allowedTabs: readonly TrafficTabId[] = TRAFFIC_TABS,
): {
  tab: TrafficTabId
  range: TrafficRangeDays
} {
  const rawTab = firstQueryValue(query?.tab)
  const rawRange = firstQueryValue(query?.range)
  const tab = (allowedTabs as readonly string[]).includes(rawTab)
    ? (rawTab as TrafficTabId)
    : DEFAULT_TRAFFIC_TAB
  const parsed = /^\d{1,3}$/.test(rawRange) ? Number(rawRange) : NaN
  const range = (TRAFFIC_RANGES as readonly number[]).includes(parsed)
    ? (parsed as TrafficRangeDays)
    : DEFAULT_TRAFFIC_RANGE
  return { tab, range }
}

/** Merge tab/range into an existing query, dropping defaults to keep URLs clean. */
export function buildAnalyticsQuery(
  existing: Record<string, unknown> | null | undefined,
  state: { tab: TrafficTabId, range: TrafficRangeDays },
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) }
  delete next.tab
  delete next.range
  if (state.tab !== DEFAULT_TRAFFIC_TAB) next.tab = state.tab
  if (state.range !== DEFAULT_TRAFFIC_RANGE) next.range = String(state.range)
  return next
}
