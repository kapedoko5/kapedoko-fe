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

/** Claim CTA on a cafe page. Admins assign an owner instead of claiming. */
export function showCafeClaimCta(input: {
  myClaimStatus: 'pending' | 'verified' | 'rejected' | null
  hasVerifiedOwner: boolean
  ownerKnown?: boolean
  isAdmin?: boolean
}): boolean {
  if (input.isAdmin) return false
  return showCafeOwnerInvite(input)
}

/** Admins may assign anyone except themselves and the current owner. */
export function canAssignCafeOwner(input: {
  actorId?: string | null
  targetId: string
  currentOwnerId?: string | null
}): boolean {
  if (!input.targetId) return false
  if (input.actorId && input.targetId === input.actorId) return false
  if (input.currentOwnerId && input.targetId === input.currentOwnerId) return false
  return true
}

export function adminCannotClaimCopy(): string {
  return 'Admins assign an owner. They cannot claim a cafe.'
}

export function adminCannotOwnCopy(): string {
  return 'Admins cannot assign a cafe to themselves.'
}

/** Owner card on a cafe page. Public claimed cards do not name the owner. */
export function showCafeOwnerCard(input: {
  myClaimStatus: 'pending' | 'verified' | 'rejected' | null
  hasVerifiedOwner: boolean
  ownerKnown?: boolean
  isAdmin?: boolean
}): boolean {
  if (input.ownerKnown === false) return false
  if (input.isAdmin) return true
  if (input.hasVerifiedOwner) return true
  return showCafeOwnerInvite(input)
}

/** Admin cafe edit still names the owner. Public cafe detail does not. */
export function showCafeOwnerName(input: {
  desk?: boolean
  hasVerifiedOwner: boolean
}): boolean {
  return Boolean(input.desk && input.hasVerifiedOwner)
}

/** Visitors can flag a claimed listing. Owners and admins do not. */
export function showCafeOwnerReport(input: {
  desk?: boolean
  isAdmin?: boolean
  myClaimStatus: 'pending' | 'verified' | 'rejected' | null
  hasVerifiedOwner: boolean
}): boolean {
  if (input.desk || input.isAdmin) return false
  if (input.myClaimStatus === 'verified') return false
  return input.hasVerifiedOwner
}

export function cafeOwnerReportLabel(): string {
  return 'Report a mistaken claim'
}

export function cafeOwnerReportReason(): string {
  return 'Someone says this listing’s owner is a mistake.'
}

export function cafeOwnerReportDoneCopy(): string {
  return 'Reported. An admin will check who should manage this listing.'
}

export function cafeOwnerDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  return trimmed || 'Signed-in KapéBean'
}

export function cafeOwnerInitial(name: string | null | undefined): string {
  return cafeOwnerDisplayName(name).charAt(0).toUpperCase()
}

export function transferOwnershipTitle(cafeName: string, personName: string): string {
  return `Transfer ${cafeName} to ${personName}?`
}

export function assignOwnershipTitle(cafeName: string, personName: string): string {
  return `Assign ${cafeName} to ${personName}?`
}

export function transferOwnershipMessage(input: {
  claimed: boolean
  fromName?: string | null
  toName: string
}): string {
  if (input.claimed) {
    return `${input.toName} takes over hours, contact, and the logo. ${cafeOwnerDisplayName(input.fromName)} loses that access. This does not change publish status.`
  }
  return `${input.toName} can then edit hours, contact, and the logo — not publish status.`
}

export function transferOwnershipAction(claimed: boolean): string {
  return claimed ? 'Transfer ownership' : 'Assign owner'
}

export function transferOwnershipBusyLabel(): string {
  return 'Transferring…'
}

export function transferOwnershipDoneCopy(cafeName: string, personName: string): string {
  return `${personName} now manages ${cafeName}.`
}

export function missingShopOwnerSqlCopy(message: string): string | null {
  if (!/schema cache|does not exist|shop_verified_owner|admin_transfer_shop_ownership/i.test(message)) return null
  return 'Apply db/20261113_shop_verified_owner.sql in the SQL editor, then try again.'
}
