import type { AmenityVerificationStatus, PaymentChoice, ShopAmenityVerificationRow } from '../types/shop'
import { UPLOAD_IMAGE_TYPES, UPLOAD_PICK_MAX_BYTES } from './optimize-upload-image'

export const VERIFY_REJECTION_MAX = 280

export interface OwnerVerifyDraft {
  includeWifi: boolean
  wifiFile: File | null
  wifiKey: string | null
  wifiMbps: string
  includeSeating: boolean
  seatingFile: File | null
  seatingKey: string | null
  seatingCapacity: string
  includeOutlets: boolean
  outletsFile: File | null
  outletsKey: string | null
  includePayment: boolean
  payment: {
    qr: PaymentChoice | null
    card: PaymentChoice | null
    cash: PaymentChoice | null
  }
}

export interface OwnerVerifyErrors {
  form: string | null
  wifi: string | null
  seating: string | null
  outlets: string | null
  payment: string | null
}

export const VERIFY_PAYMENT_METHODS = [
  { id: 'qr' as const, label: 'QR' },
  { id: 'card' as const, label: 'Card' },
  { id: 'cash' as const, label: 'Cash' },
]

export const VERIFY_PAYMENT_CHOICES: Array<{ id: PaymentChoice; label: string }> = [
  { id: 'available', label: 'Yes' },
  { id: 'unavailable', label: 'No' },
  { id: 'unknown', label: 'Unknown' },
]

export function emptyOwnerVerifyDraft(): OwnerVerifyDraft {
  return {
    includeWifi: false,
    wifiFile: null,
    wifiKey: null,
    wifiMbps: '',
    includeSeating: false,
    seatingFile: null,
    seatingKey: null,
    seatingCapacity: '',
    includeOutlets: false,
    outletsFile: null,
    outletsKey: null,
    includePayment: false,
    payment: { qr: null, card: null, cash: null },
  }
}

export function proofFileError(file: File | null, required: boolean, noun: string): string | null {
  if (!file) return required ? `Upload ${noun}.` : null
  if (!UPLOAD_IMAGE_TYPES.has(file.type)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size > UPLOAD_PICK_MAX_BYTES) return 'Keep that photo under 20 MB. We will scale it down before upload.'
  return null
}

function parseMbps(value: string): number | null {
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) return null
  return parsed
}

function parseSeats(value: string): number | null {
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 10000) return null
  return parsed
}

export function ownerVerifyErrors(draft: OwnerVerifyDraft): OwnerVerifyErrors {
  const included = draft.includeWifi || draft.includeSeating || draft.includeOutlets || draft.includePayment
  let wifi: string | null = null
  if (draft.includeWifi) {
    wifi = proofFileError(draft.wifiFile, !draft.wifiKey, 'a fast.com screenshot')
    if (!wifi && parseMbps(draft.wifiMbps) == null) wifi = 'Enter the download Mbps shown on fast.com.'
  }
  let seating: string | null = null
  if (draft.includeSeating) {
    seating = proofFileError(draft.seatingFile, !draft.seatingKey, 'a photo of the cafe interior')
    if (!seating && parseSeats(draft.seatingCapacity) == null) seating = 'Enter how many seats the cafe has.'
  }
  let outlets: string | null = null
  if (draft.includeOutlets) {
    outlets = proofFileError(draft.outletsFile, !draft.outletsKey, 'a photo of the power outlets')
  }
  let payment: string | null = null
  if (draft.includePayment) {
    if (!draft.payment.qr || !draft.payment.card || !draft.payment.cash) {
      payment = 'Say whether you accept QR, card, and cash.'
    }
  }
  return {
    form: included ? null : 'Choose at least one amenity to verify.',
    wifi,
    seating,
    outlets,
    payment,
  }
}

export function ownerVerifyHasErrors(draft: OwnerVerifyDraft): boolean {
  return Object.values(ownerVerifyErrors(draft)).some(Boolean)
}

export function verificationStatusWord(status: AmenityVerificationStatus): string {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return 'Pending'
}

export function verificationQueueEmptyCopy(status: AmenityVerificationStatus): string {
  if (status === 'approved') return 'No approved amenity proofs yet.'
  if (status === 'rejected') return 'No rejected amenity proofs.'
  return 'No amenity proofs waiting.'
}

export function latestVerificationForShop(
  rows: ShopAmenityVerificationRow[],
  shopId: string,
): ShopAmenityVerificationRow | null {
  return rows.find((row) => row.shop_id === shopId) ?? null
}

export function draftFromVerification(row: ShopAmenityVerificationRow | null): OwnerVerifyDraft {
  const draft = emptyOwnerVerifyDraft()
  if (!row || row.status !== 'pending') return draft
  draft.includeWifi = row.include_wifi
  draft.wifiKey = row.wifi_screenshot_object_key
  draft.wifiMbps = row.wifi_download_mbps != null ? String(row.wifi_download_mbps) : ''
  draft.includeSeating = row.include_seating
  draft.seatingKey = row.seating_photo_object_key
  draft.seatingCapacity = row.seating_capacity != null ? String(row.seating_capacity) : ''
  draft.includeOutlets = row.include_outlets
  draft.outletsKey = row.outlets_photo_object_key
  draft.includePayment = row.include_payment
  draft.payment = {
    qr: asPaymentChoice(row.accepts_qr),
    card: asPaymentChoice(row.accepts_card),
    cash: asPaymentChoice(row.accepts_cash),
  }
  return draft
}

function asPaymentChoice(value: string | null | undefined): PaymentChoice | null {
  if (value === 'available' || value === 'unavailable' || value === 'unknown') return value
  return null
}

export function ownerVerifySubmitPayload(draft: OwnerVerifyDraft) {
  return {
    includeWifi: draft.includeWifi,
    wifiMbps: draft.includeWifi ? parseMbps(draft.wifiMbps) : null,
    includeSeating: draft.includeSeating,
    seatingCapacity: draft.includeSeating ? parseSeats(draft.seatingCapacity) : null,
    includeOutlets: draft.includeOutlets,
    includePayment: draft.includePayment,
    acceptsQr: draft.includePayment ? draft.payment.qr : null,
    acceptsCard: draft.includePayment ? draft.payment.card : null,
    acceptsCash: draft.includePayment ? draft.payment.cash : null,
  }
}
