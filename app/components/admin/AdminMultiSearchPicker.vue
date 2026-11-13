<template>
  <div class="admin-picker">
    <button
      ref="triggerRef"
      type="button"
      class="admin-picker__trigger"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-controls="dialogId"
      :aria-required="required || undefined"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedBy || undefined"
      :class="{ 'is-invalid': invalid }"
      :disabled="disabled"
      @click="openDialog"
    >
      <span class="admin-picker__value" :class="{ 'is-placeholder': selected.length === 0 }">
        {{ triggerCopy }}
      </span>
      <ChevronDown class="admin-picker__chevron" :size="18" :stroke-width="2.25" aria-hidden="true" />
    </button>

    <ul v-if="selected.length > 0" class="admin-picker__chips">
      <li v-for="option in selected" :key="option.id">
        <span>{{ option.title }}</span>
        <button type="button" class="admin-picker__chip-remove" :aria-label="`Remove ${option.title}`" @click="remove(option.id)">
          ×
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <dialog
        :id="dialogId"
        ref="dialogRef"
        class="admin-picker__dialog"
        :aria-labelledby="titleId"
        @close="onDialogClose"
        @click="onBackdropClick"
      >
        <form class="admin-picker__sheet" method="dialog" @submit.prevent>
          <h2 :id="titleId" class="admin-picker__title">{{ title }}</h2>
          <label class="admin-picker__search">
            <span class="sr-only">{{ searchPlaceholder }}</span>
            <input
              ref="searchRef"
              v-model="query"
              type="search"
              :placeholder="searchPlaceholder"
              autocomplete="off"
              :aria-controls="listId"
            />
          </label>
          <p class="admin-picker__count" aria-live="polite">{{ countCopy }}</p>
          <p v-if="status === 'loading'" class="admin-picker__status" role="status">{{ loadingCopy }}</p>
          <p v-else-if="status === 'error'" class="admin-picker__status admin-picker__status--error" role="alert">
            {{ errorCopy }}
          </p>
          <p v-else-if="options.length === 0" class="admin-picker__status">{{ emptyCopy }}</p>
          <p v-else-if="filtered.length === 0" class="admin-picker__status">{{ noMatchCopy }}</p>
          <ul
            v-else
            :id="listId"
            ref="listRef"
            class="admin-picker__list"
            role="listbox"
            :aria-multiselectable="true"
            :aria-label="title"
          >
            <li v-for="option in visible" :key="option.id">
              <button
                type="button"
                class="admin-picker__option"
                role="option"
                :class="{ 'is-selected': draft.has(option.id) }"
                :aria-selected="draft.has(option.id)"
                @click="toggle(option.id)"
              >
                <span class="admin-picker__tick" aria-hidden="true">{{ draft.has(option.id) ? '✓' : '' }}</span>
                <span class="admin-picker__option-copy">
                  <span class="admin-picker__option-title">{{ option.title }}</span>
                  <span v-if="option.subtitle" class="admin-picker__option-sub">{{ option.subtitle }}</span>
                </span>
              </button>
            </li>
            <li v-if="visible.length < filtered.length" ref="sentinelRef" class="admin-picker__sentinel" aria-hidden="true" />
          </ul>
          <div class="admin-picker__footer">
            <button type="button" class="admin-picker__cancel" @click="closeDialog">Cancel</button>
            <button type="button" class="admin-btn" @click="confirmDraft">
              {{ confirmCopy }}
            </button>
          </div>
        </form>
      </dialog>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
import { ChevronDown } from 'lucide-vue-next'
import {
  ADMIN_PICKER_PAGE_SIZE,
  advancePickerWindow,
  searchAdminPickerOptions,
  selectedAdminPickerOptions,
  type AdminPickerOption,
} from '~/utils/admin-picker'
import { windowItems } from '~/utils/infinite-list'

const props = withDefaults(defineProps<{
  options: AdminPickerOption[]
  placeholder?: string
  searchPlaceholder?: string
  title?: string
  emptyCopy?: string
  noMatchCopy?: string
  loadingCopy?: string
  errorCopy?: string
  itemLabel?: string
  status?: 'idle' | 'loading' | 'ready' | 'error'
  required?: boolean
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}>(), {
  placeholder: 'Choose cafes',
  searchPlaceholder: 'Search cafe name or address',
  title: 'Choose cafes',
  emptyCopy: 'Nothing to choose yet.',
  noMatchCopy: 'No matches for that search.',
  loadingCopy: 'Loading…',
  errorCopy: 'Could not load this list.',
  itemLabel: 'cafe',
  status: 'ready',
  required: false,
  disabled: false,
  invalid: false,
  describedBy: undefined,
})

const model = defineModel<string[]>({ default: () => [] })
const uid = useId()
const dialogId = `${uid}-dialog`
const titleId = `${uid}-title`
const listId = `${uid}-list`

const triggerRef = ref<HTMLButtonElement | null>(null)
const dialogRef = ref<HTMLDialogElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const query = ref('')
const shown = ref(ADMIN_PICKER_PAGE_SIZE)
const draft = ref(new Set<string>())
let observer: IntersectionObserver | null = null
let closing = false

const selected = computed(() => selectedAdminPickerOptions(props.options, model.value))
const filtered = computed(() => searchAdminPickerOptions(props.options, query.value))
const visible = computed(() => windowItems(filtered.value, shown.value))
const triggerCopy = computed(() => {
  if (selected.value.length === 0) return props.placeholder
  if (selected.value.length === 1) return selected.value[0].title
  return `${selected.value.length} ${props.itemLabel}s`
})
const confirmCopy = computed(() => {
  const count = draft.value.size
  if (count === 0) return 'Use none'
  return count === 1 ? `Use 1 ${props.itemLabel}` : `Use ${count} ${props.itemLabel}s`
})
const countCopy = computed(() => {
  if (props.status === 'loading' || props.status === 'error') return ''
  const picked = draft.value.size
  const total = filtered.value.length
  const match = query.value.trim()
    ? (total === 1 ? '1 match' : `${total} matches`)
    : (total === 1 ? `1 ${props.itemLabel}` : `${total} ${props.itemLabel}s`)
  return picked ? `${match} · ${picked} selected` : match
})

const observeSentinel = () => {
  observer?.disconnect()
  if (!sentinelRef.value || !listRef.value) return
  observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    shown.value = advancePickerWindow(shown.value, filtered.value.length)
  }, { root: listRef.value, rootMargin: '80px' })
  observer.observe(sentinelRef.value)
}

const openDialog = async () => {
  if (props.disabled || closing || dialogRef.value?.open) return
  query.value = ''
  shown.value = ADMIN_PICKER_PAGE_SIZE
  draft.value = new Set(model.value)
  open.value = true
  await nextTick()
  dialogRef.value?.showModal()
  await nextTick()
  searchRef.value?.focus()
  observeSentinel()
}

const closeDialog = () => {
  closing = true
  dialogRef.value?.close()
}

const onDialogClose = () => {
  open.value = false
  query.value = ''
  observer?.disconnect()
  observer = null
  triggerRef.value?.focus()
  requestAnimationFrame(() => {
    closing = false
  })
}

const onBackdropClick = (event: MouseEvent) => {
  if (event.target === dialogRef.value) closeDialog()
}

const toggle = (id: string) => {
  const next = new Set(draft.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  draft.value = next
}

const confirmDraft = () => {
  model.value = props.options.filter((option) => draft.value.has(option.id)).map((option) => option.id)
  closeDialog()
}

const remove = (id: string) => {
  model.value = model.value.filter((item) => item !== id)
}

watch(query, () => {
  if (!open.value) return
  shown.value = ADMIN_PICKER_PAGE_SIZE
})

watch(sentinelRef, () => {
  if (open.value) observeSentinel()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (dialogRef.value?.open) dialogRef.value.close()
})
</script>

<style scoped>
.admin-picker {
  min-width: 0;
}

.admin-picker__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
}

.admin-picker__value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-picker__value.is-placeholder {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.admin-picker__chevron {
  flex: 0 0 auto;
  color: var(--kd-primary);
}

.admin-picker__trigger.is-invalid {
  border-color: var(--kd-destructive);
}

.admin-picker__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.admin-picker__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.admin-picker__chips li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 4px 2px 8px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 18%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  font-size: 0.75rem;
  line-height: 1.3;
}

.admin-picker__chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  cursor: pointer;
}

.admin-picker__trigger:focus-visible,
.admin-picker__search input:focus-visible,
.admin-picker__option:focus-visible,
.admin-picker__cancel:focus-visible,
.admin-picker__chip-remove:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.admin-picker__dialog {
  width: min(36rem, calc(100vw - 32px));
  max-height: min(36rem, calc(100vh - 32px));
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  box-shadow: 0 8px 28px var(--kd-shadow);
  overflow: hidden;
  color: var(--kd-ink);
}

.admin-picker__dialog::backdrop {
  background: color-mix(in srgb, var(--kd-ink) 40%, transparent);
}

.admin-picker__sheet {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(36rem, calc(100vh - 32px));
  padding: 16px;
}

.admin-picker__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.admin-picker__search input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--kd-ink-10);
  border-radius: 8px;
  background: var(--kd-white);
  color: var(--kd-ink);
  font: inherit;
  font-size: 14px;
}

.admin-picker__count {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.admin-picker__status {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.35;
}

.admin-picker__status--error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.admin-picker__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: min(22rem, 50vh);
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.admin-picker__option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.admin-picker__tick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 28%, transparent);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--kd-ink);
}

.admin-picker__option.is-selected .admin-picker__tick {
  border-color: var(--kd-accent);
  background: color-mix(in srgb, var(--kd-accent) 28%, #faf8f5);
}

.admin-picker__option-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.admin-picker__option-title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.admin-picker__option-sub {
  overflow: hidden;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-picker__option.is-selected {
  border-color: var(--kd-accent);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
}

.admin-picker__sentinel {
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.admin-picker__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-picker__cancel {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  cursor: pointer;
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

@media (hover: hover) and (pointer: fine) {
  .admin-picker__option:hover:not(.is-selected) {
    background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
  }
}

:root.is-android .admin-picker__trigger,
:root.is-android .admin-picker__search input,
:root.is-android .admin-picker__option,
:root.is-android .admin-picker__cancel {
  min-height: 48px;
}
</style>
