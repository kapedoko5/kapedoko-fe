/**
 * Copy and timing helpers for admin toasts.
 *
 * Variants:
 * - `success` — a Supabase write finished (publish, save, approve).
 * - `error` — the write failed. Shown longer, announced assertively.
 * - `info` — a finished read or a navigation note, such as an import landing.
 * - `warning` — the action was blocked before it ran (validation, last admin).
 *
 * @example
 * adminToastDuration('error') // 7000
 * adminToastMessage('  Could   not save  ') // 'Could not save'
 */

export const ADMIN_TOAST_LIMIT = 4

export const ADMIN_TOAST_VARIANTS = ['success', 'error', 'info', 'warning'] as const

export type AdminToastVariant = (typeof ADMIN_TOAST_VARIANTS)[number]

export function isAdminToastVariant(value: string): value is AdminToastVariant {
  return (ADMIN_TOAST_VARIANTS as readonly string[]).includes(value)
}

/** How long a toast stays before it dismisses itself, in milliseconds. */
export function adminToastDuration(variant: AdminToastVariant): number {
  if (variant === 'error') return 7000
  if (variant === 'warning') return 5600
  return 4200
}

/** Errors and warnings interrupt. Success and info wait for a pause in speech. */
export function adminToastLive(variant: AdminToastVariant): 'assertive' | 'polite' {
  return variant === 'error' || variant === 'warning' ? 'assertive' : 'polite'
}

/**
 * Turn a thrown Supabase or RPC error into a sentence for a toast or inline alert.
 * Blank errors fall back to `fallback` so the UI never shows an empty failure.
 */
export function adminActionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === 'string' && err.trim()) return err.trim()
  return fallback
}

/** Collapse whitespace and keep toast body copy short enough for a phone. */
export function adminToastMessage(message: string, limit = 180): string {
  const trimmed = message.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, Math.max(1, limit - 1)).trimEnd()}…`
}
