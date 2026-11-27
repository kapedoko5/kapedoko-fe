/** Daily vibe pick: kept on the device, valid for one local calendar day. */

export const VIBE_DAY_KEY = 'kapedoko:vibe-day'

export interface VibeDayPick {
  day: string
  tagIds: string[]
}

/** Local calendar day as YYYY-MM-DD. */
export function localDayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Parse a stored pick. Anything stale, malformed or empty yields no tags. */
export function parseVibeDayPick(raw: string | null | undefined, today: string = localDayKey()): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<VibeDayPick> | null
    if (!parsed || parsed.day !== today || !Array.isArray(parsed.tagIds)) return []
    return [...new Set(parsed.tagIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  } catch {
    return []
  }
}

export function serializeVibeDayPick(tagIds: string[], today: string = localDayKey()): string {
  return JSON.stringify({ day: today, tagIds } satisfies VibeDayPick)
}

/** Keep only ids that still exist in the enabled catalog. */
export function pruneVibeIds(ids: string[], knownIds: Iterable<string>): string[] {
  const known = new Set(knownIds)
  return ids.filter((id) => known.has(id))
}

/** A cafe matches when it carries at least one picked vibe. No pick matches all. */
export function cafeHasAnyVibe(cafeTagIds: string[], picked: string[]): boolean {
  if (!picked.length) return true
  return cafeTagIds.some((id) => picked.includes(id))
}
