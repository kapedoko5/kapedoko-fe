<template>
  <Teleport to="body">
    <div class="owner-toasts" aria-label="Notifications">
      <article
        v-for="toast in toasts"
        :key="toast.id"
        class="owner-toast"
        :class="`owner-toast--${toast.variant}`"
        :role="toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'"
        :aria-live="live(toast.variant)"
        @mouseenter="pause(toast.id)"
        @mouseleave="resume(toast.id)"
        @focusin="pause(toast.id)"
        @focusout="resume(toast.id)"
      >
        <div class="owner-toast__copy">
          <p class="owner-toast__title">{{ toast.title }}</p>
          <p v-if="toast.message" class="owner-toast__message">{{ toast.message }}</p>
        </div>
        <button
          type="button"
          class="owner-toast__close"
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
import { ownerToastLive, type OwnerToastVariant } from '~/utils/owner-feedback'

const { toasts, dismiss, pause, resume } = useOwnerToast()
const live = (variant: OwnerToastVariant) => ownerToastLive(variant)

onBeforeUnmount(() => {
  for (const toast of toasts.value) resume(toast.id)
})
</script>

<style scoped>
.owner-toasts {
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

.owner-toast {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: min(420px, 100%);
  margin-left: auto;
  padding: 12px 8px 12px 14px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  pointer-events: auto;
  caret-color: var(--kd-primary);
  animation: owner-toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.owner-toast--success {
  background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
}

.owner-toast--error {
  background: color-mix(in srgb, var(--kd-destructive) 10%, #faf8f5);
}

.owner-toast--warning {
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
}

.owner-toast__copy {
  flex: 1;
  min-width: 0;
}

.owner-toast__title,
.owner-toast__message {
  margin: 0;
}

.owner-toast__title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.owner-toast__message {
  margin-top: 4px;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-toast__close {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.owner-toast__close:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@keyframes owner-toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .owner-toast {
    animation: none;
  }
}
</style>
