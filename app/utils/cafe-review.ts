import type { CafeInsight, CafeReview } from '../types/cafe'
import type {
  BusynessLevel,
  NoiseLevel,
  PowerAccess,
  ReviewTriState,
  ShopReviewInsert,
  ShopReviewPublicRow,
  ShopReviewRow,
  ShopReviewStatsRow,
  StayFit,
  WifiSpeed,
  WifiTimeLimit,
} from '../types/shop'

export const REVIEW_COMMENT_MAX = 280
export const BUSYNESS_COOLDOWN_MS = 30 * 60 * 1000
export const REVIEW_CHAPTERS = 5
export const INSIGHT_MIN_REVIEWS = 1

export const TRI_STATES: ReviewTriState[] = ['yes', 'no', 'unsure']
export const WIFI_SPEEDS: WifiSpeed[] = ['slow', 'okay', 'fast']
export const WIFI_CAPS: WifiTimeLimit[] = ['unlimited', 'voucher', 'purchase', 'unsure']
export const POWER_ACCESS: PowerAccess[] = ['easy', 'limited', 'scarce']
export const NOISE_LEVELS: NoiseLevel[] = ['quiet', 'mixed', 'loud']
export const STAY_FITS: StayFit[] = ['long', 'short', 'unsure']
export const BUSYNESS_LEVELS: BusynessLevel[] = ['quiet', 'comfortable', 'busy', 'full']

export type ReviewChapter = 1 | 2 | 3 | 4 | 5

export interface CafeReviewDraft {
  busyness: BusynessLevel | null
  wifiAvailable: ReviewTriState | null
  wifiSpeed: WifiSpeed | null
  wifiCap: WifiTimeLimit | null
  powerAvailable: ReviewTriState | null
  powerAccess: PowerAccess | null
  servesMatcha: ReviewTriState | null
  noise: NoiseLevel | null
  stayFit: StayFit | null
  recommend: boolean | null
  visitAgain: boolean | null
  comment: string
}

export interface ReviewChoice<T extends string> {
  value: T
  label: string
  hint?: string
}

export const emptyReviewDraft = (): CafeReviewDraft => ({
  busyness: null,
  wifiAvailable: null,
  wifiSpeed: null,
  wifiCap: null,
  powerAvailable: null,
  powerAccess: null,
  servesMatcha: null,
  noise: null,
  stayFit: null,
  recommend: null,
  visitAgain: null,
  comment: '',
})

export const BUSYNESS_OPTIONS: ReviewChoice<BusynessLevel>[] = [
  { value: 'quiet', label: 'Quiet', hint: 'Easy to find a table' },
  { value: 'comfortable', label: 'Comfortable', hint: 'Lively, still workable' },
  { value: 'busy', label: 'Busy', hint: 'Most seats taken' },
  { value: 'full', label: 'Full', hint: 'Waiting or standing' },
]

export const TRI_OPTIONS: ReviewChoice<ReviewTriState>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
]

export const WIFI_SPEED_OPTIONS: ReviewChoice<WifiSpeed>[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'okay', label: 'Okay' },
  { value: 'fast', label: 'Fast' },
]

export const WIFI_CAP_OPTIONS: ReviewChoice<WifiTimeLimit>[] = [
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'voucher', label: 'Voucher or time-limited' },
  { value: 'purchase', label: 'Have to buy something' },
  { value: 'unsure', label: 'Not sure' },
]

export const POWER_ACCESS_OPTIONS: ReviewChoice<PowerAccess>[] = [
  { value: 'easy', label: 'Easy to find' },
  { value: 'limited', label: 'Limited' },
  { value: 'scarce', label: 'Hard to get' },
]

export const NOISE_OPTIONS: ReviewChoice<NoiseLevel>[] = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'loud', label: 'Loud' },
]

export const STAY_OPTIONS: ReviewChoice<StayFit>[] = [
  { value: 'long', label: 'Good for 2+ hours' },
  { value: 'short', label: 'Better for a short stay' },
  { value: 'unsure', label: 'Not sure' },
]

export const BUSYNESS_LABELS: Record<BusynessLevel, string> = {
  quiet: 'Quiet right now',
  comfortable: 'Comfortably busy',
  busy: 'Busy right now',
  full: 'Full right now',
}

export function normalizeComment(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeDraft(draft: CafeReviewDraft): CafeReviewDraft {
  const wifiAvailable = draft.wifiAvailable
  const powerAvailable = draft.powerAvailable
  return {
    ...draft,
    wifiSpeed: wifiAvailable === 'yes' ? draft.wifiSpeed : null,
    wifiCap: wifiAvailable === 'yes' ? draft.wifiCap : null,
    powerAccess: powerAvailable === 'yes' ? draft.powerAccess : null,
    comment: draft.comment.slice(0, REVIEW_COMMENT_MAX),
  }
}

export function chapterIssue(chapter: ReviewChapter, draft: CafeReviewDraft): string | null {
  const next = normalizeDraft(draft)
  if (chapter === 1) {
    return next.busyness ? null : 'Pick how packed the cafe is right now.'
  }
  if (chapter === 2) {
    if (!next.wifiAvailable) return 'Tell us if you could get on WiFi.'
    if (next.wifiAvailable === 'yes' && !next.wifiSpeed) return 'How was the WiFi speed?'
    if (next.wifiAvailable === 'yes' && !next.wifiCap) return 'Was there a WiFi time limit?'
    return null
  }
  if (chapter === 3) {
    if (!next.powerAvailable) return 'Tell us if there were power sockets.'
    if (next.powerAvailable === 'yes' && !next.powerAccess) return 'Could you actually plug in?'
    return null
  }
  if (chapter === 4) {
    if (!next.servesMatcha) return 'Do they serve matcha?'
    if (!next.noise) return 'How loud was it?'
    if (!next.stayFit) return 'Could you work here a while?'
    return null
  }
  if (next.recommend == null) return 'Would you recommend this cafe?'
  if (next.visitAgain == null) return 'Would you come back?'
  if (normalizeComment(next.comment).length > REVIEW_COMMENT_MAX) {
    return `Keep suggestions under ${REVIEW_COMMENT_MAX} characters.`
  }
  return null
}

export function isChapterComplete(chapter: ReviewChapter, draft: CafeReviewDraft): boolean {
  return !chapterIssue(chapter, draft)
}

export function draftToReviewInsert(
  draft: CafeReviewDraft,
  shopId: string,
  userId: string,
): ShopReviewInsert {
  const next = normalizeDraft(draft)
  const issue = chapterIssue(5, next)
    ?? chapterIssue(4, next)
    ?? chapterIssue(3, next)
    ?? chapterIssue(2, next)
  if (issue || !next.wifiAvailable || !next.powerAvailable || !next.servesMatcha || !next.noise || !next.stayFit || next.recommend == null || next.visitAgain == null) {
    throw new Error(issue || 'Finish the review before submitting.')
  }

  const comment = normalizeComment(next.comment)
  return {
    shop_id: shopId,
    user_id: userId,
    wifi_available: next.wifiAvailable,
    wifi_speed: next.wifiSpeed,
    wifi_time_limit: next.wifiCap,
    power_available: next.powerAvailable,
    power_access: next.powerAccess,
    serves_matcha: next.servesMatcha,
    noise: next.noise,
    stay_fit: next.stayFit,
    recommend: next.recommend,
    visit_again: next.visitAgain,
    comment: comment || null,
  }
}

export function reviewRowToDraft(row: Pick<
  ShopReviewRow,
  | 'wifi_available'
  | 'wifi_speed'
  | 'wifi_time_limit'
  | 'power_available'
  | 'power_access'
  | 'serves_matcha'
  | 'noise'
  | 'stay_fit'
  | 'recommend'
  | 'visit_again'
  | 'comment'
>, busyness: BusynessLevel | null = null): CafeReviewDraft {
  return normalizeDraft({
    busyness,
    wifiAvailable: row.wifi_available,
    wifiSpeed: row.wifi_speed,
    wifiCap: row.wifi_time_limit,
    powerAvailable: row.power_available,
    powerAccess: row.power_access,
    servesMatcha: row.serves_matcha,
    noise: row.noise,
    stayFit: row.stay_fit,
    recommend: row.recommend,
    visitAgain: row.visit_again,
    comment: row.comment ?? '',
  })
}

export function isBusynessCooldown(
  lastReportedAt: string | Date | null | undefined,
  now: Date = new Date(),
  windowMs: number = BUSYNESS_COOLDOWN_MS,
): boolean {
  return cooldownRemainingMs(lastReportedAt, now, windowMs) > 0
}

export function cooldownRemainingMs(
  lastReportedAt: string | Date | null | undefined,
  now: Date = new Date(),
  windowMs: number = BUSYNESS_COOLDOWN_MS,
): number {
  if (!lastReportedAt) return 0
  const then = lastReportedAt instanceof Date ? lastReportedAt : new Date(lastReportedAt)
  if (Number.isNaN(then.getTime())) return 0
  return Math.max(0, then.getTime() + windowMs - now.getTime())
}

export function cooldownWaitCopy(remainingMs: number): string {
  if (remainingMs <= 0) return 'You can check in again now.'
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000))
  if (minutes === 1) return 'You can check in again in 1 minute.'
  return `You can check in again in ${minutes} minutes.`
}

export const CHECK_IN_AT_PREFIX = 'kapedoko-checkin-at:'

const checkInAtMemory = new Map<string, string>()

export function checkInAtStorageKey(userId: string, shopId: string): string {
  return `${CHECK_IN_AT_PREFIX}${userId}:${shopId}`
}

export function readCheckInAt(userId: string, shopId: string): string | null {
  if (!userId || !shopId) return null
  const key = checkInAtStorageKey(userId, shopId)
  const remembered = checkInAtMemory.get(key)
  if (remembered) return remembered
  if (!import.meta.client) return null
  try {
    const stored = window.localStorage.getItem(key)
    if (stored) checkInAtMemory.set(key, stored)
    return stored
  } catch {
    return null
  }
}

export function writeCheckInAt(userId: string, shopId: string, at: Date = new Date()): void {
  if (!userId || !shopId) return
  const key = checkInAtStorageKey(userId, shopId)
  const iso = at.toISOString()
  checkInAtMemory.set(key, iso)
  if (!import.meta.client) return
  try {
    window.localStorage.setItem(key, iso)
  } catch {
    /* private mode still keeps this visit in memory */
  }
}

export function isValidBusynessLevel(value: string | null | undefined): value is BusynessLevel {
  return BUSYNESS_LEVELS.includes(value as BusynessLevel)
}

export const BUSYNESS_METER_SEATS = 4

const BUSYNESS_METER_FILL: Record<BusynessLevel, number> = {
  quiet: 1,
  comfortable: 2,
  busy: 3,
  full: 4,
}

export function busynessMeterFill(level: BusynessLevel | null | undefined): number {
  if (!level || !isValidBusynessLevel(level)) return 0
  return BUSYNESS_METER_FILL[level]
}

export function queryString(value: unknown): string {
  if (Array.isArray(value)) return queryString(value[0])
  return typeof value === 'string' ? value : ''
}

export function parseBusynessLevelQuery(value: unknown): BusynessLevel | null {
  const raw = queryString(value)
  return isValidBusynessLevel(raw) ? raw : null
}

export function shouldSkipReviewBusyness(
  from: unknown,
  lastCheckInAt?: string | Date | null,
  now: Date = new Date(),
): boolean {
  return queryString(from) === 'check-in' || isBusynessCooldown(lastCheckInAt, now)
}

export function firstReviewChapter(
  from: unknown,
  lastCheckInAt?: string | Date | null,
  now: Date = new Date(),
): ReviewChapter {
  return shouldSkipReviewBusyness(from, lastCheckInAt, now) ? 2 : 1
}

export function checkInPath(shopId: string, level?: BusynessLevel | null): string {
  const base = `/app/cafes/${shopId}/check-in`
  return level ? `${base}?level=${level}` : base
}

export function monthCheckInCopy(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return ''
  const rounded = Math.trunc(count)
  return `${rounded} KapéBean${rounded === 1 ? '' : 's'} this month`
}

export function reviewQuote(row: Pick<ShopReviewPublicRow, 'comment' | 'wifi_available' | 'wifi_speed' | 'power_available' | 'power_access' | 'recommend'>): string {
  const comment = normalizeComment(row.comment ?? '')
  if (comment) return comment

  const bits: string[] = []
  if (row.wifi_available === 'yes') {
    bits.push(row.wifi_speed ? `WiFi felt ${row.wifi_speed}` : 'WiFi was available')
  } else if (row.wifi_available === 'no') {
    bits.push('No usable WiFi')
  }
  if (row.power_available === 'yes') {
    bits.push(row.power_access === 'easy' ? 'Outlets were easy to find' : 'Had power sockets')
  } else if (row.power_available === 'no') {
    bits.push('No power sockets')
  }
  if (row.recommend) bits.push('Would recommend')
  return bits.join('. ') || 'Shared a work-readiness check-in.'
}

export function mapPublicReview(row: ShopReviewPublicRow): CafeReview {
  return {
    id: row.id,
    name: row.author_name || 'KapéBean',
    quote: reviewQuote(row),
    wifiVotes: row.wifi_available === 'yes' ? 1 : 0,
    outletVotes: row.power_available === 'yes' ? 1 : 0,
  }
}

function wifiBody(speed: string | null | undefined, cap: string | null | undefined): string {
  const speedBit = speed === 'fast'
    ? 'with fast speed'
    : speed === 'slow'
      ? 'though it often feels slow'
      : speed === 'okay'
        ? 'with okay speed'
        : null
  const capBit = cap === 'voucher'
    ? 'A voucher or time cap comes up often.'
    : cap === 'purchase'
      ? 'You may need to buy something to get online.'
      : cap === 'unlimited'
        ? 'Most visits had uncapped WiFi.'
        : 'Internet speed may still vary.'
  if (speedBit) {
    return `WiFi connection is available in this coffee shop, ${speedBit}. ${capBit}`
  }
  return `WiFi connection is available in this coffee shop. ${capBit}`
}

function powerBody(mode: string | null | undefined): string {
  if (mode === 'easy') return 'You can use the power sockets in this coffee shop. Availability may still vary.'
  if (mode === 'scarce') return 'Sockets exist, but they are hard to get. Bring a charged laptop.'
  if (mode === 'limited') return 'You can use the power sockets in this coffee shop. Availability may still vary.'
  return 'You can use the power sockets in this coffee shop. Availability may still vary.'
}

export function wifiInsightFromStats(stats?: ShopReviewStatsRow | null): CafeInsight | undefined {
  if (!stats || stats.total_reviews < INSIGHT_MIN_REVIEWS) return undefined
  const yes = stats.wifi_yes_count ?? 0
  const pct = stats.wifi_available_pct ?? 0
  if (yes === 0 && (pct == null || pct < 50)) {
    if (pct == null && yes === 0) return undefined
    return {
      count: Math.max(stats.total_reviews - yes, 1),
      title: 'WiFi is unreliable here',
      body: 'Most KapéBeans said they could not get online.',
    }
  }
  if (yes === 0) return undefined
  return {
    count: yes,
    title: 'WiFi connection is available',
    body: wifiBody(stats.wifi_speed_mode, stats.wifi_time_limit_mode),
  }
}

export function plugInsightFromStats(stats?: ShopReviewStatsRow | null): CafeInsight | undefined {
  if (!stats || stats.total_reviews < INSIGHT_MIN_REVIEWS) return undefined
  const yes = stats.power_yes_count ?? 0
  const pct = stats.power_available_pct ?? 0
  if (yes === 0 && (pct == null || pct < 50)) {
    if (pct == null && yes === 0) return undefined
    return {
      count: Math.max(stats.total_reviews - yes, 1),
      title: 'Power sockets are scarce',
      body: 'Most KapéBeans could not plug in.',
    }
  }
  if (yes === 0) return undefined
  return {
    count: yes,
    title: 'Power sockets are available',
    body: powerBody(stats.power_access_mode),
  }
}

export function matchaInsightFromStats(stats?: ShopReviewStatsRow | null): CafeInsight | undefined {
  const pct = stats?.matcha_available_pct
  const count = stats?.matcha_yes_count ?? 0
  if (!stats || stats.total_reviews < INSIGHT_MIN_REVIEWS || pct == null) return undefined
  if (pct < 50) {
    return {
      count: Math.max(stats.total_reviews - count, 1),
      title: 'Matcha is uncommon here',
      body: 'Most KapéBeans did not see it on the menu.',
    }
  }
  if (count === 0) return undefined
  return {
    count: count || stats.total_reviews,
    title: 'They usually serve matcha',
    body: 'A majority of KapéBeans spotted it on the menu.',
  }
}

function modeOf(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

export function statsFromPublicReviews(rows: ShopReviewPublicRow[]): ShopReviewStatsRow | null {
  if (!rows.length) return null
  const wifiDecided = rows.filter((row) => row.wifi_available === 'yes' || row.wifi_available === 'no')
  const powerDecided = rows.filter((row) => row.power_available === 'yes' || row.power_available === 'no')
  const matchaDecided = rows.filter((row) => row.serves_matcha === 'yes' || row.serves_matcha === 'no')
  const wifiYes = rows.filter((row) => row.wifi_available === 'yes')
  const powerYes = rows.filter((row) => row.power_available === 'yes')
  const matchaYes = rows.filter((row) => row.serves_matcha === 'yes')
  const recommendYes = rows.filter((row) => row.recommend)
  return {
    shop_id: rows[0]?.shop_id ?? '',
    total_reviews: rows.length,
    wifi_yes_count: wifiYes.length,
    wifi_available_pct: wifiDecided.length
      ? Math.round((100 * wifiYes.length) / wifiDecided.length)
      : null,
    wifi_speed_mode: modeOf(wifiYes.map((row) => row.wifi_speed)),
    wifi_time_limit_mode: modeOf(wifiYes.map((row) => row.wifi_time_limit)),
    power_yes_count: powerYes.length,
    power_available_pct: powerDecided.length
      ? Math.round((100 * powerYes.length) / powerDecided.length)
      : null,
    power_access_mode: modeOf(powerYes.map((row) => row.power_access)),
    recommend_pct: Math.round((100 * recommendYes.length) / rows.length),
    matcha_yes_count: matchaYes.length,
    matcha_available_pct: matchaDecided.length
      ? Math.round((100 * matchaYes.length) / matchaDecided.length)
      : null,
  }
}

export function busynessLabel(level: BusynessLevel): string {
  return BUSYNESS_LABELS[level]
}

export function chapterLabel(chapter: ReviewChapter): string {
  if (chapter === 1) return '1 of 5 · Busy now'
  if (chapter === 2) return '2 of 5 · WiFi'
  if (chapter === 3) return '3 of 5 · Power'
  if (chapter === 4) return '4 of 5 · Cafe extras'
  return '5 of 5 · Verdict'
}
