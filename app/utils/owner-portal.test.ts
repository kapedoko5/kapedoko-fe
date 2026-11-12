import { describe, expect, test } from 'bun:test'
import { allDayEveryDay, sameHoursEveryDay } from './hours'
import {
  canAccessOwnerDesk,
  mergeNoticedClaimIds,
  ownerCafeErrors,
  ownerCafeIsClosed,
  ownerClaimsEmptyCopy,
  ownerDeskCafesEmptyCopy,
  ownerHoursLine,
  ownerLiveCopy,
  ownerLoginDeniedCopy,
  ownerStaffRedirect,
  unmarkedWaitingClaims,
  waitingOwnerClaims,
} from './owner-portal'
import type { ShopClaimRow } from '../types/shop'

function claim(status: ShopClaimRow['status'], id = status): ShopClaimRow {
  return {
    id,
    shop_id: 'shop',
    claimant_id: 'user',
    status,
    evidence_note: 'I own this branch and can be reached on the cafe number.',
    contact_email: 'owner@studio.ph',
    contact_phone: null,
    rejection_reason: status === 'rejected' ? 'Could not match the business email.' : null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('owner desk access', () => {
  test('sends staff to the admin desk', () => {
    expect(ownerStaffRedirect('admin')).toBe('/admin')
    expect(ownerStaffRedirect('auditor')).toBe('/admin/audits')
    expect(ownerStaffRedirect('cafe-owner')).toBeNull()
  })

  test('lets cafe owners and claimants in, not ordinary users', () => {
    expect(canAccessOwnerDesk({ role: 'cafe-owner', claimCount: 0 })).toBe(true)
    expect(canAccessOwnerDesk({ role: 'user', claimCount: 1 })).toBe(true)
    expect(canAccessOwnerDesk({ role: 'user', claimCount: 0 })).toBe(false)
    expect(canAccessOwnerDesk({ role: 'admin', claimCount: 3 })).toBe(false)
  })

  test('explains a denied login without inventing a catalog search', () => {
    expect(ownerLoginDeniedCopy()).toMatch(/Claim a listed cafe/)
  })
})

describe('owner cafe facts', () => {
  test('asks for a pin when lat/lng are missing', () => {
    const issues = ownerCafeErrors({
      name: 'Harbor',
      address: '1 Session Road, Baguio City',
      lat: null,
      lng: null,
      phone: '',
      hours: allDayEveryDay(),
      logoFile: null,
    })
    expect(issues.pin).toBe('Pin the cafe on the map.')
    expect(issues.name).toBeNull()
  })

  test('treats all-day hours as open and names the live window', () => {
    expect(ownerCafeIsClosed(allDayEveryDay())).toBe(false)
    expect(ownerHoursLine(allDayEveryDay())).toBe('Open 24 hours')
    expect(ownerHoursLine(sameHoursEveryDay('08:00', '20:00'))).toMatch(/Opens /)
  })

  test('says when a listing is actually on the map', () => {
    expect(ownerLiveCopy({ status: 'approved' })).toBe('On Home and Map')
    expect(ownerLiveCopy({ status: 'hidden' })).toMatch(/Unpublished/)
  })
})

describe('owner claims', () => {
  test('waiting claims are pending or rejected, not verified', () => {
    const rows = [claim('pending', 'p'), claim('verified', 'v'), claim('rejected', 'r')]
    expect(waitingOwnerClaims(rows).map((row) => row.id)).toEqual(['p', 'r'])
  })

  test('keeps a waiting claim marked until it is noticed', () => {
    const rows = [claim('pending', 'p'), claim('rejected', 'r')]
    expect(unmarkedWaitingClaims(rows, ['p']).map((row) => row.id)).toEqual(['r'])
    expect(mergeNoticedClaimIds(['p'], rows).sort()).toEqual(['p', 'r'])
  })

  test('empty copy names the filter', () => {
    expect(ownerClaimsEmptyCopy('pending')).toMatch(/waiting on admin/)
    expect(ownerDeskCafesEmptyCopy(2)).toMatch(/rail above/)
  })
})
