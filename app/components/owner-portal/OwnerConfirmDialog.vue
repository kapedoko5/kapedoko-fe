<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm-scrim"
      @click="onScrim"
    >
      <div
        ref="dialogEl"
        class="confirm-dialog"
        :class="{
          'is-destructive': variant === 'destructive',
          'is-warning': variant === 'warning',
        }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
        :aria-busy="busy ? 'true' : undefined"
        @click.stop
        @keydown="onKeydown"
      >
        <h2 :id="titleId" class="confirm-dialog__title">{{ title }}</h2>
        <p :id="messageId" class="confirm-dialog__message">{{ message }}</p>
        <div class="confirm-dialog__actions">
          <button
            v-if="!alert"
            ref="cancelEl"
            type="button"
            class="confirm-dialog__btn confirm-dialog__btn--cancel"
            :disabled="busy"
            @click="emit('cancel')"
          >
            {{ cancelLabel }}
          </button>
          <button
            ref="confirmEl"
            type="button"
            class="confirm-dialog__btn confirm-dialog__btn--confirm"
            :class="{ 'is-destructive': variant === 'destructive' }"
            :disabled="busy"
            :aria-busy="busy || undefined"
            @click="emit('confirm')"
          >
            <OwnerBusyLabel :busy="busy">{{ busy ? busyLabel : confirmLabel }}</OwnerBusyLabel>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  busyLabel?: string
  variant?: 'default' | 'destructive' | 'warning'
  alert?: boolean
  busy?: boolean
}>(), {
  confirmLabel: 'Continue',
  cancelLabel: 'Cancel',
  busyLabel: 'Working…',
  variant: 'default',
  alert: false,
  busy: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogEl = ref<HTMLElement | null>(null)
const cancelEl = ref<HTMLButtonElement | null>(null)
const confirmEl = ref<HTMLButtonElement | null>(null)
const titleId = `kd-owner-confirm-title-${useId()}`
const messageId = `kd-owner-confirm-message-${useId()}`

const focusables = () => [cancelEl.value, confirmEl.value].filter((el): el is HTMLButtonElement => Boolean(el && !el.disabled))

const onScrim = () => {
  if (props.busy) return
  emit('cancel')
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (props.busy) return
    event.preventDefault()
    emit('cancel')
    return
  }
  if (event.key !== 'Tab') return
  const nodes = focusables()
  if (nodes.length === 0) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.open, async (open) => {
  if (!import.meta.client) return
  if (!open) {
    document.body.style.overflow = ''
    return
  }
  document.body.style.overflow = 'hidden'
  await nextTick()
  ;(props.alert ? confirmEl.value : cancelEl.value)?.focus()
})

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<style scoped>
.confirm-scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: end center;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--kd-ink) 46%, transparent);
  caret-color: var(--kd-primary);
}

.confirm-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(420px, 100%);
  padding: 20px 16px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
}

.confirm-dialog.is-destructive {
  border-color: color-mix(in srgb, var(--kd-destructive) 38%, #faf8f5);
}

.confirm-dialog.is-warning {
  border-color: color-mix(in srgb, var(--kd-accent) 70%, #faf8f5);
}

.confirm-dialog__title {
  margin: 0;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.confirm-dialog__message {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.confirm-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.confirm-dialog__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 16px;
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.confirm-dialog__btn--cancel {
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: transparent;
  color: var(--kd-ink);
}

.confirm-dialog__btn--confirm {
  border: 1px solid var(--kd-accent);
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.confirm-dialog__btn--confirm.is-destructive {
  border-color: var(--kd-destructive);
  background: var(--kd-destructive);
  color: #faf8f5;
}

.confirm-dialog__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.confirm-dialog__btn:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

:root.is-android .confirm-dialog__btn {
  min-height: 48px;
}
</style>
