export function shopPendingName(shop: { pending_name?: string | null }): string | null {
  const value = shop.pending_name?.trim() ?? ''
  return value || null
}

export function shopEditorName(shop: { name: string; pending_name?: string | null }): string {
  return shopPendingName(shop) ?? shop.name
}

export function ownerNameReviewCopy(shop: { name: string; pending_name?: string | null }): string | null {
  const pending = shopPendingName(shop)
  if (!pending) return null
  return `Name change waiting on review. Visitors still see ${shop.name} until an admin accepts ${pending}.`
}

export function adminNameReviewCopy(shop: { name: string; pending_name?: string | null }): string | null {
  const pending = shopPendingName(shop)
  if (!pending) return null
  return `Owner asked to rename this to ${pending}. Live name stays ${shop.name} until you accept.`
}

export function nameReviewAcceptTitle(liveName: string, pendingName: string): string {
  return `Accept ${pendingName} for ${liveName}?`
}

export function nameReviewRejectTitle(pendingName: string): string {
  return `Reject ${pendingName}?`
}

export function nameReviewAcceptMessage(): string {
  return 'The live cafe name updates everywhere. The waiting change is cleared.'
}

export function nameReviewRejectMessage(liveName: string): string {
  return `The listing stays ${liveName}. The owner can send another name later.`
}
