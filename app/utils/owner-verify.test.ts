import { describe, expect, test } from 'bun:test'
import {
  draftFromVerification,
  emptyOwnerVerifyDraft,
  ownerVerifyErrors,
  ownerVerifyHasErrors,
  verificationStatusWord,
} from './owner-verify'
import type { ShopAmenityVerificationRow } from '../types/shop'

function file(type = 'image/jpeg', size = 1200) {
  return { type, size } as File
}

describe('owner verify form', () => {
  test('asks for at least one amenity', () => {
    expect(ownerVerifyErrors(emptyOwnerVerifyDraft()).form).toMatch(/at least one/)
    expect(ownerVerifyHasErrors(emptyOwnerVerifyDraft())).toBe(true)
  })

  test('requires a screenshot and Mbps for WiFi', () => {
    const draft = emptyOwnerVerifyDraft()
    draft.includeWifi = true
    expect(ownerVerifyErrors(draft).wifi).toMatch(/fast.com/)
    draft.wifiFile = file()
    expect(ownerVerifyErrors(draft).wifi).toMatch(/Mbps/)
    draft.wifiMbps = '42'
    expect(ownerVerifyErrors(draft).wifi).toBeNull()
    expect(ownerVerifyErrors(draft).form).toBeNull()
  })

  test('requires interior photo and a seat count', () => {
    const draft = emptyOwnerVerifyDraft()
    draft.includeSeating = true
    draft.seatingFile = file()
    draft.seatingCapacity = '-1'
    expect(ownerVerifyErrors(draft).seating).toMatch(/seats/)
    draft.seatingCapacity = '24'
    expect(ownerVerifyErrors(draft).seating).toBeNull()
  })

  test('requires outlet photo and payment choices when included', () => {
    const draft = emptyOwnerVerifyDraft()
    draft.includeOutlets = true
    expect(ownerVerifyErrors(draft).outlets).toMatch(/outlets/)
    draft.outletsFile = file('application/pdf')
    expect(ownerVerifyErrors(draft).outlets).toMatch(/JPG/)
    draft.outletsFile = file('image/jpeg', 21 * 1024 * 1024)
    expect(ownerVerifyErrors(draft).outlets).toMatch(/20 MB/)
    draft.outletsFile = file()
    expect(ownerVerifyErrors(draft).outlets).toBeNull()
    draft.includePayment = true
    expect(ownerVerifyErrors(draft).payment).toMatch(/QR/)
    draft.payment = { qr: 'available', card: 'unavailable', cash: 'available' }
    expect(ownerVerifyHasErrors(draft)).toBe(false)
  })

  test('loads a pending ticket as a draft', () => {
    const row: ShopAmenityVerificationRow = {
      id: 'v1',
      shop_id: 'shop',
      owner_id: 'owner',
      status: 'pending',
      include_wifi: true,
      wifi_screenshot_object_key: 'amenity-proofs/owner/a.jpg',
      wifi_download_mbps: 38,
      include_seating: false,
      seating_photo_object_key: null,
      seating_capacity: null,
      include_outlets: false,
      outlets_photo_object_key: null,
      include_payment: true,
      accepts_qr: 'available',
      accepts_card: 'unavailable',
      accepts_cash: 'available',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2026-11-18T00:00:00.000Z',
      updated_at: '2026-11-18T00:00:00.000Z',
    }
    const draft = draftFromVerification(row)
    expect(draft.includeWifi).toBe(true)
    expect(draft.wifiKey).toMatch(/amenity-proofs/)
    expect(draft.wifiMbps).toBe('38')
    expect(draft.payment.qr).toBe('available')
    expect(verificationStatusWord('approved')).toBe('Approved')
  })
})
