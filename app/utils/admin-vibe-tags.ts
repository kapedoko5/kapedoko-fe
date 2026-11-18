import {
  BookOpen,
  Camera,
  Cat,
  Coffee,
  Flame,
  Headphones,
  Heart,
  Lamp,
  Landmark,
  Leaf,
  Moon,
  Music,
  Palmtree,
  Sofa,
  Sparkles,
  Sun,
  Users,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { CafeVibeTag, VibeTagLucideId, VibeTagNameRow } from '~/types/admin'

export const VIBE_TAG_LABEL_MAX = 40
export const VIBE_TAG_MAX = 5
export const VIBE_TAG_DEFAULT_LUCIDE: VibeTagLucideId = 'coffee'
export const VIBE_TAG_DEFAULT_COLOR = '#D9793B'

const VIBE_TAG_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

const VIBE_TAG_ID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export const VIBE_TAG_LUCIDE_ICONS: { id: VibeTagLucideId; label: string; icon: Component }[] = [
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'leaf', label: 'Leaf', icon: Leaf },
  { id: 'heart', label: 'Heart', icon: Heart },
  { id: 'flame', label: 'Flame', icon: Flame },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'sun', label: 'Sun', icon: Sun },
  { id: 'moon', label: 'Moon', icon: Moon },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'headphones', label: 'Headphones', icon: Headphones },
  { id: 'book-open', label: 'Book', icon: BookOpen },
  { id: 'users', label: 'People', icon: Users },
  { id: 'volume-x', label: 'Quiet', icon: VolumeX },
  { id: 'volume-2', label: 'Loud', icon: Volume2 },
  { id: 'lamp', label: 'Lamp', icon: Lamp },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'wind', label: 'Breeze', icon: Wind },
  { id: 'cat', label: 'Cat', icon: Cat },
  { id: 'sofa', label: 'Sofa', icon: Sofa },
  { id: 'palmtree', label: 'Palm', icon: Palmtree },
  { id: 'landmark', label: 'Landmark', icon: Landmark },
]

const LUCIDE_BY_ID = new Map(VIBE_TAG_LUCIDE_ICONS.map((item) => [item.id, item]))

export function isVibeTagId(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length === 36 && VIBE_TAG_ID_RE.test(trimmed)
}

export function vibeTagIdFromRoute(path: string, param?: unknown): string {
  const fromParam = typeof param === 'string'
    ? param
    : Array.isArray(param)
      ? String(param[0] || '')
      : ''
  if (isVibeTagId(fromParam)) return fromParam.trim()
  const match = `${fromParam} ${path}`.match(/\/vibe-tags\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  return match?.[1] && isVibeTagId(match[1]) ? match[1] : ''
}

export function vibeTagSlugFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, VIBE_TAG_LABEL_MAX)
}

export function vibeTagLabelError(value: string): string | null {
  const label = value.trim().replace(/\s+/g, ' ')
  if (!label) return 'Enter a vibe tag name.'
  if (label.length < 2) return 'Use at least 2 characters.'
  if (label.length > VIBE_TAG_LABEL_MAX) return `Keep the name under ${VIBE_TAG_LABEL_MAX} characters.`
  if (vibeTagSlugFromLabel(label).length < 2) return 'Use a vibe tag with letters or numbers.'
  return null
}

export function isVibeTagLucideId(value: string): value is VibeTagLucideId {
  return LUCIDE_BY_ID.has(value as VibeTagLucideId)
}

export function resolveVibeTagLucideId(value: string | null | undefined): VibeTagLucideId {
  const id = value?.trim() ?? ''
  return isVibeTagLucideId(id) ? id : VIBE_TAG_DEFAULT_LUCIDE
}

export function vibeTagLucideComponent(value: string | null | undefined): Component {
  return LUCIDE_BY_ID.get(resolveVibeTagLucideId(value))?.icon ?? Coffee
}

export function isVibeTagColor(value: string): boolean {
  return VIBE_TAG_COLOR_RE.test(value.trim())
}

export function normalizeVibeTagColor(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  if (!VIBE_TAG_COLOR_RE.test(hex)) return VIBE_TAG_DEFAULT_COLOR
  return hex.toUpperCase()
}

export function vibeTagColorStyle(color: string | null | undefined): { '--vibe-color': string } {
  return { '--vibe-color': normalizeVibeTagColor(color) }
}

export function searchVibeTagLucideIcons(query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return VIBE_TAG_LUCIDE_ICONS
  return VIBE_TAG_LUCIDE_ICONS.filter((item) => item.id.includes(term) || item.label.toLowerCase().includes(term))
}

export function cafeVibeTagFromName(tag: {
  id: string
  slug: string
  label: string
  lucide_icon: string
  color?: string | null
}): CafeVibeTag {
  return {
    id: tag.id,
    slug: tag.slug,
    label: tag.label,
    lucideIcon: resolveVibeTagLucideId(tag.lucide_icon),
    color: normalizeVibeTagColor(tag.color),
  }
}

export function vibeTagCountError(count: number, hidden = 0): string | null {
  if (count < 0) return 'Choose vibe tags to keep.'
  if (count + hidden > VIBE_TAG_MAX) {
    return hidden > 0
      ? `Keep vibe tags to ${VIBE_TAG_MAX}. ${hidden} disabled stamp${hidden === 1 ? '' : 's'} still count.`
      : `Keep vibe tags to ${VIBE_TAG_MAX}.`
  }
  return null
}

export function vibeTagPickerCount(selected: number, hidden = 0): string {
  return `${selected + hidden} of ${VIBE_TAG_MAX}`
}

export function enabledVibeTags(rows: VibeTagNameRow[]): VibeTagNameRow[] {
  return rows.filter((row) => row.enabled).sort((a, b) => a.label.localeCompare(b.label))
}
