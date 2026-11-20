<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="features-scrim"
      @click="onScrim"
    >
      <div
        ref="dialogEl"
        class="features-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="titleId"
        @click.stop
        @keydown="onKeydown"
      >
        <h2 :id="titleId" class="features-dialog__title">{{ title }}</h2>
        <p class="features-dialog__lede">
          {{ kindLabel }} defaults are checked. Always-on listing tools stay on. Turn extras on or off for this cafe.
        </p>

        <p class="features-dialog__group">Always on</p>
        <ul class="features-dialog__list">
          <li v-for="item in alwaysOn" :key="item.id">
            <label class="features-dialog__row is-locked">
              <input type="checkbox" checked disabled />
              <span>
                <span class="features-dialog__label">{{ item.label }}</span>
                <span class="features-dialog__hint">{{ item.hint }}</span>
              </span>
            </label>
          </li>
        </ul>

        <p class="features-dialog__group">{{ kindLabel }} extras</p>
        <ul class="features-dialog__list">
          <li>
            <div class="features-dialog__row is-locked features-dialog__row--pin">
              <AdminPlacementPinPreview
                :kind="kind"
                :cafe-name="cafeName"
                :logo-src="logoSrc"
              />
              <span>
                <span class="features-dialog__label">Map pin</span>
                <span class="features-dialog__hint">{{ pinHint }}</span>
              </span>
            </div>
          </li>
          <li v-for="item in toggles" :key="item.id">
            <label class="features-dialog__row">
              <input v-model="draft[item.id]" type="checkbox" />
              <span>
                <span class="features-dialog__label">{{ item.label }}</span>
                <span class="features-dialog__hint">{{ item.hint }}</span>
              </span>
            </label>
          </li>
        </ul>

        <div class="features-dialog__actions">
          <button type="button" class="features-dialog__btn features-dialog__btn--ghost" @click="reset">
            Use {{ kindLabel.toLowerCase() }} defaults
          </button>
          <button type="button" class="features-dialog__btn features-dialog__btn--cancel" @click="emit('cancel')">
            Cancel
          </button>
          <button type="button" class="features-dialog__btn features-dialog__btn--confirm" @click="onConfirm">
            Use these features
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import AdminPlacementPinPreview from '~/components/admin/AdminPlacementPinPreview.vue'
import {
  ALWAYS_ON_PLACEMENT_FEATURES,
  TOGGLE_PLACEMENT_FEATURES,
  defaultPlacementFeatures,
  type PlacementFeatures,
} from '~/utils/placement-features'

const props = defineProps<{
  open: boolean
  cafeName: string
  kind: 'partner' | 'sponsored'
  features: PlacementFeatures
  logoSrc?: string | null
}>()

const emit = defineEmits<{
  confirm: [features: PlacementFeatures]
  cancel: []
}>()

const titleId = `placement-features-${Math.random().toString(36).slice(2, 8)}`
const dialogEl = ref<HTMLElement | null>(null)
const alwaysOn = ALWAYS_ON_PLACEMENT_FEATURES
const toggles = TOGGLE_PLACEMENT_FEATURES
const kindLabel = computed(() => props.kind === 'sponsored' ? 'Sponsored' : 'Partner')
const title = computed(() => props.cafeName ? `Features for ${props.cafeName}` : 'Partnership features')
const pinHint = computed(() => {
  if (props.kind === 'sponsored') {
    return props.logoSrc
      ? 'Sponsored logo pin. Always on for this window.'
      : 'Sponsored pin. Add a cafe logo to fill the circle. Always on for this window.'
  }
  return 'Partner cup pin. Always on for this window.'
})
const draft = reactive<PlacementFeatures>(defaultPlacementFeatures('partner'))

const syncDraft = () => {
  Object.assign(draft, props.features)
}

watch(() => [props.open, props.kind, props.cafeName, JSON.stringify(props.features)].join('|'), () => {
  if (props.open) syncDraft()
}, { immediate: true })

const reset = () => {
  Object.assign(draft, defaultPlacementFeatures(props.kind))
}

const onConfirm = () => {
  emit('confirm', { ...draft })
}

const onScrim = () => emit('cancel')

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  }
}

watch(() => props.open, async (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    await nextTick()
    dialogEl.value?.focus()
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<style scoped>
.features-scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: end center;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--kd-ink) 46%, transparent);
}

.features-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(460px, 100%);
  max-height: min(88vh, 720px);
  overflow: auto;
  padding: 20px 16px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
}

.features-dialog__title {
  margin: 0;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.features-dialog__lede,
.features-dialog__hint {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.35;
  font-weight: 400;
}

.features-dialog__group {
  margin: 8px 0 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.features-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.features-dialog__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 12px;
  cursor: pointer;
}

.features-dialog__row.is-locked {
  cursor: default;
  background: color-mix(in srgb, var(--kd-ink) 5%, #faf8f5);
}

.features-dialog__row--pin {
  align-items: center;
}

.features-dialog__row input {
  margin-top: 3px;
  flex: 0 0 auto;
}

.features-dialog__label,
.features-dialog__hint {
  display: block;
}

.features-dialog__label {
  font-size: 0.9rem;
  font-weight: 700;
}

.features-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.features-dialog__btn {
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

.features-dialog__btn--ghost,
.features-dialog__btn--cancel {
  border: 1px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
}

.features-dialog__btn--confirm {
  border: 1px solid var(--kd-accent);
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.features-dialog__btn:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (min-width: 540px) {
  .features-scrim {
    place-items: center;
    padding: 20px;
  }

  .features-dialog__actions {
    display: grid;
    grid-template-columns: 1fr auto auto;
  }
}
</style>
