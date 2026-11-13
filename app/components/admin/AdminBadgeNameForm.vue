<template>
  <form class="admin-panel admin-form" @submit.prevent="onSubmit">
    <label class="admin-field">
      Badge name
      <input v-model="draft.label" maxlength="40" required placeholder="Hidden Gem" />
    </label>
    <p v-if="issues.label" class="admin-error">{{ issues.label }}</p>
    <p class="admin-meta admin-span">Slug {{ slugPreview || '—' }}</p>

    <fieldset class="admin-field admin-span">
      <legend>Color</legend>
      <div class="badge-color">
        <input v-model="draft.color" type="color" :aria-label="`Badge color ${draft.color}`" @input="onColorSwatch" />
        <input
          v-model="draft.color"
          class="badge-color__hex"
          maxlength="7"
          spellcheck="false"
          aria-label="Badge color hex"
          @change="draft.color = normalizeBadgeColor(draft.color)"
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
      <div class="badge-icons" role="listbox" aria-label="Badge icons">
        <button
          v-for="item in iconOptions"
          :key="item.id"
          type="button"
          class="badge-icons__cell"
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

    <label class="admin-field">
      Custom icon
      <input type="file" accept="image/jpeg,image/png,image/webp" @change="onFile" />
    </label>
    <p v-if="issues.icon" class="admin-error">{{ issues.icon }}</p>
    <p v-if="draft.iconObjectKey && !draft.iconFile && !draft.clearIcon" class="admin-meta admin-span">
      Using the current custom icon. Choose a file only to replace it.
    </p>
    <button
      v-if="(draft.iconFile || draft.iconObjectKey) && !draft.clearIcon"
      type="button"
      class="admin-btn admin-btn--quiet"
      @click="clearCustomIcon"
    >
      Remove custom icon
    </button>

    <label v-if="badge" class="admin-field">
      <input v-model="draft.enabled" type="checkbox" />
      Enabled
    </label>

    <p class="admin-span admin-label">Preview</p>
    <p class="admin-span">
      <CafeBadgeChip :badge="previewBadge" />
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
import type { BadgeLucideId, BadgeNameRow, CafeBadge } from '~/types/admin'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import CafeBadgeChip from '~/components/cafe/CafeBadgeChip.vue'
import { publicObjectUrl } from '~/utils/shop-mapper'
import {
  BADGE_DEFAULT_COLOR,
  BADGE_DEFAULT_LUCIDE,
  badgeIconFileError,
  badgeLabelError,
  badgeSlugFromLabel,
  cafeBadgeFromName,
  isBadgeColor,
  normalizeBadgeColor,
  resolveBadgeLucideId,
  searchBadgeLucideIcons,
} from '~/utils/admin-badges'

const props = withDefaults(defineProps<{
  badge?: BadgeNameRow | null
  saving?: boolean
  submitLabel?: string
  publicBase?: string
  formError?: string
}>(), {
  badge: null,
  saving: false,
  submitLabel: 'Save badge',
  publicBase: '',
  formError: '',
})

const emit = defineEmits<{
  save: [payload: {
    label: string
    color: string
    lucide_icon: BadgeLucideId
    iconFile: File | null
    icon_object_key: string | null
    clearIcon: boolean
    enabled: boolean
  }]
}>()

const emptyDraft = () => ({
  label: props.badge?.label ?? '',
  color: normalizeBadgeColor(props.badge?.color ?? BADGE_DEFAULT_COLOR),
  lucideIcon: resolveBadgeLucideId(props.badge?.lucide_icon ?? BADGE_DEFAULT_LUCIDE),
  iconFile: null as File | null,
  iconObjectKey: props.badge?.icon_object_key ?? null,
  clearIcon: false,
  enabled: props.badge?.enabled !== false,
  previewUrl: '',
})

const draft = reactive(emptyDraft())
const iconQuery = ref('')
const issues = reactive({ label: null as string | null, color: null as string | null, icon: null as string | null })

const slugPreview = computed(() => (
  props.badge?.slug || badgeSlugFromLabel(draft.label)
))
const iconOptions = computed(() => searchBadgeLucideIcons(iconQuery.value))
const previewBadge = computed<CafeBadge>(() => cafeBadgeFromName({
  id: props.badge?.id ?? 'preview',
  slug: slugPreview.value || 'preview',
  label: draft.label.trim() || 'Badge name',
  color: draft.color,
  lucide_icon: draft.lucideIcon,
  iconUrl: draft.clearIcon
    ? null
    : (draft.previewUrl || publicObjectUrl(draft.iconObjectKey, props.publicBase)),
}))

const onColorSwatch = (event: Event) => {
  const input = event.target as HTMLInputElement
  draft.color = normalizeBadgeColor(input.value)
}

const clearCustomIcon = () => {
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl)
  draft.iconFile = null
  draft.previewUrl = ''
  draft.clearIcon = true
}

const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  issues.icon = badgeIconFileError(file)
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl)
  draft.iconFile = issues.icon ? null : file
  draft.previewUrl = draft.iconFile ? URL.createObjectURL(draft.iconFile) : ''
  draft.clearIcon = false
  if (issues.icon) input.value = ''
}

const onSubmit = () => {
  issues.label = badgeLabelError(draft.label)
  issues.color = isBadgeColor(draft.color) ? null : 'Use a hex color like #1F6F6B.'
  issues.icon = badgeIconFileError(draft.iconFile)
  if (issues.label || issues.color || issues.icon) return
  emit('save', {
    label: draft.label.trim().replace(/\s+/g, ' '),
    color: normalizeBadgeColor(draft.color),
    lucide_icon: draft.lucideIcon,
    iconFile: draft.iconFile,
    icon_object_key: draft.clearIcon ? null : draft.iconObjectKey,
    clearIcon: draft.clearIcon,
    enabled: draft.enabled,
  })
}

watch(
  () => props.badge?.id,
  () => {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl)
    Object.assign(draft, emptyDraft())
    iconQuery.value = ''
    issues.label = null
    issues.color = null
    issues.icon = null
  },
)

onBeforeUnmount(() => {
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl)
})
</script>

<style scoped>
.badge-color {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.badge-color input[type='color'] {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  cursor: pointer;
}

.badge-color__hex {
  width: 8rem;
  min-height: 44px;
  padding: 0 12px;
  font-variant-numeric: tabular-nums;
}

.badge-icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
}

.badge-icons__cell {
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

.badge-icons__cell.is-selected {
  border-color: var(--kd-accent);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
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
</style>
