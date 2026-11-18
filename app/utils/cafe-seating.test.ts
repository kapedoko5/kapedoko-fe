import { describe, expect, test } from 'bun:test'
import {
  seatingBagAria,
  seatingBagValue,
  seatingDateLabel,
  seatingFromRow,
  seatingPressLabel,
  seatingStamp,
} from './cafe-seating'

describe('cafe seating', () => {
  test('maps a public seating row', () => {
    expect(seatingFromRow({
      shop_id: 'shop',
      seating_capacity: 24,
      source: 'owner',
      source_at: '2026-11-18T00:00:00.000Z',
    })).toEqual({
      count: 24,
      source: 'owner',
      sourceAt: '2026-11-18T00:00:00.000Z',
    })
    expect(seatingFromRow({ shop_id: 'shop', seating_capacity: null, source_at: null })).toBeNull()
    expect(seatingFromRow({
      shop_id: 'shop',
      seating_capacity: '18',
      source: 'team',
      source_at: '2026-10-02T00:00:00.000Z',
    })).toMatchObject({ count: 18, source: 'team' })
  })

  test('names the count for cafe detail', () => {
    expect(seatingPressLabel({ count: 1, source: 'team', sourceAt: null })).toBe('Approx. 1 seat')
    expect(seatingPressLabel({ count: 18, source: 'owner', sourceAt: null })).toBe('Approx. 18 seats')
    expect(seatingStamp({ count: 18, source: 'owner', sourceAt: null })).toBe('owner')
    expect(seatingDateLabel({
      count: 18,
      source: 'owner',
      sourceAt: '2026-10-02T00:00:00.000Z',
    })).toBe('Oct 2, 2026')
    expect(seatingDateLabel({ count: 18, source: 'team', sourceAt: null })).toBeNull()
    expect(seatingBagValue({ count: 18, source: 'team', sourceAt: null })).toBe('Approx. 18')
    expect(seatingBagValue(null)).toBeNull()
    expect(seatingBagAria({ count: 18, source: 'team', sourceAt: null })).toBe('Seats, Approx. 18 seats')
  })
})
