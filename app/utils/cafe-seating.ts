import type { CafeSeating } from '../types/cafe'

export interface ShopSeatingRow {
  shop_id: string
  seating_capacity: number | string | null
  source?: string | null
  source_at: string | null
}

export function seatingFromRow(row?: ShopSeatingRow | null): CafeSeating | null {
  if (row?.seating_capacity == null || row.seating_capacity === '') return null
  const count = Number(row.seating_capacity)
  if (!Number.isFinite(count) || count < 0) return null
  return {
    count: Math.round(count),
    source: row.source === 'owner' ? 'owner' : 'team',
    sourceAt: row.source_at ?? null,
  }
}

export function seatingPressLabel(seating?: CafeSeating | null): string | null {
  if (!seating) return null
  const noun = seating.count === 1 ? 'seat' : 'seats'
  return `Approx. ${seating.count} ${noun}`
}

export function seatingBagValue(seating?: CafeSeating | null): string | null {
  if (!seating) return null
  return `Approx. ${seating.count}`
}

export function seatingBagAria(seating?: CafeSeating | null): string {
  const label = seatingPressLabel(seating)
  return label ? `Seats, ${label}` : 'Seats'
}

export function seatingDateLabel(seating?: CafeSeating | null): string | null {
  if (!seating?.sourceAt) return null
  const date = new Date(seating.sourceAt)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}

export function seatingStamp(seating?: CafeSeating | null): 'team' | 'owner' | null {
  if (!seating) return null
  return seating.source
}
