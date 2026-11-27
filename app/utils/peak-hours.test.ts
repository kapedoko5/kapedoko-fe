import { describe, expect, test } from 'bun:test'
import {
  busiestSlot,
  describeSlot,
  formatHourLabel,
  heatLevel,
  hourlyGrid,
  manilaDowHour,
  parseCheckinHourly,
  topSlots,
  trafficHourlyGrid,
} from './peak-hours'

describe('Manila hourly grid', () => {
  test('is always 7 x 24', () => {
    const grid = hourlyGrid([])
    expect(grid.cells).toHaveLength(7)
    expect(grid.cells.every((day) => day.length === 24)).toBe(true)
    expect(grid.total).toBe(0)
    expect(grid.peak).toBeNull()
  })

  test('shifts UTC hours by +8 and rolls the weekday across midnight', () => {
    // 2026-11-20 is a Friday. 17:00Z is 01:00 Saturday in Manila.
    expect(manilaDowHour(new Date('2026-11-20T17:00:00Z'))).toEqual({ dow: 6, hour: 1 })
    // 15:59Z is still 23:59 Friday.
    expect(manilaDowHour(new Date('2026-11-20T15:59:00Z'))).toEqual({ dow: 5, hour: 23 })
    // 16:00Z is midnight, Saturday.
    expect(manilaDowHour(new Date('2026-11-20T16:00:00Z'))).toEqual({ dow: 6, hour: 0 })
  })

  test('sums rows that land in the same Manila hour and tracks the peak', () => {
    const grid = hourlyGrid([
      { shop_id: 'a', hour_start: '2026-11-20T16:00:00Z', report_count: 2 },
      { shop_id: 'b', hour_start: '2026-11-27T16:00:00Z', report_count: 3 },
      { shop_id: 'a', hour_start: '2026-11-20T07:00:00Z', report_count: 1 },
    ])
    expect(grid.cells[6]![0]).toBe(5)
    expect(grid.cells[5]![15]).toBe(1)
    expect(grid.total).toBe(6)
    expect(grid.peak).toEqual({ dow: 6, hour: 0, count: 5 })
  })

  test('ignores bad rows', () => {
    const grid = hourlyGrid([
      { shop_id: 'a', hour_start: 'not a date', report_count: 4 },
      { shop_id: 'a', hour_start: '2026-11-20T07:00:00Z', report_count: -2 },
    ])
    expect(grid.total).toBe(0)
  })

  test('parses rows defensively', () => {
    expect(parseCheckinHourly([
      { shop_id: 'a', hour_start: '2026-11-20T07:00:00Z', report_count: '4' },
      { shop_id: 'a' },
      null,
    ])).toEqual([{ shop_id: 'a', hour_start: '2026-11-20T07:00:00Z', report_count: 4 }])
    expect(parseCheckinHourly(null)).toEqual([])
  })
})

describe('traffic by hour', () => {
  test('keeps only the asked kinds and valid cells', () => {
    const grid = trafficHourlyGrid([
      { kind: 'detail_view', dow: 6, hour: 15, hits: 4 },
      { kind: 'detail_view', dow: 6, hour: 15, hits: 2 },
      { kind: 'navigate', dow: 6, hour: 15, hits: 9 },
      { kind: 'detail_view', dow: 7, hour: 1, hits: 9 },
      { kind: 'detail_view', dow: 1, hour: 24, hits: 9 },
    ], ['detail_view'])
    expect(grid.cells[6]![15]).toBe(6)
    expect(grid.total).toBe(6)
  })
})

describe('slots and labels', () => {
  test('formats hours and slots', () => {
    expect(formatHourLabel(0)).toBe('12 AM')
    expect(formatHourLabel(12)).toBe('12 PM')
    expect(formatHourLabel(15)).toBe('3 PM')
    expect(formatHourLabel(24)).toBe('12 AM')
    expect(describeSlot(6, 23)).toBe('Saturday, 11 PM to 12 AM')
  })

  test('busiest slot needs a minimum total', () => {
    const thin = hourlyGrid([{ shop_id: 'a', hour_start: '2026-11-20T07:00:00Z', report_count: 4 }])
    expect(busiestSlot(thin)).toBeNull()
    expect(busiestSlot(thin, 1)?.count).toBe(4)
  })

  test('top slots are ordered by count', () => {
    const grid = hourlyGrid([
      { shop_id: 'a', hour_start: '2026-11-20T07:00:00Z', report_count: 2 },
      { shop_id: 'a', hour_start: '2026-11-21T07:00:00Z', report_count: 9 },
    ])
    const slots = topSlots(grid, 5)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toEqual({ dow: 6, hour: 15, count: 9 })
  })

  test('heat levels scale against the busiest cell', () => {
    expect(heatLevel(0, 10)).toBe(0)
    expect(heatLevel(1, 10)).toBe(1)
    expect(heatLevel(4, 10)).toBe(2)
    expect(heatLevel(6, 10)).toBe(3)
    expect(heatLevel(10, 10)).toBe(4)
    expect(heatLevel(5, 0)).toBe(0)
  })
})
