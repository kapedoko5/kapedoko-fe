<template>
  <form class="admin-panel admin-form" @submit.prevent="onSubmit">
    <label class="admin-field">
      Tag name
      <input v-model="draft.label" maxlength="40" required placeholder="Quiet" />
    </label>
    <p v-if="issues.label" class="admin-error">{{ issues.label }}</p>
    <p class="admin-meta admin-span">Slug {{ slugPreview || '—' }}</p>

    <fieldset class="admin-field admin-span">
      <legend>Color</legend>
      <p class="admin-meta">Fill and border of the stamp on cards and cafe detail.</p>
      <div class="vibe-color">
        <input v-model="draft.color" type="color" :aria-label="`Stamp color ${draft.color}`" @input="onColorSwatch" />
        <input
          v-model="draft.color"
          class="vibe-color__hex"
          maxlength="7"
          spellcheck="false"
          aria-label="Stamp color hex"
          @change="draft.color = normalizeVibeTagColor(draft.color)"
        />
      </div>
    </fieldset>
    <p v-if="issues.color" class="admin-error">{{ issues.color }}</p>

    <fieldset class="admin-field admin-span">
      <legend>Icon</legend>
      <label class="admin-field">
        <span class="sr-only">Search icons</span>
        <input v-model="iconQuery" type="search" placeholder="Search icons" />
      </label>
      <div class="vibe-icons" role="listbox" aria-label="Vibe tag icons">
        <button
          v-for="item in iconOptions"
          :key="item.id"
          type="button"
          class="vibe-icons__cell"
          role="option"
          :class="{ 'is-selected': draft.lucideIcon === item.id }"
          :aria-selected="draft.lucideIcon === item.id"
          :aria-label="item.label"
          @click="draft.lucideIcon = item.id"
        >
          <component :is="item.icon" :size="18" :stroke-width="2.25" aria-hidden="true" />
        </button>
      </div>
    </fieldset>

    <label v-if="tag" class="admin-field">
      <input v-model="draft.enabled" type="checkbox" />
      Enabled
    </label>

    <p class="admin-span admin-label">Preview</p>
    <p class="admin-span">
      <span class="vibe-preview" aria-hidden="true" :style="vibeTagColorStyle(draft.color)">
        <span class="vibe-preview__noun">
          <component :is="vibeTagLucideComponent(draft.lucideIcon)" :size="15" :stroke-width="2.25" />
          {{ draft.label.trim() || 'Quiet' }}
        </span>
      </span>
    </p>

    <div class="admin-span admin-row-actions">
      <p v-if="formError" class="admin-error">{{ formError }}</p>
      <button class="admin-btn" type="submit" :disabled="saving" :aria-busy="saving || undefined">
        <AdminBusyLabel :busy="saving">
          {{ saving ? 'Saving…' : submitLabel }}
        </AdminBusyLabel>
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { VibeTagLucideId, VibeTagNameRow } from '~/types/admin'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import {
  VIBE_TAG_DEFAULT_COLOR,
  VIBE_TAG_DEFAULT_LUCIDE,
  isVibeTagColor,
  normalizeVibeTagColor,
  resolveVibeTagLucideId,
  searchVibeTagLucideIcons,
  vibeTagColorStyle,
  vibeTagLabelError,
  vibeTagLucideComponent,
  vibeTagSlugFromLabel,
} from '~/utils/admin-vibe-tags'

const props = withDefaults(defineProps<{
  tag?: VibeTagNameRow | null
  saving?: boolean
  submitLabel?: string
  formError?: string
}>(), {
  tag: null,
  saving: false,
  submitLabel: 'Save vibe tag',
  formError: '',
})

const emit = defineEmits<{
  save: [payload: {
    label: string
    lucide_icon: VibeTagLucideId
    color: string
    enabled: boolean
  }]
}>()

const emptyDraft = () => ({
  label: props.tag?.label ?? '',
  lucideIcon: resolveVibeTagLucideId(props.tag?.lucide_icon ?? VIBE_TAG_DEFAULT_LUCIDE),
  color: normalizeVibeTagColor(props.tag?.color ?? VIBE_TAG_DEFAULT_COLOR),
  enabled: props.tag?.enabled !== false,
})

const draft = reactive(emptyDraft())
const iconQuery = ref('')
const issues = reactive({ label: null as string | null, color: null as string | null })
const slugPreview = computed(() => props.tag?.slug || vibeTagSlugFromLabel(draft.label))
const iconOptions = computed(() => searchVibeTagLucideIcons(iconQuery.value))

const onColorSwatch = (event: Event) => {
  const input = event.target as HTMLInputElement
  draft.color = normalizeVibeTagColor(input.value)
}

const onSubmit = () => {
  issues.label = vibeTagLabelError(draft.label)
  issues.color = isVibeTagColor(draft.color) ? null : 'Use a hex color like #D9793B.'
  if (issues.label || issues.color) return
  emit('save', {
    label: draft.label.trim().replace(/\s+/g, ' '),
    lucide_icon: draft.lucideIcon,
    color: normalizeVibeTagColor(draft.color),
    enabled: draft.enabled,
  })
}

watch(
  () => props.tag?.id,
  () => {
    Object.assign(draft, emptyDraft())
    iconQuery.value = ''
    issues.label = null
    issues.color = null
  },
)
</script>

<style scoped>
.vibe-color {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.vibe-color input[type='color'] {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  cursor: pointer;
}

.vibe-color__hex {
  width: 8rem;
  min-height: 44px;
  padding: 0 12px;
  font-variant-numeric: tabular-nums;
}

.vibe-icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
}

.vibe-icons__cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 18%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  color: var(--kd-ink);
  cursor: pointer;
}

.vibe-icons__cell.is-selected {
  border-color: var(--kd-accent);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
}

.vibe-preview {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--vibe-color, #d9793b);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vibe-color, #d9793b) 22%, #faf8f5);
  color: #1c1917;
  transform: rotate(-1.4deg);
}

.vibe-preview__noun {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.vibe-preview__noun :deep(svg) {
  color: var(--vibe-color, #d9793b);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .vibe-preview {
    transform: none;
  }
}
</style>
