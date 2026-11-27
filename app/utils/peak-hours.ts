/**
 * Hour-of-week grids in Manila time (Asia/Manila, UTC+8, no DST).
 * Rows are indexed [dow][hour] with dow 0 = Sunday (same as JavaScript getDay
 * and the shop_traffic_hourly RPC).
 */

export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
export const HOURLY_MIN_TOTAL = 10

export type HourlyGrid = {
  /** cells[dow][hour], 7 x 24. */
  cells: number[][]
  total: number
  max: number
  peak: { dow: number, hour: number, count: number } | null
}

export type CheckinHourlyRow = {
  shop_id: string
  /** ISO instant of the start of the UTC hour. */
  hour_start: string
  report_count: number
}

export type TrafficHourlyRow = {
  kind: string
  dow: number
  hour: number
  hits: number
}

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
/** Display order, Monday first. */
export const DOW_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export function emptyHourlyGrid(): HourlyGrid {
  return {
    cells: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    total: 0,
    max: 0,
    peak: null,
  }
}

function finishGrid(grid: HourlyGrid): HourlyGrid {
  let total = 0
  let max = 0
  let peak: HourlyGrid['peak'] = null
  for (let dow = 0; dow < 7; dow += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const count = grid.cells[dow]![hour]!
      total += count
      if (count > max) {
        max = count
        peak = { dow, hour, count }
      }
    }
  }
  grid.total = total
  grid.max = max
  grid.peak = peak
  return grid
}

/** Manila weekday (0 = Sunday) and hour (0-23) of an instant. */
export function manilaDowHour(instant: Date): { dow: number, hour: number } {
  const shifted = new Date(instant.getTime() + MANILA_OFFSET_MS)
  return { dow: shifted.getUTCDay(), hour: shifted.getUTCHours() }
}

/** Fold hourly check-in counts (UTC hour starts) into a Manila 7 x 24 grid. */
export function hourlyGrid(rows: CheckinHourlyRow[]): HourlyGrid {
  const grid = emptyHourlyGrid()
  for (const row of rows) {
    const time = Date.parse(row.hour_start)
    if (!Number.isFinite(time)) continue
    const count = Number(row.report_count)
    if (!Number.isFinite(count) || count <= 0) continue
    const { dow, hour } = manilaDowHour(new Date(time))
    grid.cells[dow]![hour]! += count
  }
  return finishGrid(grid)
}

/** Fold shop_traffic_hourly rows (already Manila time) into a grid for the given kinds. */
export function trafficHourlyGrid(rows: TrafficHourlyRow[], kinds: readonly string[]): HourlyGrid {
  const allowed = new Set(kinds)
  const grid = emptyHourlyGrid()
  for (const row of rows) {
    if (!allowed.has(row.kind)) continue
    if (!Number.isInteger(row.dow) || row.dow < 0 || row.dow > 6) continue
    if (!Number.isInteger(row.hour) || row.hour < 0 || row.hour > 23) continue
    if (!Number.isFinite(row.hits) || row.hits <= 0) continue
    grid.cells[row.dow]![row.hour]! += row.hits
  }
  return finishGrid(grid)
}

export function parseCheckinHourly(rows: unknown): CheckinHourlyRow[] {
  if (!Array.isArray(rows)) return []
  const out: CheckinHourlyRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const shopId = typeof item.shop_id === 'string' ? item.shop_id : ''
    const hourStart = typeof item.hour_start === 'string' ? item.hour_start : ''
    const count = typeof item.report_count === 'number' ? item.report_count : Number(item.report_count)
    if (!shopId || !hourStart || !Number.isFinite(count)) continue
    out.push({ shop_id: shopId, hour_start: hourStart, report_count: count })
  }
  return out
}

export function parseTrafficHourly(rows: unknown): TrafficHourlyRow[] {
  if (!Array.isArray(rows)) return []
  const out: TrafficHourlyRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const kind = typeof item.kind === 'string' ? item.kind : ''
    const dow = Number(item.dow)
    const hour = Number(item.hour)
    const hits = Number(item.hits)
    if (!kind || !Number.isFinite(dow) || !Number.isFinite(hour) || !Number.isFinite(hits)) continue
    out.push({ kind, dow, hour, hits })
  }
  return out
}

export function formatHourLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24
  const suffix = h < 12 ? 'AM' : 'PM'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve} ${suffix}`
}

/** "Saturday, 3 PM to 4 PM" */
export function describeSlot(dow: number, hour: number): string {
  return `${DOW_NAMES[dow] ?? ''}, ${formatHourLabel(hour)} to ${formatHourLabel(hour + 1)}`
}

/** Busiest slot, or null when the grid holds too little to say anything. */
export function busiestSlot(grid: HourlyGrid, minTotal = HOURLY_MIN_TOTAL): HourlyGrid['peak'] {
  return grid.total >= minTotal ? grid.peak : null
}

/** Heat level 0-4 for a cell, relative to the busiest cell. */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0
  const share = count / max
  if (share > 0.75) return 4
  if (share > 0.5) return 3
  if (share > 0.25) return 2
  return 1
}

/** Busiest slots first (ties break by earlier weekday Monday-first, then hour). */
export function topSlots(grid: HourlyGrid, limit = 5): Array<{ dow: number, hour: number, count: number }> {
  const slots: Array<{ dow: number, hour: number, count: number }> = []
  for (const dow of DOW_DISPLAY_ORDER) {
    for (let hour = 0; hour < 24; hour += 1) {
      const count = grid.cells[dow]![hour]!
      if (count > 0) slots.push({ dow, hour, count })
    }
  }
  return slots.sort((a, b) => b.count - a.count).slice(0, Math.max(0, limit))
}
