import { emailError } from './auth'
import { isValidPhone, normalizePhone } from './phone'

export const CLAIM_NOTE_MIN = 20
export const CLAIM_NOTE_MAX = 500

export function normalizeClaimNote(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function claimNoteError(value: string): string | null {
  const note = normalizeClaimNote(value)
  if (!note) return 'Tell us how you are connected to this cafe.'
  if (note.length < CLAIM_NOTE_MIN) return 'Use at least 20 characters.'
  if (note.length > CLAIM_NOTE_MAX) return 'Keep this under 500 characters.'
  return null
}

export function claimContactError(email: string, phone: string): string | null {
  const mail = email.trim()
  const tel = normalizePhone(phone)
  if (!mail && !tel) return 'Add a phone number or email we can reach you on.'
  if (mail) {
    const issue = emailError(mail)
    if (issue) return issue
  }
  if (tel && !isValidPhone(tel)) return 'Use a phone number like 0917 123 4567.'
  return null
}

export function claimFormError(input: { note: string; email: string; phone: string }): {
  note: string | null
  contact: string | null
} {
  return {
    note: claimNoteError(input.note),
    contact: claimContactError(input.email, input.phone),
  }
}

export function claimStatusCopy(status: 'pending' | 'verified' | 'rejected', rejectionReason?: string | null): string {
  if (status === 'verified') return 'You can edit this listing.'
  if (status === 'rejected') {
    return rejectionReason ? `Not verified. ${rejectionReason}` : 'Not verified.'
  }
  return 'Waiting for an admin to verify this claim.'
}

export function canWithdrawClaim(status: 'pending' | 'verified' | 'rejected'): boolean {
  return status === 'pending'
}

export const CLAIM_REJECTION_MAX = 280

export function claimRejectionReasonError(value: string): string | null {
  const reason = value.trim()
  if (!reason) return 'Say why this claim is not verified.'
  if (reason.length > CLAIM_REJECTION_MAX) return 'Keep this under 280 characters.'
  return null
}

export function claimStatusWord(status: 'pending' | 'verified' | 'rejected'): string {
  if (status === 'pending') return 'Pending'
  if (status === 'verified') return 'Verified'
  return 'Rejected'
}

export function claimsQueueEmptyCopy(filter: 'pending' | 'verified' | 'rejected'): string {
  if (filter === 'pending') return 'No claims waiting. New ones from cafe pages land here.'
  if (filter === 'verified') return 'No verified owners yet.'
  return 'No rejected claims.'
}

export function profileClaimsEmptyCopy(isAdmin: boolean): string {
  if (isAdmin) return 'You review other people’s claims in the admin portal.'
  return 'Claims you send wait here until an admin verifies them.'
}

/** Invite card on a cafe page. Keep it for the owner or a waiting claim; hide it when someone else already owns the listing. */
export function showCafeOwnerInvite(input: {
  myClaimStatus: 'pending' | 'verified' | 'rejected' | null
  hasVerifiedOwner: boolean
  ownerKnown?: boolean
}): boolean {
  if (input.myClaimStatus === 'verified' || input.myClaimStatus === 'pending') return true
  if (input.ownerKnown === false) return false
  if (input.hasVerifiedOwner) return false
  return true
}
