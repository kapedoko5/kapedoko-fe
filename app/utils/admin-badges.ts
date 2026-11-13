import {
  Award,
  BadgeCheck,
  Coffee,
  Crown,
  Flame,
  Gem,
  Gift,
  Heart,
  Leaf,
  MapPin,
  Medal,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { BadgeAwardRow, BadgeLucideId, CafeBadge } from '~/types/admin'

export const BADGE_LABEL_MAX = 40
export const BADGE_DEFAULT_COLOR = '#1F6F6B'
export const BADGE_DEFAULT_LUCIDE: BadgeLucideId = 'gem'
export const BADGE_ICON_MAX_BYTES = 2 * 1024 * 1024
export const BADGE_INK = '#1c1917'
export const BADGE_STOCK = '#FAF8F5'

const BADGE_ID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const BADGE_COLOR_RE = /^#[0-9A-Fa-f]{6}$/
const BADGE_ICON_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const BADGE_LUCIDE_ICONS: { id: BadgeLucideId; label: string; icon: Component }[] = [
  { id: 'gem', label: 'Gem', icon: Gem },
  { id: 'award', label: 'Award', icon: Award },
  { id: 'trophy', label: 'Trophy', icon: Trophy },
  { id: 'star', label: 'Star', icon: Star },
  { id: 'crown', label: 'Crown', icon: Crown },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'heart', label: 'Heart', icon: Heart },
  { id: 'flame', label: 'Flame', icon: Flame },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'leaf', label: 'Leaf', icon: Leaf },
  { id: 'map-pin', label: 'Map pin', icon: MapPin },
  { id: 'medal', label: 'Medal', icon: Medal },
  { id: 'badge-check', label: 'Badge check', icon: BadgeCheck },
  { id: 'gift', label: 'Gift', icon: Gift },
]

const LUCIDE_BY_ID = new Map(BADGE_LUCIDE_ICONS.map((item) => [item.id, item]))

export function isBadgeId(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length === 36 && BADGE_ID_RE.test(trimmed)
}

export function badgeIdFromRoute(path: string, param?: unknown): string {
  const fromParam = typeof param === 'string'
    ? param
    : Array.isArray(param)
      ? String(param[0] || '')
      : ''
  if (isBadgeId(fromParam)) return fromParam.trim()
  const match = `${fromParam} ${path}`.match(/\/badges\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  return match?.[1] && isBadgeId(match[1]) ? match[1] : ''
}

export function badgeSlugFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BADGE_LABEL_MAX)
  return slug
}

export function badgeLabelError(value: string): string | null {
  const label = value.trim().replace(/\s+/g, ' ')
  if (!label) return 'Enter a badge name.'
  if (label.length < 2) return 'Use at least 2 characters.'
  if (label.length > BADGE_LABEL_MAX) return `Keep the name under ${BADGE_LABEL_MAX} characters.`
  if (badgeSlugFromLabel(label).length < 2) return 'Use a badge name with letters or numbers.'
  return null
}

export function normalizeBadgeColor(value: string): string {
  const raw = value.trim()
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  if (!BADGE_COLOR_RE.test(hex)) return BADGE_DEFAULT_COLOR
  return hex.toUpperCase()
}

export function isBadgeColor(value: string): boolean {
  return BADGE_COLOR_RE.test(value.trim())
}

function srgbChannel(value: number): number {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const color = normalizeBadgeColor(hex).slice(1)
  const r = srgbChannel(Number.parseInt(color.slice(0, 2), 16))
  const g = srgbChannel(Number.parseInt(color.slice(2, 4), 16))
  const b = srgbChannel(Number.parseInt(color.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(first: number, second: number): number {
  const light = Math.max(first, second)
  const dark = Math.min(first, second)
  return (light + 0.05) / (dark + 0.05)
}

export function badgeInkOn(color: string): string {
  const fill = relativeLuminance(color)
  const ink = relativeLuminance(BADGE_INK)
  const stock = relativeLuminance(BADGE_STOCK)
  return contrastRatio(fill, ink) >= contrastRatio(fill, stock) ? BADGE_INK : BADGE_STOCK
}

export function isBadgeLucideId(value: string): value is BadgeLucideId {
  return LUCIDE_BY_ID.has(value as BadgeLucideId)
}

export function resolveBadgeLucideId(value: string | null | undefined): BadgeLucideId {
  const id = value?.trim() ?? ''
  return isBadgeLucideId(id) ? id : BADGE_DEFAULT_LUCIDE
}

export function badgeLucideComponent(value: string | null | undefined): Component {
  return LUCIDE_BY_ID.get(resolveBadgeLucideId(value))?.icon ?? Gem
}

export function searchBadgeLucideIcons(query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return BADGE_LUCIDE_ICONS
  return BADGE_LUCIDE_ICONS.filter((item) => item.id.includes(term) || item.label.toLowerCase().includes(term))
}

export function badgeIconFileError(file: File | null, required = false): string | null {
  if (!file) return required ? 'Upload a badge icon.' : null
  if (!BADGE_ICON_TYPES.has(file.type)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size > BADGE_ICON_MAX_BYTES) return 'Keep the icon under 2 MB.'
  return null
}

export function badgeAwardWindowError(startsAt: string, endsAt: string, now = new Date()): string | null {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return 'Choose a start and end time.'
  }
  if (end <= start) return 'Choose an end date after the start date.'
  if (end <= now) return 'Choose an end time in the future.'
  return null
}

export function isBadgeAwardActive(
  award: Pick<BadgeAwardRow, 'enabled' | 'cancelled_at' | 'starts_at' | 'ends_at'>,
  now = new Date(),
): boolean {
  if (award.enabled === false || award.cancelled_at) return false
  const start = new Date(award.starts_at).getTime()
  const end = new Date(award.ends_at).getTime()
  const at = now.getTime()
  return Number.isFinite(start) && Number.isFinite(end) && start <= at && end > at
}

export function badgeAwardLifecycle(
  award: Pick<BadgeAwardRow, 'enabled' | 'cancelled_at' | 'starts_at' | 'ends_at'>,
  now = new Date(),
): 'scheduled' | 'live' | 'ended' {
  if (award.cancelled_at || award.enabled === false) return 'ended'
  if (isBadgeAwardActive(award, now)) return 'live'
  if (new Date(award.starts_at).getTime() > now.getTime()) return 'scheduled'
  return 'ended'
}

export function badgeOverlapCopy(cafeName: string): string {
  return `This badge already covers ${cafeName} in that window.`
}

export function badgeAwardCafeCopy(names: string[], max = 2): string {
  const list = names.map((name) => name.trim()).filter(Boolean)
  if (list.length === 0) return 'No cafes'
  if (list.length <= max) return list.join(', ')
  return `${list.slice(0, max).join(', ')} +${list.length - max}`
}

export function cafeBadgeFromName(
  badge: {
    id: string
    slug: string
    label: string
    color: string
    lucide_icon: string
    iconUrl?: string | null
  },
): CafeBadge {
  return {
    id: badge.id,
    slug: badge.slug,
    label: badge.label,
    color: normalizeBadgeColor(badge.color),
    lucideIcon: resolveBadgeLucideId(badge.lucide_icon),
    iconUrl: badge.iconUrl?.trim() || null,
  }
}
