<template>
  <Teleport to="body">
    <dialog
      :id="dialogId"
      ref="dialogRef"
      class="user-search"
      :aria-labelledby="titleId"
      :aria-describedby="ledeId"
      @close="onDialogClose"
      @click="onBackdropClick"
    >
      <form class="user-search__sheet" @submit.prevent="runSearch">
        <h2 :id="titleId" class="user-search__title">{{ title }}</h2>
        <p :id="ledeId" class="user-search__lede">{{ lede }}</p>
        <label class="user-search__field" :for="searchId">
          Find a person
          <input
            :id="searchId"
            ref="searchRef"
            v-model="query"
            type="search"
            placeholder="Search name or email"
            autocomplete="off"
            :disabled="busy"
            @keydown.esc.prevent="closeDialog"
          />
        </label>
        <div class="user-search__actions">
          <button type="submit" class="user-search__search" :disabled="busy || searching">
            {{ searching ? 'Searching…' : 'Search' }}
          </button>
          <button type="button" class="user-search__cancel" :disabled="busy" @click="closeDialog">
            Cancel
          </button>
        </div>
        <p v-if="searchError" class="user-search__error" role="alert">{{ searchError }}</p>
        <p v-else-if="searching" class="user-search__status" role="status">Searching people…</p>
        <p v-else-if="searched && matches.length === 0" class="user-search__status">
          No people match that search.
        </p>
        <ul
          v-else-if="matches.length"
          class="user-search__people"
          :aria-label="`People matching ${query.trim() || 'recent accounts'}`"
        >
          <li v-for="person in matches" :key="person.id">
            <button
              type="button"
              class="user-search__pick"
              :disabled="busy || person.banned"
              @click="pick(person)"
            >
              <span class="user-search__avatar" aria-hidden="true">{{ cafeOwnerInitial(person.displayName || person.email) }}</span>
              <span class="user-search__who">
                <strong>{{ person.displayName || 'Unnamed' }}</strong>
                <span>{{ person.email || (person.banned ? 'Suspended' : 'No email on file') }}</span>
              </span>
            </button>
          </li>
        </ul>
      </form>
    </dialog>
  </Teleport>
</template>

<script lang="ts" setup>
import type { AdminUserRow } from '~/types/admin'
import { cafeOwnerInitial } from '~/utils/shop-claims'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  lede?: string
  excludeIds?: string[]
  busy?: boolean
}>(), {
  title: 'Find the new owner',
  lede: 'Search by name or email.',
  excludeIds: () => [],
  busy: false,
})

const emit = defineEmits<{
  pick: [person: AdminUserRow]
  cancel: []
}>()

const uid = useId()
const dialogId = `${uid}-dialog`
const titleId = `${uid}-title`
const ledeId = `${uid}-lede`
const searchId = `${uid}-search`
const dialogRef = ref<HTMLDialogElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const query = ref('')
const searched = ref(false)
const searching = ref(false)
const searchError = ref('')
const matches = ref<AdminUserRow[]>([])
const { users, error: loadError, search } = useAdminUsers()
let closing = false

const filterMatches = (rows: AdminUserRow[]) => rows.filter((row) => !props.excludeIds.includes(row.id))

const runSearch = async () => {
  searching.value = true
  searchError.value = ''
  searched.value = true
  try {
    await search(query.value, props.excludeIds)
    matches.value = filterMatches(users.value)
    if (loadError.value) searchError.value = loadError.value
  } catch (err) {
    matches.value = []
    searchError.value = err instanceof Error ? err.message : 'Could not search people.'
  } finally {
    searching.value = false
  }
}

const pick = (person: AdminUserRow) => {
  if (props.busy || person.banned) return
  emit('pick', person)
}

const closeDialog = () => {
  if (props.busy) return
  closing = true
  dialogRef.value?.close()
}

const onDialogClose = () => {
  query.value = ''
  searched.value = false
  searchError.value = ''
  matches.value = []
  if (props.open) emit('cancel')
  requestAnimationFrame(() => {
    closing = false
  })
}

const onBackdropClick = (event: MouseEvent) => {
  if (event.target === dialogRef.value) closeDialog()
}

watch(() => props.open, async (open) => {
  if (!import.meta.client) return
  if (!open) {
    if (dialogRef.value?.open) dialogRef.value.close()
    return
  }
  if (closing || dialogRef.value?.open) return
  query.value = ''
  searched.value = false
  searchError.value = ''
  matches.value = []
  await nextTick()
  dialogRef.value?.showModal()
  await nextTick()
  searchRef.value?.focus()
  void runSearch()
})

onBeforeUnmount(() => {
  if (dialogRef.value?.open) dialogRef.value.close()
})
</script>

<style scoped>
.user-search {
  width: min(28rem, calc(100vw - 32px));
  max-height: min(36rem, calc(100vh - 32px));
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  box-shadow: 0 8px 28px var(--kd-shadow);
  color: var(--kd-ink);
  overflow: hidden;
  caret-color: var(--kd-primary);
}

.user-search::backdrop {
  background: color-mix(in srgb, var(--kd-ink) 46%, transparent);
}

.user-search__sheet {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(36rem, calc(100vh - 32px));
  padding: 20px 16px 16px;
}

.user-search__title,
.user-search__lede,
.user-search__status,
.user-search__error {
  margin: 0;
  overflow-wrap: anywhere;
}

.user-search__title {
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.user-search__lede,
.user-search__status {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.user-search__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.user-search__field input {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 400;
}

.user-search__field input::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 55%, #faf8f5);
}

.user-search__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-search__search,
.user-search__cancel,
.user-search__pick {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 16px;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.user-search__search {
  border: 1px solid var(--kd-accent);
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.user-search__cancel {
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #faf8f5;
  color: var(--kd-ink);
}

.user-search__search:disabled,
.user-search__cancel:disabled,
.user-search__pick:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.user-search__error {
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}

.user-search__people {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(18rem, 42vh);
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.user-search__pick {
  width: 100%;
  justify-content: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 18%, transparent);
  border-radius: 12px;
  background: #faf8f5;
  color: var(--kd-ink);
  text-align: left;
}

.user-search__avatar {
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--kd-accent);
  font-size: 0.75rem;
}

.user-search__who {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-search__who strong {
  font-size: 0.7875rem;
  line-height: 1.3;
}

.user-search__who span {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  overflow-wrap: anywhere;
}

.user-search ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.user-search__field input:focus-visible,
.user-search__search:focus-visible,
.user-search__cancel:focus-visible,
.user-search__pick:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (hover: hover) {
  .user-search__search:hover:not(:disabled) {
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }

  .user-search__pick:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--kd-ink) 34%, transparent);
    background: color-mix(in srgb, var(--kd-accent) 14%, #faf8f5);
  }
}

.user-search__search:active:not(:disabled),
.user-search__pick:active:not(:disabled) {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

@media (min-width: 540px) {
  .user-search {
    width: min(32rem, calc(100vw - 40px));
  }

  .user-search__sheet {
    padding: 20px;
  }

  .user-search__actions {
    flex-direction: row;
  }

  .user-search__search,
  .user-search__cancel {
    flex: 1;
  }
}

:root.is-android .user-search__field input,
:root.is-android .user-search__search,
:root.is-android .user-search__cancel,
:root.is-android .user-search__pick {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .user-search__search,
  .user-search__pick {
    transition: none;
  }
}
</style>
