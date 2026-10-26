import type { Ref } from 'vue'
import {
  ADMIN_TOAST_LIMIT,
  adminActionErrorMessage,
  adminToastDuration,
  adminToastMessage,
  type AdminToastVariant,
} from '~/utils/admin-feedback'

/**
 * Admin toasts, confirmation modals, and busy overlays.
 *
 * These helpers do not open their own Supabase client. Admin pages keep using
 * `useAdminData()` and `useSupabaseClient()`, which Nuxt configures from
 * `.env`: `SUPABASE_URL` and `SUPABASE_KEY` (staging reads
 * `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_KEY` first). See `nuxt.config.ts`.
 *
 * Mount once from `AdminShell`:
 * `<AdminToastStack />`, `<AdminConfirmHost />`, and `<AdminBusyOverlay />`.
 */

export interface AdminToast {
  id: string
  variant: AdminToastVariant
  title: string
  message: string
}

export interface AdminConfirmOptions {
  /** Dialog heading, including the question mark when it is a question. */
  title: string
  /** What will change, in one or two sentences. */
  message: string
  confirmLabel?: string
  cancelLabel?: string
  busyLabel?: string
  /**
   * `default` commits a publish or save.
   * `destructive` deletes, rejects, suspends, or unpublishes.
   * `warning` blocks an action or asks for caution without destroying data.
   */
  variant?: 'default' | 'destructive' | 'warning'
  /** One acknowledgement button. Used in place of `window.alert`. */
  alert?: boolean
  /** When set, the dialog asks for a short reason before it confirms. */
  promptLabel?: string
  promptMax?: number
  /**
   * Return an error sentence to keep the dialog open, or null when the prompt is valid.
   *
   * @example
   * validatePrompt: (value) => value.trim().length < 8 ? 'Say why this audit is voided.' : null
   */
  validatePrompt?: (value: string) => string | null
}

export interface AdminConfirmState {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  busyLabel: string
  variant: 'default' | 'destructive' | 'warning'
  alert: boolean
  promptLabel: string
  promptValue: string
  promptError: string
  promptMax: number
  busy: boolean
}

export interface AdminConfirmResult {
  confirmed: boolean
  /** Trimmed prompt. Empty when the dialog has no prompt or the admin cancelled. */
  prompt: string
}

interface AdminBusyState {
  message: string
}

let toastSeq = 0
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()
const toastRemaining = new Map<string, number>()
const toastStarted = new Map<string, number>()

let confirmResolve: ((result: AdminConfirmResult) => void) | null = null
let confirmValidate: ((value: string) => string | null) | null = null

function nextToastId(): string {
  toastSeq += 1
  return `kd-toast-${toastSeq}`
}

function clearToastTimer(id: string) {
  const timer = toastTimers.get(id)
  if (timer) clearTimeout(timer)
  toastTimers.delete(id)
  toastStarted.delete(id)
}

/**
 * Stack of admin toasts. Call from a page setup function.
 *
 * @example
 * const toast = useAdminToast()
 * toast.success('Published', 'Harbor is on Home and Map.')
 * toast.error('Could not publish', err, 'Could not publish this cafe.')
 * toast.info('Cafes imported', '3 cafes landed unpublished.')
 * toast.warning('Choose a cafe', 'Choose an approved cafe.')
 */
export function useAdminToast() {
  const toasts = useState<AdminToast[]>('kd-admin-toasts', () => [])

  function dismiss(id: string) {
    clearToastTimer(id)
    toastRemaining.delete(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function arm(id: string, ms: number) {
    clearToastTimer(id)
    toastRemaining.set(id, ms)
    if (!import.meta.client) return
    toastStarted.set(id, Date.now())
    toastTimers.set(id, setTimeout(() => dismiss(id), ms))
  }

  function push(variant: AdminToastVariant, title: string, message = ''): string {
    const toast: AdminToast = {
      id: nextToastId(),
      variant,
      title: title.trim() || 'Notice',
      message: message ? adminToastMessage(message) : '',
    }
    const next = [...toasts.value, toast].slice(-ADMIN_TOAST_LIMIT)
    const live = new Set(next.map((item) => item.id))
    for (const id of toastTimers.keys()) {
      if (!live.has(id)) clearToastTimer(id)
    }
    toasts.value = next
    arm(toast.id, adminToastDuration(variant))
    return toast.id
  }

  /** Pause auto-dismiss while the pointer or keyboard is on the toast. */
  function pause(id: string) {
    if (!toastTimers.has(id)) return
    const elapsed = Date.now() - (toastStarted.get(id) ?? Date.now())
    const left = Math.max(800, (toastRemaining.get(id) ?? 800) - elapsed)
    clearToastTimer(id)
    toastRemaining.set(id, left)
  }

  function resume(id: string) {
    if (toastTimers.has(id) || !toasts.value.some((toast) => toast.id === id)) return
    const left = toastRemaining.get(id)
    if (!left) return
    arm(id, left)
  }

  return {
    toasts,
    dismiss,
    pause,
    resume,
    /**
     * @param title Short outcome, such as "Published".
     * @param message Optional detail. Omit when the title is enough.
     */
    success(title: string, message = '') {
      return push('success', title, message)
    },
    /**
     * @param title What failed, such as "Could not delete".
     * @param err Thrown value, Error, or a ready-made sentence.
     * @param fallback Used when `err` has no message.
     */
    error(title: string, err?: unknown, fallback = 'Something went wrong. Try again.') {
      return push('error', title, adminActionErrorMessage(err, fallback))
    },
    info(title: string, message = '') {
      return push('info', title, message)
    },
    warning(title: string, message = '') {
      return push('warning', title, message)
    },
  }
}

function finishConfirm(result: AdminConfirmResult, dialog: Ref<AdminConfirmState | null>) {
  const resolve = confirmResolve
  confirmResolve = null
  confirmValidate = null
  dialog.value = null
  resolve?.(result)
}

/**
 * Accessible confirm and alert dialog shared by every admin page.
 * `AdminConfirmHost` renders it. A second call cancels the one still open.
 *
 * @example
 * const { ask, alert } = useAdminConfirm()
 * const choice = await ask({
 *   title: `Unpublish ${shop.name}?`,
 *   message: 'It leaves Home and Map until you publish it again.',
 *   confirmLabel: 'Unpublish',
 *   variant: 'destructive',
 * })
 * if (!choice.confirmed) return
 *
 * await alert({
 *   title: 'Role stays the same',
 *   message: 'You cannot remove the last admin.',
 *   variant: 'warning',
 * })
 */
export function useAdminConfirm() {
  const dialog = useState<AdminConfirmState | null>('kd-admin-confirm', () => null)

  function ask(options: AdminConfirmOptions): Promise<AdminConfirmResult> {
    if (import.meta.server) return Promise.resolve({ confirmed: false, prompt: '' })
    if (confirmResolve) finishConfirm({ confirmed: false, prompt: '' }, dialog)
    return new Promise((resolve) => {
      confirmResolve = resolve
      confirmValidate = options.validatePrompt ?? null
      dialog.value = {
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? (options.alert ? 'OK' : 'Continue'),
        cancelLabel: options.cancelLabel ?? 'Cancel',
        busyLabel: options.busyLabel ?? 'Working…',
        variant: options.variant ?? (options.alert ? 'warning' : 'default'),
        alert: Boolean(options.alert),
        promptLabel: options.promptLabel ?? '',
        promptValue: '',
        promptError: '',
        promptMax: options.promptMax ?? 280,
        busy: false,
      }
    })
  }

  function alert(options: Omit<AdminConfirmOptions, 'alert' | 'promptLabel' | 'validatePrompt'>) {
    return ask({ ...options, alert: true })
  }

  function setPrompt(value: string) {
    if (!dialog.value) return
    dialog.value = { ...dialog.value, promptValue: value, promptError: '' }
  }

  function accept() {
    const current = dialog.value
    if (!current || current.busy) return
    if (current.promptLabel && confirmValidate) {
      const issue = confirmValidate(current.promptValue)
      if (issue) {
        dialog.value = { ...current, promptError: issue }
        return
      }
    }
    finishConfirm({ confirmed: true, prompt: current.promptValue.trim() }, dialog)
  }

  function dismiss() {
    if (!dialog.value || dialog.value.busy) return
    finishConfirm({ confirmed: false, prompt: '' }, dialog)
  }

  return { dialog, ask, alert, setPrompt, accept, dismiss }
}

/**
 * Page-level busy overlay for longer admin writes (CSV import, bulk stamps).
 * Button spinners stay on the control that was pressed. Use the overlay when
 * the work covers more than one row.
 *
 * @example
 * const busy = useAdminBusy()
 * await busy.track('Importing cafes…', () => admin.importShops(drafts))
 */
export function useAdminBusy() {
  const overlay = useState<AdminBusyState | null>('kd-admin-busy', () => null)

  function show(message: string) {
    overlay.value = { message: message.trim() || 'Working…' }
  }

  function hide() {
    overlay.value = null
  }

  async function track<T>(message: string, run: () => Promise<T>): Promise<T> {
    show(message)
    try {
      return await run()
    } finally {
      hide()
    }
  }

  return { overlay, show, hide, track }
}
