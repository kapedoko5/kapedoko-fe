import { describe, expect, test } from 'bun:test'
import { adminCannotClaimCopy, adminCannotOwnCopy, assignOwnershipTitle, cafeOwnerDisplayName, cafeOwnerInitial, cafeOwnerReportDoneCopy, cafeOwnerReportLabel, cafeOwnerReportReason, canAssignCafeOwner, claimFormError, claimStatusCopy, canWithdrawClaim, claimRejectionReasonError, claimStatusWord, claimsQueueEmptyCopy, missingShopOwnerSqlCopy, profileClaimsEmptyCopy, showCafeClaimCta, showCafeOwnerCard, showCafeOwnerInvite, showCafeOwnerName, showCafeOwnerReport, transferOwnershipAction, transferOwnershipDoneCopy, transferOwnershipMessage, transferOwnershipTitle } from './shop-claims'
import { parseProfileRole } from './profile-role'

describe('cafe claims', () => {
  test('requires a note and a reachable contact', () => {
    expect(claimFormError({ note: 'short', email: '', phone: '' })).toEqual({
      note: 'Use at least 20 characters.',
      contact: 'Add a phone number or email we can reach you on.',
    })
    expect(claimFormError({
      note: 'I manage this branch and can show a business permit.',
      email: 'owner@studio.ph',
      phone: '',
    })).toEqual({ note: null, contact: null })
  })

  test('explains claim status to the claimant', () => {
    expect(claimStatusCopy('pending')).toMatch(/Waiting/)
    expect(claimStatusCopy('verified')).toMatch(/edit/)
    expect(claimStatusCopy('rejected', 'Need a permit')).toMatch(/permit/)
    expect(canWithdrawClaim('pending')).toBe(true)
    expect(canWithdrawClaim('verified')).toBe(false)
    expect(canWithdrawClaim('rejected')).toBe(false)
    expect(claimRejectionReasonError('')).toBe('Say why this claim is not verified.')
    expect(claimRejectionReasonError('Need a business permit on file.')).toBeNull()
    expect(claimStatusWord('pending')).toBe('Pending')
    expect(claimsQueueEmptyCopy('pending')).toMatch(/land here/)
    expect(profileClaimsEmptyCopy(false)).toMatch(/wait here/)
    expect(profileClaimsEmptyCopy(true)).toMatch(/admin portal/)
  })

  test('hides the owner invite when someone else already manages the cafe', () => {
    expect(showCafeOwnerInvite({ myClaimStatus: null, hasVerifiedOwner: true, ownerKnown: true })).toBe(false)
    expect(showCafeOwnerInvite({ myClaimStatus: 'rejected', hasVerifiedOwner: true, ownerKnown: true })).toBe(false)
    expect(showCafeOwnerInvite({ myClaimStatus: 'verified', hasVerifiedOwner: true, ownerKnown: true })).toBe(true)
    expect(showCafeOwnerInvite({ myClaimStatus: 'pending', hasVerifiedOwner: false, ownerKnown: true })).toBe(true)
    expect(showCafeOwnerInvite({ myClaimStatus: null, hasVerifiedOwner: false, ownerKnown: true })).toBe(true)
    expect(showCafeOwnerInvite({ myClaimStatus: null, hasVerifiedOwner: false, ownerKnown: false })).toBe(false)
  })

  test('shows the owner card when the cafe is claimed, including for admins on an unclaimed listing', () => {
    expect(showCafeOwnerCard({ myClaimStatus: null, hasVerifiedOwner: true, ownerKnown: true })).toBe(true)
    expect(showCafeOwnerCard({ myClaimStatus: 'rejected', hasVerifiedOwner: true, ownerKnown: true })).toBe(true)
    expect(showCafeOwnerCard({ myClaimStatus: null, hasVerifiedOwner: false, ownerKnown: true, isAdmin: true })).toBe(true)
    expect(showCafeOwnerCard({ myClaimStatus: null, hasVerifiedOwner: false, ownerKnown: false, isAdmin: true })).toBe(false)
    expect(showCafeOwnerCard({ myClaimStatus: null, hasVerifiedOwner: false, ownerKnown: true })).toBe(true)
  })

  test('names the owner only on the admin cafe desk', () => {
    expect(showCafeOwnerName({ desk: false, hasVerifiedOwner: true })).toBe(false)
    expect(showCafeOwnerName({ desk: true, hasVerifiedOwner: true })).toBe(true)
    expect(showCafeOwnerName({ desk: true, hasVerifiedOwner: false })).toBe(false)
  })

  test('lets visitors report a mistaken claim, not owners or admins', () => {
    expect(showCafeOwnerReport({ hasVerifiedOwner: true, myClaimStatus: null })).toBe(true)
    expect(showCafeOwnerReport({ hasVerifiedOwner: true, myClaimStatus: 'verified' })).toBe(false)
    expect(showCafeOwnerReport({ hasVerifiedOwner: true, myClaimStatus: null, isAdmin: true })).toBe(false)
    expect(showCafeOwnerReport({ hasVerifiedOwner: true, myClaimStatus: null, desk: true })).toBe(false)
    expect(showCafeOwnerReport({ hasVerifiedOwner: false, myClaimStatus: null })).toBe(false)
    expect(cafeOwnerReportLabel()).toMatch(/mistaken claim/)
    expect(cafeOwnerReportReason()).toMatch(/owner is a mistake/)
    expect(cafeOwnerReportDoneCopy()).toMatch(/admin will check/)
  })

  test('hides the claim CTA for admins and blocks assigning themselves', () => {
    expect(showCafeClaimCta({ myClaimStatus: null, hasVerifiedOwner: false, ownerKnown: true })).toBe(true)
    expect(showCafeClaimCta({ myClaimStatus: null, hasVerifiedOwner: false, ownerKnown: true, isAdmin: true })).toBe(false)
    expect(showCafeClaimCta({ myClaimStatus: 'verified', hasVerifiedOwner: true, ownerKnown: true, isAdmin: true })).toBe(false)
    expect(canAssignCafeOwner({ actorId: 'admin-1', targetId: 'user-2' })).toBe(true)
    expect(canAssignCafeOwner({ actorId: 'admin-1', targetId: 'admin-1' })).toBe(false)
    expect(canAssignCafeOwner({ actorId: 'admin-1', targetId: 'user-2', currentOwnerId: 'user-2' })).toBe(false)
    expect(adminCannotClaimCopy()).toMatch(/cannot claim/)
    expect(adminCannotOwnCopy()).toMatch(/themselves/)
  })

  test('names the claimed owner and writes transfer copy', () => {
    expect(cafeOwnerDisplayName('  Ana Cruz  ')).toBe('Ana Cruz')
    expect(cafeOwnerDisplayName('')).toBe('Signed-in KapéBean')
    expect(cafeOwnerInitial('ana')).toBe('A')
    expect(transferOwnershipTitle('Yardstick Coffee', 'Ana Cruz')).toBe('Transfer Yardstick Coffee to Ana Cruz?')
    expect(assignOwnershipTitle('Yardstick Coffee', 'Ana Cruz')).toBe('Assign Yardstick Coffee to Ana Cruz?')
    expect(transferOwnershipAction(true)).toBe('Transfer ownership')
    expect(transferOwnershipAction(false)).toBe('Assign owner')
    expect(transferOwnershipMessage({
      claimed: true,
      fromName: 'Lee Santos',
      toName: 'Ana Cruz',
    })).toMatch(/Ana Cruz takes over/)
    expect(transferOwnershipMessage({
      claimed: false,
      toName: 'Ana Cruz',
    })).toMatch(/Ana Cruz can then edit/)
    expect(transferOwnershipDoneCopy('Yardstick Coffee', 'Ana Cruz')).toBe('Ana Cruz now manages Yardstick Coffee.')
    expect(missingShopOwnerSqlCopy('Could not find the function public.admin_transfer_shop_ownership')).toMatch(/20261113_shop_verified_owner/)
    expect(missingShopOwnerSqlCopy('Network error')).toBeNull()
  })
})

describe('profile roles', () => {
  test('keeps cafe-owner instead of coercing to user', () => {
    expect(parseProfileRole('cafe-owner')).toBe('cafe-owner')
    expect(parseProfileRole('admin')).toBe('admin')
    expect(parseProfileRole('auditor')).toBe('auditor')
    expect(parseProfileRole('mod')).toBe('user')
  })
})
