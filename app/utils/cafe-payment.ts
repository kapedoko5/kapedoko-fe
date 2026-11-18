import type { CafePayment, PaymentKind, PaymentResult } from '../types/cafe'

export type { CafePayment, PaymentKind, PaymentResult }

export interface ShopPaymentRow {
  shop_id: string
  accepts_qr: string | null
  accepts_card: string | null
  accepts_cash: string | null
  source_at: string | null
  source?: string | null
}

export const PAYMENT_KINDS: Array<{ id: PaymentKind; noun: string }> = [
  { id: 'qr', noun: 'QR' },
  { id: 'card', noun: 'Card' },
  { id: 'cash', noun: 'Cash' },
]

function asResult(value: string | null | undefined): PaymentResult {
  if (value === 'available' || value === 'unavailable') return value
  return 'unknown'
}

export function paymentFromRow(row?: ShopPaymentRow | null): CafePayment | null {
  if (!row) return null
  return {
    qr: asResult(row.accepts_qr),
    card: asResult(row.accepts_card),
    cash: asResult(row.accepts_cash),
    sourceAt: row.source_at,
    source: row.source === 'owner' ? 'owner' : row.source === 'team' ? 'team' : 'team',
  }
}

export function paymentKnown(payment?: CafePayment | null): boolean {
  if (!payment) return false
  return [payment.qr, payment.card, payment.cash].some((value) => value === 'available' || value === 'unavailable')
}

export function paymentBagValue(result: PaymentResult): string {
  if (result === 'available') return 'Yes'
  if (result === 'unavailable') return 'No'
  return 'Unknown'
}

export function paymentAriaLabel(kind: PaymentKind, result: PaymentResult): string {
  const noun = PAYMENT_KINDS.find((row) => row.id === kind)?.noun ?? kind
  return `${noun}, ${paymentBagValue(result)}`
}

export function paymentDateLabel(payment?: CafePayment | null): string | null {
  if (!payment?.sourceAt) return null
  const date = new Date(payment.sourceAt)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}

export function paymentTeamPress(payment?: CafePayment | null): string | null {
  if (!paymentKnown(payment)) return null
  const date = paymentDateLabel(payment)
  return ['Verified', date].filter(Boolean).join(' · ')
}

export function paymentCardLabel(payment?: CafePayment | null): string {
  if (!paymentKnown(payment) || !payment) return ''
  const accepted = PAYMENT_KINDS
    .filter((row) => payment[row.id] === 'available')
    .map((row) => row.noun)
  if (accepted.length) return accepted.join(' · ')
  if (PAYMENT_KINDS.every((row) => payment[row.id] === 'unavailable')) return 'None'
  return 'Unknown'
}

export function paymentCardAria(payment?: CafePayment | null): string {
  if (!paymentKnown(payment) || !payment) return 'Pay, Unknown'
  const details = PAYMENT_KINDS.map((row) => paymentAriaLabel(row.id, payment[row.id]))
  return [`Pay, ${paymentCardLabel(payment)}`, ...details].join('. ')
}

export function paymentCard(payment?: CafePayment | null): {
  label: string
  stamp: 'team' | 'owner' | 'unknown'
  unavailable: boolean
  aria: string
} | null {
  if (!paymentKnown(payment) || !payment) return null
  const label = paymentCardLabel(payment)
  const unavailable = label === 'None'
  return {
    label,
    stamp: label === 'Unknown' ? 'unknown' : payment.source === 'owner' ? 'owner' : 'team',
    unavailable,
    aria: paymentCardAria(payment),
  }
}
