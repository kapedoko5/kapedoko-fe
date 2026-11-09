import type { Ref } from 'vue'
import {
  OWNER_TOAST_LIMIT,
  ownerActionErrorMessage,
  ownerToastDuration,
  ownerToastMessage,
  type OwnerToastVariant,
} from '~/utils/owner-feedback'

export interface OwnerToast {
  id: string
  variant: OwnerToastVariant
  title: string
  message: string
}

export interface OwnerConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  busyLabel?: string
  variant?: 'default' | 'destructive' | 'warning'
  alert?: boolean
}

export interface OwnerConfirmState {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  busyLabel: string
  variant: 'default' | 'destructive' | 'warning'
  alert: boolean
  busy: boolean
}

export interface OwnerConfirmResult {
  confirmed: boolean
}

interface OwnerBusyState {
  message: string
}

let toastSeq = 0
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()
const toastRemaining = new Map<string, number>()
const toastStarted = new Map<string, number>()
let confirmResolve: ((result: OwnerConfirmResult) => void) | null = null

function nextToastId(): string {
  toastSeq += 1
  return `kd-owner-toast-${toastSeq}`
}

function clearToastTimer(id: string) {
  const timer = toastTimers.get(id)
  if (timer) clearTimeout(timer)
  toastTimers.delete(id)
  toastStarted.delete(id)
}

export function useOwnerToast() {
  const toasts = useState<OwnerToast[]>('kd-owner-toasts', () => [])

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

  function push(variant: OwnerToastVariant, title: string, message = ''): string {
    const toast: OwnerToast = {
      id: nextToastId(),
      variant,
      title: title.trim() || 'Notice',
      message: message ? ownerToastMessage(message) : '',
    }
    const next = [...toasts.value, toast].slice(-OWNER_TOAST_LIMIT)
    const live = new Set(next.map((item) => item.id))
    for (const id of toastTimers.keys()) {
      if (!live.has(id)) clearToastTimer(id)
    }
    toasts.value = next
    arm(toast.id, ownerToastDuration(variant))
    return toast.id
  }

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
    success(title: string, message = '') {
      return push('success', title, message)
    },
    error(title: string, err?: unknown, fallback = 'Something went wrong. Try again.') {
      return push('error', title, ownerActionErrorMessage(err, fallback))
    },
    info(title: string, message = '') {
      return push('info', title, message)
    },
    warning(title: string, message = '') {
      return push('warning', title, message)
    },
  }
}

function finishConfirm(result: OwnerConfirmResult, dialog: Ref<OwnerConfirmState | null>) {
  const resolve = confirmResolve
  confirmResolve = null
  dialog.value = null
  resolve?.(result)
}

export function useOwnerConfirm() {
  const dialog = useState<OwnerConfirmState | null>('kd-owner-confirm', () => null)

  function ask(options: OwnerConfirmOptions): Promise<OwnerConfirmResult> {
    if (import.meta.server) return Promise.resolve({ confirmed: false })
    if (confirmResolve) finishConfirm({ confirmed: false }, dialog)
    return new Promise((resolve) => {
      confirmResolve = resolve
      dialog.value = {
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? (options.alert ? 'OK' : 'Continue'),
        cancelLabel: options.cancelLabel ?? 'Cancel',
        busyLabel: options.busyLabel ?? 'Working…',
        variant: options.variant ?? (options.alert ? 'warning' : 'default'),
        alert: Boolean(options.alert),
        busy: false,
      }
    })
  }

  function alert(options: Omit<OwnerConfirmOptions, 'alert'>) {
    return ask({ ...options, alert: true })
  }

  function accept() {
    const current = dialog.value
    if (!current || current.busy) return
    finishConfirm({ confirmed: true }, dialog)
  }

  function dismiss() {
    if (!dialog.value || dialog.value.busy) return
    finishConfirm({ confirmed: false }, dialog)
  }

  return { dialog, ask, alert, accept, dismiss }
}

export function useOwnerBusy() {
  const overlay = useState<OwnerBusyState | null>('kd-owner-busy', () => null)

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
