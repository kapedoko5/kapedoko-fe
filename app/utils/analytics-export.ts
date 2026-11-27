import {
  shopTrafficKindLabel,
  shopTrafficSurfaceLabel,
  type ShopTrafficDailyRow,
  type ShopTrafficName,
} from './shop-traffic'

/** Escape one CSV field. Also defuses spreadsheet formulas (=, +, -, @). */
export function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [headers, ...rows].map((line) => line.map(csvEscape).join(','))
  return `${lines.join('\r\n')}\r\n`
}

export function dailyRowsToCsv(rows: ShopTrafficDailyRow[], names: ShopTrafficName[]): string {
  const nameById = new Map(names.map((shop) => [shop.id, shop.name]))
  const sorted = [...rows].sort((a, b) =>
    a.day.localeCompare(b.day)
    || a.shop_id.localeCompare(b.shop_id)
    || a.surface.localeCompare(b.surface)
    || a.kind.localeCompare(b.kind))
  return buildCsv(
    ['Day', 'Cafe', 'Where', 'What', 'Count'],
    sorted.map((row) => [
      row.day,
      nameById.get(row.shop_id) ?? 'Unknown cafe',
      shopTrafficSurfaceLabel(row.surface),
      shopTrafficKindLabel(row.kind),
      row.hits,
    ]),
  )
}

export function analyticsCsvFilename(scope: string, days: number, today: string): string {
  const slug = scope.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cafes'
  return `kapedoko-analytics-${slug}-${days}d-${today}.csv`
}

/** Browser-only download. Callers hide the control on native (Capacitor). */
export function downloadCsv(filename: string, csv: string) {
  if (typeof document === 'undefined') return
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
