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
      <span class="admin-picker__value" :class="{ 'is-placeholder': !selected }">
        {{ selected?.title || placeholder }}
      </span>
      <ChevronDown class="admin-picker__chevron" :size="18" :stroke-width="2.25" aria-hidden="true" />
    </button>

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
              :aria-activedescendant="activeOptionId"
              @keydown="onSearchKeydown"
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
            :aria-label="title"
          >
            <li v-for="option in visible" :key="option.id">
              <button
                :id="optionDomId(option.id)"
                type="button"
                class="admin-picker__option"
                role="option"
                :class="{
                  'is-selected': option.id === model,
                  'is-active': option.id === activeId,
                }"
                :aria-selected="option.id === model"
                @click="choose(option)"
                @mousemove="activeId = option.id"
              >
                <slot name="option" :option="option" :selected="option.id === model">
                  <span class="admin-picker__option-title">{{ option.title }}</span>
                  <span v-if="option.subtitle" class="admin-picker__option-sub">{{ option.subtitle }}</span>
                </slot>
              </button>
            </li>
            <li v-if="visible.length < filtered.length" ref="sentinelRef" class="admin-picker__sentinel" aria-hidden="true" />
          </ul>
          <button type="button" class="admin-btn admin-btn--ghost" @click="closeDialog">Cancel</button>
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
  findAdminPickerOption,
  pickerWindowSize,
  searchAdminPickerOptions,
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
  placeholder: 'Choose an option',
  searchPlaceholder: 'Search',
  title: 'Choose an option',
  emptyCopy: 'Nothing to choose yet.',
  noMatchCopy: 'No matches for that search.',
  loadingCopy: 'Loading…',
  errorCopy: 'Could not load this list.',
  itemLabel: 'option',
  status: 'ready',
  required: false,
  disabled: false,
  invalid: false,
  describedBy: undefined,
})

const model = defineModel<string>({ default: '' })
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
const activeId = ref<string | null>(null)
let observer: IntersectionObserver | null = null
let closing = false

const selected = computed(() => findAdminPickerOption(props.options, model.value))
const filtered = computed(() => searchAdminPickerOptions(props.options, query.value))
const visible = computed(() => windowItems(filtered.value, shown.value))
const activeOptionId = computed(() => (activeId.value ? optionDomId(activeId.value) : undefined))
const countCopy = computed(() => {
  if (props.status === 'loading' || props.status === 'error') return ''
  const total = filtered.value.length
  if (query.value.trim()) return total === 1 ? '1 match' : `${total} matches`
  const noun = props.itemLabel
  return total === 1 ? `1 ${noun}` : `${total} ${noun}s`
})

const optionDomId = (id: string) => `${uid}-opt-${id}`

const resetList = () => {
  shown.value = pickerWindowSize(filtered.value, model.value)
  activeId.value = model.value || filtered.value[0]?.id || null
}

const scrollActiveIntoView = () => {
  const node = activeId.value ? document.getElementById(optionDomId(activeId.value)) : null
  node?.scrollIntoView({ block: 'nearest' })
}

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
  open.value = true
  await nextTick()
  resetList()
  dialogRef.value?.showModal()
  await nextTick()
  searchRef.value?.focus()
  scrollActiveIntoView()
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

const choose = (option: AdminPickerOption) => {
  model.value = option.id
  closeDialog()
}

const moveActive = (delta: number) => {
  const list = visible.value
  if (list.length === 0) return
  const current = list.findIndex((option) => option.id === activeId.value)
  const index = Math.min(list.length - 1, Math.max(0, (current < 0 ? 0 : current) + delta))
  activeId.value = list[index].id
  if (index >= list.length - 3) shown.value = advancePickerWindow(shown.value, filtered.value.length)
  void nextTick(scrollActiveIntoView)
}

const onSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActive(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(-1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = filtered.value.find((item) => item.id === activeId.value) ?? filtered.value[0]
    if (option) choose(option)
  }
}

watch(query, () => {
  if (!open.value) return
  shown.value = ADMIN_PICKER_PAGE_SIZE
  activeId.value = filtered.value[0]?.id ?? null
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

.admin-picker__trigger:focus-visible,
.admin-picker__search input:focus-visible,
.admin-picker__option:focus-visible,
.admin-picker__cancel:focus-visible {
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
  animation: picker-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.admin-picker__dialog::backdrop {
  background: color-mix(in srgb, var(--kd-ink) 40%, transparent);
  animation: picker-backdrop 180ms ease-out;
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

.admin-picker__search input::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
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
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 28%, transparent) #faf8f5;
}

.admin-picker__option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
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
  max-width: 100%;
}

.admin-picker__option.is-selected {
  border-color: var(--kd-accent);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
}

.admin-picker__option.is-active:not(.is-selected) {
  background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
}

.admin-picker__sentinel {
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.admin-picker__cancel {
  align-self: flex-start;
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
  .admin-picker__trigger:hover {
    border-color: color-mix(in srgb, var(--kd-ink) 28%, transparent);
  }

  .admin-picker__option:hover:not(.is-selected) {
    background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
  }

  .admin-picker__cancel:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

@keyframes picker-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes picker-backdrop {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-picker__dialog,
  .admin-picker__dialog::backdrop {
    animation: none;
  }
}

:root.is-android .admin-picker__trigger,
:root.is-android .admin-picker__search input,
:root.is-android .admin-picker__option,
:root.is-android .admin-picker__cancel {
  min-height: 48px;
}
</style>
