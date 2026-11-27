import {
  formatTrafficRatio,
  trafficRatio,
  type ShopTrafficDailyRow,
  type ShopTrafficTally,
} from './shop-traffic'
import { DOW_NAMES, busiestSlot, describeSlot, type HourlyGrid } from './peak-hours'

/** Insights are quiet on purpose: no tone is an alarm, and low volume says nothing. */
export type InsightTone = 'attention' | 'tip' | 'info'

export type Insight = {
  id: string
  tone: InsightTone
  title: string
  body: string
  cta?: { label: string, to: string }
}

export const MAX_INSIGHTS = 3

/** Minimum counts before a rule may speak. */
export const INSIGHT_MIN = {
  /** Visits in both windows before comparing directions per visit. */
  directionsVisits: 20,
  /** Relative drop (0.25 = 25% lower) that counts as a real fall. */
  directionsDrop: 0.25,
  /** Smallest absolute fall in directions per visit worth mentioning. */
  directionsAbsolute: 0.03,
  photoTaps: 10,
  photoTapsPerVisit: 0.25,
  searchTraffic: 30,
  weekdayVisits: 30,
  weekdayShare: 0.25,
} as const

export type InsightInput = {
  current: ShopTrafficTally
  previous: ShopTrafficTally
  /** Daily rows for the current window (all surfaces). */
  currentRows: ShopTrafficDailyRow[]
  /** Featured photos on the listing. Omit when unknown (admin, many cafes). */
  photoCount?: number | null
  photoCap?: number | null
  /** Check-in hour grid (Manila). Used on its own, never divided into traffic. */
  checkinGrid?: HourlyGrid | null
  /** Editor link for owner fixes. Omit and no call to action is shown. */
  editorPath?: string | null
}

const TONE_RANK: Record<InsightTone, number> = { attention: 0, tip: 1, info: 2 }

function directionsRate(tally: ShopTrafficTally): number | null {
  return trafficRatio(tally.navigate, tally.visits)
}

function directionsInsight(input: InsightInput): Insight | null {
  const { current, previous } = input
  if (current.visits < INSIGHT_MIN.directionsVisits || previous.visits < INSIGHT_MIN.directionsVisits) return null
  const now = directionsRate(current)
  const before = directionsRate(previous)
  if (now == null || before == null || before <= 0) return null
  if (before - now < INSIGHT_MIN.directionsAbsolute) return null
  if (now > before * (1 - INSIGHT_MIN.directionsDrop)) return null
  return {
    id: 'directions-drop',
    tone: 'attention',
    title: 'Fewer visitors are asking for directions',
    body: `${formatTrafficRatio(now)} of visits tapped directions, down from ${formatTrafficRatio(before)} in the period before. Check that your address, hours and pin are right.`,
    cta: input.editorPath ? { label: 'Check listing details', to: input.editorPath } : undefined,
  }
}

function photosInsight(input: InsightInput): Insight | null {
  const { current } = input
  if (input.photoCount == null || input.photoCap == null) return null
  if (input.photoCount >= input.photoCap) return null
  if (current.photos < INSIGHT_MIN.photoTaps) return null
  const perVisit = trafficRatio(current.photos, current.visits)
  if (perVisit == null || perVisit < INSIGHT_MIN.photoTapsPerVisit) return null
  const have = input.photoCount
  return {
    id: 'photos-few',
    tone: 'tip',
    title: 'People look at your photos, add more',
    body: `Photos were opened ${current.photos} times, and the listing shows ${have} of ${input.photoCap}. More photos give those visitors more to see.`,
    cta: input.editorPath ? { label: 'Add featured photos', to: input.editorPath } : undefined,
  }
}

function searchInsight(input: InsightInput): Insight | null {
  const total = input.currentRows.reduce((sum, row) => sum + row.hits, 0)
  if (total < INSIGHT_MIN.searchTraffic) return null
  const search = input.currentRows.filter((row) => row.surface === 'search')
  if (search.some((row) => row.hits > 0)) return null
  return {
    id: 'no-search',
    tone: 'tip',
    title: 'No one found you through Search',
    body: 'Vibe tags and verified amenities help a cafe turn up when people search and filter. Add a few so you appear for the right reasons.',
    cta: input.editorPath ? { label: 'Add vibe tags', to: input.editorPath } : undefined,
  }
}

/** Manila weekday of a YYYY-MM-DD day (0 = Sunday). */
export function weekdayOfDay(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()
}

/** Visits per weekday. Null when too few visits or no day stands out. */
export function busiestWeekday(
  rows: ShopTrafficDailyRow[],
): { dow: number, visits: number, share: number } | null {
  const by = Array.from({ length: 7 }, () => 0)
  let total = 0
  for (const row of rows) {
    if (row.kind !== 'detail_view') continue
    const dow = weekdayOfDay(row.day)
    if (dow == null) continue
    by[dow]! += row.hits
    total += row.hits
  }
  if (total < INSIGHT_MIN.weekdayVisits) return null
  let best = 0
  for (let dow = 1; dow < 7; dow += 1) if (by[dow]! > by[best]!) best = dow
  const share = by[best]! / total
  if (share < INSIGHT_MIN.weekdayShare) return null
  return { dow: best, visits: by[best]!, share }
}

function busiestDayInsight(input: InsightInput): Insight | null {
  const best = busiestWeekday(input.currentRows)
  if (!best) return null
  return {
    id: 'busiest-day',
    tone: 'info',
    title: `${DOW_NAMES[best.dow]} is your busiest day online`,
    body: `${Math.round(best.share * 100)}% of cafe page visits landed on a ${DOW_NAMES[best.dow]}. Make sure your hours and photos are current going into it.`,
  }
}

function busiestTimeInsight(input: InsightInput): Insight | null {
  if (!input.checkinGrid) return null
  const peak = busiestSlot(input.checkinGrid)
  if (!peak) return null
  return {
    id: 'busiest-time',
    tone: 'info',
    title: 'Your busiest time, by check-ins',
    body: `Check-ins from the last 14 days cluster on ${describeSlot(peak.dow, peak.hour)}. Plan staffing around it.`,
  }
}

/** Rule order is priority within a tone. Returns at most `limit` insights. */
export function buildInsights(input: InsightInput, limit = MAX_INSIGHTS): Insight[] {
  const found = [
    directionsInsight(input),
    photosInsight(input),
    searchInsight(input),
    busiestDayInsight(input),
    busiestTimeInsight(input),
  ].filter((item): item is Insight => item !== null)
  return found
    .map((item, index) => ({ item, index }))
    .sort((a, b) => TONE_RANK[a.item.tone] - TONE_RANK[b.item.tone] || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map(({ item }) => item)
}
