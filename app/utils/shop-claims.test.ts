import { describe, expect, test } from 'bun:test'
import { claimFormError, claimStatusCopy, canWithdrawClaim, claimRejectionReasonError, claimStatusWord, claimsQueueEmptyCopy, profileClaimsEmptyCopy, showCafeOwnerInvite } from './shop-claims'
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
    expect(showCafeOwnerInvite({ myClaimStatus: null, hasVerifiedOwner: true })).toBe(false)
    expect(showCafeOwnerInvite({ myClaimStatus: 'rejected', hasVerifiedOwner: true })).toBe(false)
    expect(showCafeOwnerInvite({ myClaimStatus: 'verified', hasVerifiedOwner: true })).toBe(true)
    expect(showCafeOwnerInvite({ myClaimStatus: 'pending', hasVerifiedOwner: false })).toBe(true)
    expect(showCafeOwnerInvite({ myClaimStatus: null, hasVerifiedOwner: false })).toBe(true)
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
