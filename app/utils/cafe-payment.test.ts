import { describe, expect, test } from 'bun:test'
import {
  paymentAriaLabel,
  paymentBagValue,
  paymentCard,
  paymentCardLabel,
  paymentFromRow,
  paymentKnown,
  paymentTeamPress,
} from './cafe-payment'

describe('cafe payment facts', () => {
  test('maps a team visit onto QR, card, and cash', () => {
    expect(paymentFromRow({
      shop_id: '1',
      accepts_qr: 'available',
      accepts_card: 'unavailable',
      accepts_cash: 'available',
      source_at: '2026-10-02T00:00:00.000Z',
    })).toEqual({
      qr: 'available',
      card: 'unavailable',
      cash: 'available',
      sourceAt: '2026-10-02T00:00:00.000Z',
      source: 'team',
    })
  })

  test('hides payment until a visit recorded yes or no', () => {
    expect(paymentKnown(null)).toBe(false)
    expect(paymentKnown(paymentFromRow({
      shop_id: '1',
      accepts_qr: 'unknown',
      accepts_card: null,
      accepts_cash: 'unknown',
      source_at: '2026-10-02T00:00:00.000Z',
    }))).toBe(false)
    expect(paymentKnown(paymentFromRow({
      shop_id: '1',
      accepts_qr: 'available',
      accepts_card: 'unknown',
      accepts_cash: 'unknown',
      source_at: '2026-10-02T00:00:00.000Z',
    }))).toBe(true)
  })

  test('bag copy is yes, no, or unknown', () => {
    expect(paymentBagValue('available')).toBe('Yes')
    expect(paymentBagValue('unavailable')).toBe('No')
    expect(paymentBagValue('unknown')).toBe('Unknown')
    expect(paymentAriaLabel('qr', 'available')).toBe('QR, Yes')
  })

  test('combines accepted methods onto one pay card', () => {
    const mixed = paymentFromRow({
      shop_id: '1',
      accepts_qr: 'available',
      accepts_card: 'unknown',
      accepts_cash: 'unavailable',
      source_at: '2026-10-02T00:00:00.000Z',
    })
    expect(paymentCardLabel(mixed)).toBe('QR')
    expect(paymentCard(mixed)).toEqual({
      label: 'QR',
      stamp: 'team',
      unavailable: false,
      aria: 'Pay, QR. QR, Yes. Card, Unknown. Cash, No',
    })
    expect(paymentCardLabel(paymentFromRow({
      shop_id: '1',
      accepts_qr: 'available',
      accepts_card: 'available',
      accepts_cash: 'available',
      source_at: '2026-10-02T00:00:00.000Z',
    }))).toBe('QR · Card · Cash')
    expect(paymentCard(paymentFromRow({
      shop_id: '1',
      accepts_qr: 'unavailable',
      accepts_card: 'unavailable',
      accepts_cash: 'unavailable',
      source_at: '2026-10-02T00:00:00.000Z',
    }))?.unavailable).toBe(true)
    expect(paymentTeamPress(mixed)).toBe('Verified · Oct 2, 2026')
    expect(paymentTeamPress(paymentFromRow({
      shop_id: '1',
      accepts_qr: 'available',
      accepts_card: 'unavailable',
      accepts_cash: 'available',
      source_at: '2026-10-02T00:00:00.000Z',
      source: 'owner',
    }))).toBe('Verified · Oct 2, 2026')
    expect(paymentCard(null)).toBeNull()
  })
})
