import type { CafeInsight } from '../types/cafe'
import type {
  AmenityAvailability,
  AmenityConfidence,
  CafeAmenityStatus,
  CafeWorkFacts,
  PowerAccess,
  WifiSpeed,
  WifiTimeLimit,
} from '../types/shop'

export type AmenityKey = 'wifi' | 'outlets' | 'long_stay_wifi'
export type AmenityVote = 'yes' | 'no' | 'unsure'
export type { AmenityAvailability, AmenityConfidence, CafeAmenityStatus }

export interface AmenityResolutionConfig {
  enabled: boolean
  communityMinDecided: number
  communityMajorityRatio: number
  contradictionMinDecided: number
  contradictionWindowDays: number
  staleAfterDays: number
  fastDownloadMbps: number
}

export const DEFAULT_AMENITY_CONFIG: AmenityResolutionConfig = {
  enabled: true,
  communityMinDecided: 3,
  communityMajorityRatio: 0.5,
  contradictionMinDecided: 3,
  contradictionWindowDays: 90,
  staleAfterDays: 180,
  fastDownloadMbps: 25,
}

export interface ShopAmenityResolutionRow {
  shop_id: string
  amenity_key: AmenityKey | string
  availability: AmenityAvailability | string
  confidence: AmenityConfidence | string
  source_at: string | null
  decided_count: number
  yes_count: number
  no_count: number
  is_stale: boolean | null
  needs_recheck: boolean | null
  wifi_speed?: string | null
  wifi_time_limit?: string | null
  outlet_reliability?: string | null
}

export interface AmenityVoteInput {
  vote: AmenityVote
  votedAt: string
}

export interface AmenityAuditInput {
  result: 'available' | 'unavailable' | 'unknown'
  auditedAt: string
  wifiDownloadMbps?: number | null
  outletReliability?: PowerAccess | null
  longStayStance?: 'welcome' | 'discouraged' | 'unknown'
}

export interface AmenitySeedInput {
  result: 'available' | 'unavailable'
  observedAt: string
}

export interface AmenityOwnerProofInput {
  reviewedAt: string
  wifiDownloadMbps?: number | null
}

/** Test mirror of shop_amenity_resolutions. Postgres remains the source of truth. */
export function resolveAmenity(input: {
  audit?: AmenityAuditInput | null
  owner?: AmenityOwnerProofInput | null
  votes?: AmenityVoteInput[]
  seed?: AmenitySeedInput | null
  now?: Date
  config?: Partial<AmenityResolutionConfig>
}): CafeAmenityStatus {
  const config = { ...DEFAULT_AMENITY_CONFIG, ...input.config }
  const now = input.now ?? new Date()
  const unknown = unknownAmenityStatus()
  if (!config.enabled) return unknown

  const votes = (input.votes ?? []).filter((vote) => vote.vote === 'yes' || vote.vote === 'no')
  const yesCount = votes.filter((vote) => vote.vote === 'yes').length
  const noCount = votes.filter((vote) => vote.vote === 'no').length
  const decidedCount = yesCount + noCount
  const lastVotedAt = votes.reduce<string | null>((latest, vote) => {
    if (!latest || vote.votedAt > latest) return vote.votedAt
    return latest
  }, null)

  const audit = input.audit
  const owner = input.owner
  const auditDecided = Boolean(audit && (audit.result === 'available' || audit.result === 'unavailable'))
  const ownerWins = Boolean(
    owner
    && (!auditDecided || owner.reviewedAt > (audit?.auditedAt ?? '')),
  )
  if (owner && ownerWins) {
    const reviewedAt = new Date(owner.reviewedAt)
    const staleMs = config.staleAfterDays * 24 * 60 * 60 * 1000
    return {
      availability: 'available',
      confidence: 'owner_verified',
      sourceAt: owner.reviewedAt,
      isStale: now.getTime() - reviewedAt.getTime() > staleMs,
      needsRecheck: false,
      decidedCount,
      yesCount,
      noCount,
      wifiSpeed: speedFromMbps(owner.wifiDownloadMbps, config.fastDownloadMbps),
      wifiTimeLimit: null,
      outletReliability: null,
    }
  }
  if (audit && (audit.result === 'available' || audit.result === 'unavailable')) {
    const auditedAt = new Date(audit.auditedAt)
    const staleMs = config.staleAfterDays * 24 * 60 * 60 * 1000
    const windowMs = config.contradictionWindowDays * 24 * 60 * 60 * 1000
    const recent = votes.filter((vote) => {
      const at = new Date(vote.votedAt).getTime()
      return at > auditedAt.getTime() && at >= now.getTime() - windowMs
    })
    const recentYes = recent.filter((vote) => vote.vote === 'yes').length
    const recentNo = recent.filter((vote) => vote.vote === 'no').length
    const recentDecided = recentYes + recentNo
    const opposite = audit.result === 'available' ? recentNo : recentYes
    const needsRecheck = recentDecided >= config.contradictionMinDecided
      && recentDecided > 0
      && opposite / recentDecided > config.communityMajorityRatio

    return {
      availability: audit.result,
      confidence: 'team_verified',
      sourceAt: audit.auditedAt,
      isStale: now.getTime() - auditedAt.getTime() > staleMs,
      needsRecheck,
      decidedCount,
      yesCount,
      noCount,
      wifiSpeed: speedFromMbps(audit.wifiDownloadMbps, config.fastDownloadMbps),
      wifiTimeLimit: audit.result === 'available' && audit.longStayStance === 'welcome' ? 'unlimited' : null,
      outletReliability: audit.result === 'available' ? audit.outletReliability ?? null : null,
    }
  }

  const communitySide = majoritySide(yesCount, noCount, config.communityMajorityRatio)
  if (communitySide) {
    const confidence: AmenityConfidence = decidedCount >= config.communityMinDecided
      ? 'community_confirmed'
      : 'reported'
    return {
      availability: communitySide,
      confidence,
      sourceAt: lastVotedAt,
      isStale: false,
      needsRecheck: false,
      decidedCount,
      yesCount,
      noCount,
      wifiSpeed: null,
      wifiTimeLimit: null,
      outletReliability: null,
    }
  }

  if (input.seed) {
    return {
      availability: input.seed.result,
      confidence: 'reported',
      sourceAt: input.seed.observedAt,
      isStale: false,
      needsRecheck: false,
      decidedCount: 0,
      yesCount: 0,
      noCount: 0,
      wifiSpeed: null,
      wifiTimeLimit: null,
      outletReliability: null,
    }
  }

  return unknown
}

export function unknownAmenityStatus(): CafeAmenityStatus {
  return {
    availability: 'unknown',
    confidence: 'unknown',
    sourceAt: null,
    isStale: false,
    needsRecheck: false,
    decidedCount: 0,
    yesCount: 0,
    noCount: 0,
    wifiSpeed: null,
    wifiTimeLimit: null,
    outletReliability: null,
  }
}

export function statusFromResolutionRow(row?: ShopAmenityResolutionRow | null): CafeAmenityStatus {
  if (!row) return unknownAmenityStatus()
  return {
    availability: asAvailability(row.availability),
    confidence: asConfidence(row.confidence),
    sourceAt: row.source_at,
    isStale: Boolean(row.is_stale),
    needsRecheck: Boolean(row.needs_recheck),
    decidedCount: row.decided_count ?? 0,
    yesCount: row.yes_count ?? 0,
    noCount: row.no_count ?? 0,
    wifiSpeed: asWifiSpeed(row.wifi_speed),
    wifiTimeLimit: asWifiCap(row.wifi_time_limit),
    outletReliability: asPowerAccess(row.outlet_reliability),
  }
}

export function workFactsFromResolutions(rows?: ShopAmenityResolutionRow[] | null): CafeWorkFacts {
  const byKey = new Map((rows ?? []).map((row) => [row.amenity_key, row]))
  return workFactsFromStatuses(
    statusFromResolutionRow(byKey.get('wifi')),
    statusFromResolutionRow(byKey.get('outlets')),
    statusFromResolutionRow(byKey.get('long_stay_wifi')),
  )
}

/** Client-side audit queue: needs-recheck first, then stale oldest-first. */
export function auditQueueRows<T extends {
  needs_recheck?: boolean | null
  is_stale?: boolean | null
  source_at?: string | null
}>(rows: T[]): T[] {
  return [...rows]
    .filter((row) => Boolean(row.needs_recheck) || Boolean(row.is_stale))
    .sort(
      (a, b) =>
        Number(Boolean(b.needs_recheck)) - Number(Boolean(a.needs_recheck))
        || String(a.source_at ?? '').localeCompare(String(b.source_at ?? '')),
    )
}

export function workFactsFromStatuses(
  wifiStatus: CafeAmenityStatus,
  outletsStatus: CafeAmenityStatus,
  longStayWifiStatus: CafeAmenityStatus,
): CafeWorkFacts {
  const wifi = trustedBoolean(wifiStatus)
  const plug = trustedBoolean(outletsStatus)
  return {
    known: wifiStatus.availability !== 'unknown' || outletsStatus.availability !== 'unknown',
    wifi,
    plug,
    longStay: trustedBoolean(longStayWifiStatus),
    wifiSpeed: wifi === true ? wifiStatus.wifiSpeed : null,
    wifiTimeLimit: wifi === true ? wifiStatus.wifiTimeLimit : null,
    outletReliability: plug === true ? outletsStatus.outletReliability : null,
    wifiStatus,
    outletsStatus,
    longStayWifiStatus,
  }
}

export function statusesFromLegacyWork(work: Omit<CafeWorkFacts, 'wifiStatus' | 'outletsStatus' | 'longStayWifiStatus'>): {
  wifiStatus: CafeAmenityStatus
  outletsStatus: CafeAmenityStatus
  longStayWifiStatus: CafeAmenityStatus
} {
  return {
    wifiStatus: legacyStatus(work.known, work.wifi, { wifiSpeed: work.wifiSpeed, wifiTimeLimit: work.wifiTimeLimit }),
    outletsStatus: legacyStatus(work.known, work.plug, { outletReliability: work.outletReliability }),
    longStayWifiStatus: legacyStatus(work.known, work.longStay, {}),
  }
}

export function trustedPositive(status: CafeAmenityStatus): boolean {
  return status.availability === 'available'
    && (
      status.confidence === 'team_verified'
      || status.confidence === 'owner_verified'
      || status.confidence === 'community_confirmed'
    )
    && !status.needsRecheck
}

export function trustedNegative(status: CafeAmenityStatus): boolean {
  return status.availability === 'unavailable'
    && (
      status.confidence === 'team_verified'
      || status.confidence === 'owner_verified'
      || status.confidence === 'community_confirmed'
    )
    && !status.needsRecheck
}

export function amenityCardLabel(kind: 'wifi' | 'outlets', status: CafeAmenityStatus): string {
  if (status.needsRecheck) return 'Needs recheck'
  if (status.availability === 'mixed') return 'Mixed reports'
  if (status.availability === 'unknown' || status.confidence === 'unknown') return 'Unknown'
  if (status.confidence === 'reported') {
    if (status.availability === 'unavailable') {
      return kind === 'wifi' ? 'Reported: no WiFi' : 'Reported: no outlets'
    }
    return 'Reported'
  }
  if (status.availability === 'unavailable') {
    return kind === 'wifi' ? 'No WiFi' : 'No outlets'
  }
  if (status.confidence === 'team_verified' || status.confidence === 'owner_verified') return 'Verified'
  return 'KapéBeans'
}

export function amenityPressLabel(kind: 'wifi' | 'outlets', status: CafeAmenityStatus): string {
  if (status.needsRecheck) return 'Needs a recheck'
  if (status.availability === 'mixed') return 'Still mixed'
  if (status.availability === 'unknown' || status.confidence === 'unknown') return 'Not sure yet'
  if (status.confidence === 'reported') {
    return status.availability === 'unavailable'
      ? (kind === 'wifi' ? 'Early: no WiFi' : 'Early: no outlets')
      : 'Early word'
  }
  if (status.availability === 'unavailable') {
    return kind === 'wifi' ? 'No WiFi' : 'No outlets'
  }
  if (status.confidence === 'team_verified' || status.confidence === 'owner_verified') return 'Verified'
  return 'KapéBeans'
}

export function amenityDateLabel(status: CafeAmenityStatus): string | null {
  if (
    (status.confidence !== 'team_verified' && status.confidence !== 'owner_verified')
    || !status.sourceAt
  ) return null
  const date = formatAmenityDate(status.sourceAt)
  if (!date) return null
  return status.isStale ? `Last verified ${date}` : date
}

export type AmenityStampKind = 'team' | 'owner' | 'community' | 'reported' | 'recheck' | 'mixed' | 'unknown'

export function amenityStampKind(status: CafeAmenityStatus): AmenityStampKind {
  if (status.needsRecheck) return 'recheck'
  if (status.availability === 'mixed') return 'mixed'
  if (status.confidence === 'team_verified') return 'team'
  if (status.confidence === 'owner_verified') return 'owner'
  if (status.confidence === 'community_confirmed') return 'community'
  if (status.confidence === 'reported') return 'reported'
  return 'unknown'
}

export function amenityEvidenceLabel(status: CafeAmenityStatus): string | null {
  if (status.needsRecheck || status.confidence === 'team_verified' || status.confidence === 'owner_verified') return null
  if (status.availability === 'mixed' && status.decidedCount > 0) {
    return `${status.yesCount} yes · ${status.noCount} no`
  }
  if (
    status.decidedCount > 0
    && (status.confidence === 'community_confirmed' || status.confidence === 'reported')
  ) {
    return status.decidedCount === 1 ? '1 KapéBean' : `${status.decidedCount} KapéBeans`
  }
  return null
}

export function amenityFactMeta(status: CafeAmenityStatus): string | null {
  const parts = [amenityDateLabel(status), amenityEvidenceLabel(status)].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function amenityBagValue(kind: 'wifi' | 'outlets', status: CafeAmenityStatus): string {
  if (status.needsRecheck) return 'Needs recheck'
  if (status.availability === 'mixed') return 'Mixed'
  if (status.availability === 'unknown' || status.confidence === 'unknown') return 'Unknown'
  if (status.confidence === 'reported') {
    return status.availability === 'unavailable' ? 'Maybe no' : 'Maybe'
  }
  if (status.availability === 'unavailable') return 'No'
  return 'Yes'
}

export function amenityBagPress(
  wifi?: CafeAmenityStatus | null,
  outlets?: CafeAmenityStatus | null,
): string | null {
  const rows = [wifi, outlets].filter((row): row is CafeAmenityStatus => Boolean(row))
  const verified = rows.filter((row) => {
    const stamp = amenityStampKind(row)
    return stamp === 'team' || stamp === 'owner'
  })
  if (verified.length) {
    const dates = [...new Set(verified.map((row) => amenityDateLabel(row)).filter(Boolean))]
    return ['Verified', dates[0] ?? null].filter(Boolean).join(' · ')
  }
  if (rows.some((row) => amenityStampKind(row) === 'community')) return 'KapéBeans'
  return null
}

export function amenityAriaLabel(kind: 'wifi' | 'outlets', status: CafeAmenityStatus): string {
  const noun = kind === 'wifi' ? 'WiFi' : 'Outlets'
  return [noun, amenityBagValue(kind, status), amenityPressLabel(kind, status), amenityFactMeta(status)]
    .filter((part, index, all) => Boolean(part) && all.indexOf(part) === index)
    .join(', ')
}

export function amenitySoft(status: CafeAmenityStatus): boolean {
  return status.isStale || status.confidence === 'reported' || status.availability === 'unknown'
}

export function amenityGapCopyFromStatus(wifi: CafeAmenityStatus, outlets: CafeAmenityStatus): string | null {
  if (wifi.availability === 'unknown' && outlets.availability === 'unknown') {
    return 'WiFi and outlets unknown'
  }
  if (trustedNegative(wifi) && trustedNegative(outlets)) {
    return 'No WiFi or power outlets'
  }
  return null
}

export function amenityInsight(kind: 'wifi' | 'outlets', status: CafeAmenityStatus): CafeInsight | undefined {
  if (status.availability === 'unknown' && status.confidence === 'unknown') return undefined
  const count = Math.max(status.yesCount, status.noCount, status.decidedCount, 1)
  if (status.needsRecheck) {
    return {
      count,
      title: kind === 'wifi'
        ? 'Team verified, recent reviews disagree'
        : 'Team verified, recent reviews disagree',
      body: status.isStale
        ? `Last verified ${formatAmenityDate(status.sourceAt) ?? 'earlier'}. We keep the audit until a staff visit.`
        : 'We still show the on-site audit until a staff member rechecks.',
    }
  }
  if (status.availability === 'mixed') {
    return {
      count,
      title: 'Mixed reports',
      body: kind === 'wifi'
        ? 'KapéBeans do not agree on WiFi here yet.'
        : 'KapéBeans do not agree on outlets here yet.',
    }
  }
  if (status.confidence === 'reported') {
    return {
      count,
      title: status.availability === 'available'
        ? (kind === 'wifi' ? 'WiFi reported, not yet confirmed' : 'Outlets reported, not yet confirmed')
        : (kind === 'wifi' ? 'No WiFi reported, not yet confirmed' : 'No outlets reported, not yet confirmed'),
      body: 'This is an early signal. It is not community-confirmed or team-verified.',
    }
  }
  if (status.confidence === 'team_verified' || status.confidence === 'owner_verified') {
    const date = formatAmenityDate(status.sourceAt)
    return {
      count,
      title: status.availability === 'available'
        ? (kind === 'wifi' ? 'WiFi connection is available' : 'Power sockets are available')
        : (kind === 'wifi' ? 'No WiFi on this visit' : 'No outlets on this visit'),
      body: status.isStale
        ? `Last verified ${date ?? 'earlier'}. Amenities can change.`
        : date
          ? `Verified ${date}.`
          : 'Verified.',
    }
  }
  if (status.availability === 'unavailable') {
    return {
      count: Math.max(status.noCount, 1),
      title: kind === 'wifi' ? 'WiFi is unreliable here' : 'Power sockets are scarce',
      body: kind === 'wifi'
        ? 'Most KapéBeans said they could not get online.'
        : 'Most KapéBeans could not plug in.',
    }
  }
  if (status.availability === 'available') {
    return {
      count: Math.max(status.yesCount, 1),
      title: kind === 'wifi' ? 'WiFi connection is available' : 'Power sockets are available',
      body: kind === 'wifi'
        ? 'A majority of KapéBeans got online here.'
        : 'A majority of KapéBeans found a socket.',
    }
  }
  return undefined
}

export function formatAmenityDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}

export function amenityFilterHint(filter: string): string | null {
  if (filter === 'wifi' || filter === 'plugs' || filter === 'long-stay' || filter === 'fast-wifi' || filter === 'reliable-outlets') {
    return 'Filters include team-verified, owner-verified, and community-confirmed cafes.'
  }
  return null
}

function majoritySide(yesCount: number, noCount: number, ratio: number): AmenityAvailability | null {
  const decided = yesCount + noCount
  if (decided <= 0) return null
  if (yesCount / decided > ratio) return 'available'
  if (noCount / decided > ratio) return 'unavailable'
  return 'mixed'
}

function trustedBoolean(status: CafeAmenityStatus): boolean | null {
  if (trustedPositive(status)) return true
  if (trustedNegative(status)) return false
  return null
}

function speedFromMbps(mbps: number | null | undefined, fast: number): WifiSpeed | null {
  if (mbps == null || !Number.isFinite(mbps)) return null
  if (mbps >= fast) return 'fast'
  if (mbps >= 10) return 'okay'
  return 'slow'
}

function legacyStatus(
  known: boolean,
  value: boolean | null,
  extras: Partial<Pick<CafeAmenityStatus, 'wifiSpeed' | 'wifiTimeLimit' | 'outletReliability'>>,
): CafeAmenityStatus {
  if (!known || value == null) return unknownAmenityStatus()
  return {
    availability: value ? 'available' : 'unavailable',
    confidence: 'community_confirmed',
    sourceAt: null,
    isStale: false,
    needsRecheck: false,
    decidedCount: 3,
    yesCount: value ? 3 : 0,
    noCount: value ? 0 : 3,
    wifiSpeed: extras.wifiSpeed ?? null,
    wifiTimeLimit: extras.wifiTimeLimit ?? null,
    outletReliability: extras.outletReliability ?? null,
  }
}

function asAvailability(value: string | null | undefined): AmenityAvailability {
  if (value === 'available' || value === 'unavailable' || value === 'mixed' || value === 'unknown') return value
  return 'unknown'
}

function asConfidence(value: string | null | undefined): AmenityConfidence {
  if (
    value === 'team_verified'
    || value === 'owner_verified'
    || value === 'community_confirmed'
    || value === 'reported'
    || value === 'unknown'
  ) {
    return value
  }
  return 'unknown'
}

function asWifiSpeed(value: string | null | undefined): WifiSpeed | null {
  if (value === 'slow' || value === 'okay' || value === 'fast') return value
  return null
}

function asWifiCap(value: string | null | undefined): WifiTimeLimit | null {
  if (value === 'unlimited' || value === 'voucher' || value === 'purchase' || value === 'unsure') return value
  return null
}

function asPowerAccess(value: string | null | undefined): PowerAccess | null {
  if (value === 'easy' || value === 'limited' || value === 'scarce') return value
  return null
}
