export const OWNER_TOAST_LIMIT = 4

export const OWNER_TOAST_VARIANTS = ['success', 'error', 'info', 'warning'] as const

export type OwnerToastVariant = (typeof OWNER_TOAST_VARIANTS)[number]

export function isOwnerToastVariant(value: string): value is OwnerToastVariant {
  return (OWNER_TOAST_VARIANTS as readonly string[]).includes(value)
}

export function ownerToastDuration(variant: OwnerToastVariant): number {
  if (variant === 'error') return 7000
  if (variant === 'warning') return 5600
  return 4200
}

export function ownerToastLive(variant: OwnerToastVariant): 'assertive' | 'polite' {
  return variant === 'error' || variant === 'warning' ? 'assertive' : 'polite'
}

export function ownerActionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === 'string' && err.trim()) return err.trim()
  return fallback
}

export function ownerToastMessage(message: string, limit = 180): string {
  const trimmed = message.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, Math.max(1, limit - 1)).trimEnd()}…`
}
