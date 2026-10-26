<template>
  <Teleport to="body">
    <div class="admin-toasts" aria-label="Notifications">
      <article
        v-for="toast in toasts"
        :key="toast.id"
        class="admin-toast"
        :class="`admin-toast--${toast.variant}`"
        :role="toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'"
        :aria-live="live(toast.variant)"
        @mouseenter="pause(toast.id)"
        @mouseleave="resume(toast.id)"
        @focusin="pause(toast.id)"
        @focusout="resume(toast.id)"
      >
        <div class="admin-toast__copy">
          <p class="admin-toast__title">{{ toast.title }}</p>
          <p v-if="toast.message" class="admin-toast__message">{{ toast.message }}</p>
        </div>
        <button
          type="button"
          class="admin-toast__close"
          :aria-label="`Dismiss ${toast.title}`"
          @click="dismiss(toast.id)"
        >
          Close
        </button>
      </article>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
/**
 * Toast stack for admin writes. Mounted by `AdminShell`.
 * Variants are `success`, `error`, `info`, and `warning`.
 * Push them with `useAdminToast()`.
 */
import { adminToastLive, type AdminToastVariant } from '~/utils/admin-feedback'

const { toasts, dismiss, pause, resume } = useAdminToast()
const live = (variant: AdminToastVariant) => adminToastLive(variant)

onBeforeUnmount(() => {
  for (const toast of toasts.value) resume(toast.id)
})
</script>

<style scoped>
.admin-toasts {
  position: fixed;
  z-index: 45;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  pointer-events: none;
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.admin-toast {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: min(420px, 100%);
  margin-left: auto;
  padding: 12px 8px 12px 14px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-left-width: 4px;
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--kd-ink) 12%, transparent);
  pointer-events: auto;
  caret-color: var(--kd-primary);
  animation: admin-toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.admin-toast--success {
  border-left-color: var(--kd-primary);
}

.admin-toast--error {
  border-left-color: var(--kd-destructive);
}

.admin-toast--warning {
  border-left-color: var(--kd-accent);
}

.admin-toast--info {
  border-left-color: color-mix(in srgb, var(--kd-ink) 55%, #faf8f5);
}

.admin-toast__copy {
  min-width: 0;
  flex: 1 1 auto;
  padding-top: 6px;
}

.admin-toast__title,
.admin-toast__message {
  margin: 0;
}

.admin-toast__title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.admin-toast__message {
  margin-top: 4px;
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.35;
}

.admin-toast__close {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.admin-toast__close:hover {
  background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
}

.admin-toast__close:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.admin-toast ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

@media (min-width: 768px) {
  .admin-toasts {
    top: 16px;
    right: 16px;
    left: auto;
    width: min(420px, calc(100vw - 32px));
    padding: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-toast {
    animation: none;
  }
}

@keyframes admin-toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
