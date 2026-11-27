<template>
  <section class="vibe-picker" :aria-labelledby="titleId">
    <header class="vibe-picker__head">
      <h2 :id="titleId">Vibe stamps</h2>
      <p class="vibe-picker__count" aria-live="polite">{{ vibeTagPickerCount(modelValue.length, hiddenCount) }}</p>
    </header>
    <p class="vibe-picker__lede">{{ lede }}</p>
    <p v-if="status === 'loading'" class="vibe-picker__meta">Loading stamps…</p>
    <p v-else-if="status === 'error'" class="vibe-picker__error">Could not load vibe tags.</p>
    <p v-else-if="!tags.length" class="vibe-picker__meta">{{ emptyCopy }}</p>
    <div
      v-else
      class="vibe-picker__sheet"
      role="listbox"
      aria-multiselectable="true"
      aria-label="Vibe stamps"
    >
      <button
        v-for="(tag, index) in tags"
        :key="tag.id"
        type="button"
        class="vibe-picker__stamp"
        role="option"
        :class="{ 'is-on': isOn(tag.id), 'is-muted': isMuted(tag.id) }"
        :style="{ '--tilt': index % 2 ? '1.6deg' : '-1.4deg', ...vibeTagColorStyle(tag.color) }"
        :aria-selected="isOn(tag.id)"
        :disabled="isMuted(tag.id)"
        :aria-label="tag.label"
        @click="toggle(tag.id)"
      >
        <span class="vibe-picker__noun">
          <component :is="vibeTagLucideComponent(tag.lucide_icon)" :size="15" :stroke-width="2.25" aria-hidden="true" />
          {{ tag.label }}
        </span>
      </button>
    </div>
    <p v-if="hiddenCount" class="vibe-picker__meta">
      {{ hiddenCount }} disabled stamp{{ hiddenCount === 1 ? '' : 's' }} still count toward {{ VIBE_TAG_MAX }}.
    </p>
    <p v-if="issue" class="vibe-picker__error" role="alert">{{ issue }}</p>
  </section>
</template>

<script lang="ts" setup>
import type { VibeTagNameRow } from '~/types/admin'
import {
  VIBE_TAG_MAX,
  vibeTagColorStyle,
  vibeTagCountError,
  vibeTagLucideComponent,
  vibeTagPickerCount,
} from '~/utils/admin-vibe-tags'

const props = withDefaults(defineProps<{
  modelValue: string[]
  tags: VibeTagNameRow[]
  hiddenCount?: number
  issue?: string | null
  status?: 'loading' | 'ready' | 'error'
  lede?: string
  emptyCopy?: string
}>(), {
  hiddenCount: 0,
  issue: null,
  status: 'ready',
  lede: 'Ink up to five stamps. They print on the cafe bag and cafe page, and guests can filter Home by them.',
  emptyCopy: 'No vibe tags yet. Ask an admin to add some.',
})

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
  issue: [message: string | null]
}>()

const titleId = `vibe-picker-${useId()}`
const remaining = computed(() => Math.max(0, VIBE_TAG_MAX - props.hiddenCount))

const isOn = (id: string) => props.modelValue.includes(id)
const isMuted = (id: string) => !isOn(id) && props.modelValue.length >= remaining.value

const toggle = (id: string) => {
  if (isMuted(id)) {
    emit('issue', vibeTagCountError(props.modelValue.length + 1, props.hiddenCount))
    return
  }
  const next = isOn(id)
    ? props.modelValue.filter((item) => item !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
  emit('issue', vibeTagCountError(next.length, props.hiddenCount))
}
</script>

<style scoped>
.vibe-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.vibe-picker__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.vibe-picker__head h2,
.vibe-picker__lede,
.vibe-picker__meta,
.vibe-picker__error,
.vibe-picker__count {
  margin: 0;
  color: var(--kd-ink);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.vibe-picker__head h2 {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.vibe-picker__count,
.vibe-picker__lede,
.vibe-picker__meta {
  font-size: 0.75rem;
  line-height: 1.3;
}

.vibe-picker__count {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.vibe-picker__error {
  color: var(--kd-destructive, #8c3a2f);
  font-size: 0.7875rem;
  font-weight: 700;
}

.vibe-picker__sheet {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 4px 2px 8px;
}

.vibe-picker__stamp {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--vibe-color, #d9793b);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vibe-color, #d9793b) 10%, #faf8f5);
  color: var(--kd-ink);
  transform: rotate(var(--tilt, -1.4deg));
  transform-origin: 30% 80%;
  cursor: pointer;
  transition:
    background-color 160ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.vibe-picker__stamp:hover,
.vibe-picker__stamp:focus-visible {
  background: color-mix(in srgb, var(--vibe-color, #d9793b) 18%, #faf8f5);
}

.vibe-picker__stamp:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.vibe-picker__stamp.is-on {
  background: color-mix(in srgb, var(--vibe-color, #d9793b) 28%, #faf8f5);
  border-color: var(--vibe-color, #d9793b);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--kd-ink) 18%, transparent);
}

.vibe-picker__stamp:active:not(:disabled) {
  transform: rotate(var(--tilt, -1.4deg)) scale(0.98);
}

.vibe-picker__stamp.is-muted {
  opacity: 0.45;
  cursor: not-allowed;
}

.vibe-picker__noun {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.vibe-picker__noun :deep(svg) {
  color: var(--vibe-color, #d9793b);
}

@media (prefers-reduced-motion: reduce) {
  .vibe-picker__stamp {
    transform: none;
    transition: background-color 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .vibe-picker__stamp:active:not(:disabled) {
    transform: none;
  }
}

:root.is-android .vibe-picker__stamp {
  min-height: 48px;
}
</style>
