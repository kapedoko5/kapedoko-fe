<template>
  <IonPage>
    <AdminShell
      title="Import cafes"
      lede="Read every name and address. Nothing reaches the catalog until you stamp the crate."
      :status="status"
      :error="error"
      :pending-count="counts.pending"
      :claim-count="counts.pendingClaims"
    >
      <template #actions>
        <NuxtLink class="admin-btn admin-btn--quiet" to="/admin/cafes">Back to cafes</NuxtLink>
      </template>

      <label
        v-if="tickets.length === 0"
        class="crate-drop"
        :class="{ 'is-hot': dragging }"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <input
          class="crate-file"
          type="file"
          accept=".csv,text/csv"
          @change="onFileInput"
        >
        <span class="crate-mark" aria-hidden="true" />
        <span class="crate-drop__title">Drop a cafe CSV</span>
        <span class="crate-drop__copy">
          Use the KapeDoko export: name, address, pin, and hours. We’ll stack each shop with its street so you can keep or skip it.
        </span>
        <span class="admin-btn crate-drop__pick">Choose CSV</span>
        <span v-if="parseError" class="crate-error" role="alert">{{ parseError }}</span>
      </label>

      <template v-else>
        <div class="crate-toolbar">
          <p class="crate-progress" aria-live="polite">{{ progressCopy }}</p>
          <div class="crate-filters" role="group" aria-label="Filter crate">
            <button
              v-for="filter in filters"
              :key="filter.id"
              type="button"
              class="admin-chip"
              :class="{ 'is-active': view === filter.id }"
              :aria-pressed="view === filter.id"
              @click="view = filter.id"
            >
              {{ filter.label }}
              <span class="crate-count">{{ filter.count }}</span>
            </button>
          </div>
          <div class="crate-bulk">
            <button type="button" class="admin-btn admin-btn--ghost" :disabled="!readyToStamp" @click="stampReady">
              Stamp the ready ones
            </button>
            <button
              v-if="tally.duplicates > 0"
              type="button"
              class="admin-btn admin-btn--quiet"
              :disabled="saving"
              @click="skipDuplicates"
            >
              Skip already listed
            </button>
            <button type="button" class="admin-btn admin-btn--quiet" @click="resetCrate">
              Choose another file
            </button>
          </div>
        </div>

        <p v-if="visible.length === 0" class="admin-meta">No cafes in that slice.</p>

        <ol v-else class="crate-list">
          <li v-for="ticket in visible" :key="ticket.key">
            <article
              class="crate-ticket"
              :class="{
                'is-keep': ticket.decision === 'keep',
                'is-skip': ticket.decision === 'skip',
                'is-blocked': isHardBlock(ticket.blockReason),
              }"
            >
              <span class="crate-ticket__n" aria-hidden="true">{{ ticket.row }}</span>
              <div class="crate-ticket__body">
                <h2>{{ ticket.name || 'Unnamed cafe' }}</h2>
                <p>{{ ticket.address || 'No street yet' }}</p>
                <p v-if="ticket.hours" class="crate-ticket__hours">{{ summarizeHours(ticket.hours) }}</p>
                <p v-if="crateReasonCopy(ticket)" class="crate-ticket__note">{{ crateReasonCopy(ticket) }}</p>
              </div>
              <div class="crate-ticket__stamps" role="group" :aria-label="`Stamp ${ticket.name}`">
                <button
                  type="button"
                  class="crate-stamp crate-stamp--keep"
                  :class="{ 'is-on': ticket.decision === 'keep' }"
                  :disabled="!canKeepTicket(ticket) || saving"
                  :aria-pressed="ticket.decision === 'keep'"
                  @click="stamp(ticket.key, 'keep')"
                >
                  Keep
                </button>
                <button
                  type="button"
                  class="crate-stamp crate-stamp--skip"
                  :class="{ 'is-on': ticket.decision === 'skip' }"
                  :disabled="saving"
                  :aria-pressed="ticket.decision === 'skip'"
                  @click="stamp(ticket.key, 'skip')"
                >
                  Skip
                </button>
              </div>
            </article>
          </li>
        </ol>

        <div class="crate-dock">
          <p id="crate-dock-copy">{{ dockCopy }}</p>
          <button
            type="button"
            class="admin-btn"
            :disabled="!canCommitCrate(tickets) || saving"
            :aria-busy="saving || undefined"
            aria-describedby="crate-dock-copy"
            @click="commitCrate"
          >
            <AdminBusyLabel :busy="saving">{{ saving ? 'Importing…' : importLabel }}</AdminBusyLabel>
          </button>
        </div>
      </template>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import {
  canCommitCrate,
  canKeepTicket,
  crateReasonCopy,
  crateTally,
  IMPORT_ADMIN_SHOPS_MAX,
  isHardBlock,
  keptImportDrafts,
  parseCafeImportCsv,
  stampDuplicateTickets,
  stampReadyTickets,
  stampTicket,
  type CrateTicket,
} from '~/utils/cafe-csv-import'
import { summarizeHours } from '~/utils/hours'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { track: trackBusy } = useAdminBusy()
const { shops, counts, status, error, load } = admin
const router = useRouter()
const dragging = ref(false)
const parseError = ref('')
const tickets = ref<CrateTicket[]>([])
const view = ref<'all' | 'undecided' | 'keep' | 'skip'>('all')
const saving = ref(false)

const existing = computed(() => shops.value.map((shop) => ({
  name: shop.name,
  latitude: shop.latitude,
  longitude: shop.longitude,
})))

const tally = computed(() => crateTally(tickets.value))
const readyToStamp = computed(() => (
  tickets.value.some((ticket) => ticket.decision === 'undecided' && !ticket.blockReason)
))
const filters = computed(() => [
  { id: 'all' as const, label: 'All', count: tally.value.total },
  { id: 'undecided' as const, label: 'To stamp', count: tally.value.undecided },
  { id: 'keep' as const, label: 'Keep', count: tally.value.keep },
  { id: 'skip' as const, label: 'Skip', count: tally.value.skip },
])
const visible = computed(() => {
  if (view.value === 'all') return tickets.value
  return tickets.value.filter((ticket) => ticket.decision === view.value)
})
const progressCopy = computed(() => {
  const { keep, skip, undecided, total, blocked } = tally.value
  if (undecided > 0) {
    return blocked
      ? `${undecided} of ${total} still need a stamp · ${blocked} already skipped`
      : `${undecided} of ${total} still need a stamp`
  }
  return `${keep} kept · ${skip} skipped`
})
const importLabel = computed(() => (
  tally.value.keep === 1 ? 'Import 1 cafe' : `Import ${tally.value.keep} cafes`
))
const dockCopy = computed(() => {
  if (tally.value.undecided > 0) return 'Stamp every cafe before the crate can land.'
  if (tally.value.keep === 0) return 'Keep at least one cafe to import.'
  if (tally.value.keep > IMPORT_ADMIN_SHOPS_MAX) {
    return `These land unpublished, ${IMPORT_ADMIN_SHOPS_MAX} at a time. Publish them from the cafe list when you are ready.`
  }
  return 'These land unpublished. Publish them from the cafe list when you are ready.'
})

const followRemaining = () => {
  view.value = tally.value.undecided > 0 ? 'undecided' : 'all'
}

const readFile = async (file: File) => {
  parseError.value = ''
  dragging.value = false
  if (!file.name.toLowerCase().endsWith('.csv') && file.type && file.type !== 'text/csv') {
    parseError.value = 'Choose a .csv file.'
    toast.warning('Choose a CSV', parseError.value)
    return
  }
  try {
    const text = await file.text()
    tickets.value = parseCafeImportCsv(text, existing.value)
    view.value = 'all'
  } catch (err) {
    tickets.value = []
    parseError.value = err instanceof Error ? err.message : 'Could not read that CSV.'
    toast.warning('Could not read that file', parseError.value)
  }
}

const onFileInput = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await readFile(file)
}

const onDragLeave = (event: DragEvent) => {
  const next = event.relatedTarget as Node | null
  if (next && (event.currentTarget as HTMLElement).contains(next)) return
  dragging.value = false
}

const onDrop = async (event: DragEvent) => {
  const file = event.dataTransfer?.files?.[0]
  if (file) await readFile(file)
}

const stamp = (key: string, decision: 'keep' | 'skip') => {
  tickets.value = stampTicket(tickets.value, key, decision)
}

const stampReady = () => {
  tickets.value = stampReadyTickets(tickets.value)
  followRemaining()
}

const skipDuplicates = () => {
  tickets.value = stampDuplicateTickets(tickets.value, 'skip')
  followRemaining()
}

const resetCrate = () => {
  tickets.value = []
  parseError.value = ''
  view.value = 'all'
}

const commitCrate = async () => {
  if (!canCommitCrate(tickets.value) || saving.value) return
  const count = tally.value.keep
  const choice = await askAdmin({
    title: count === 1 ? 'Import 1 cafe?' : `Import ${count} cafes?`,
    message: 'They land unpublished. Publish them from the cafe list when the addresses look right.',
    confirmLabel: count === 1 ? 'Import cafe' : 'Import cafes',
  })
  if (!choice.confirmed) return
  saving.value = true
  admin.error.value = ''
  try {
    const created = await trackBusy(
      count === 1 ? 'Importing 1 cafe…' : `Importing ${count} cafes…`,
      () => admin.importShops(keptImportDrafts(tickets.value)),
    )
    toast.success(
      'Cafes imported',
      created.length === 1 ? '1 cafe landed unpublished.' : `${created.length} cafes landed unpublished.`,
    )
    await router.push({
      path: '/admin/cafes',
      query: { imported: String(created.length) },
    })
  } catch (err) {
    admin.error.value = err instanceof Error ? err.message : 'Could not import these cafes.'
    toast.error('Could not import', admin.error.value)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.crate-file {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}

.crate-drop,
.crate-ticket,
.crate-dock,
.crate-toolbar {
  caret-color: var(--kd-primary);
}

.crate-drop ::selection,
.crate-ticket ::selection,
.crate-dock ::selection,
.crate-toolbar ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.crate-drop {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding: 28px 20px;
  border: 1px dashed color-mix(in srgb, var(--kd-ink) 28%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  cursor: pointer;
}

.crate-mark {
  width: 52px;
  height: 40px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--kd-accent) 22%, #faf8f5);
  transform: rotate(-7deg);
}

.crate-drop.is-hot {
  border-color: var(--kd-accent);
  background: color-mix(in srgb, var(--kd-accent) 18%, #faf8f5);
}

.crate-drop__title {
  margin: 0;
  font-size: 1.325rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.crate-drop__copy {
  margin: 0;
  max-width: 42rem;
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
}

.crate-drop__pick {
  pointer-events: none;
}

.crate-error,
.crate-ticket__note {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.75rem;
}

.crate-toolbar {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.crate-progress {
  margin: 0;
  font-weight: 700;
}

.crate-filters,
.crate-bulk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.crate-count {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.crate-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 0 88px;
  list-style: none;
}

.crate-ticket {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.crate-ticket__n {
  flex: 0 0 auto;
  min-width: 1.5rem;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.crate-ticket.is-keep {
  border-color: color-mix(in srgb, var(--kd-accent) 55%, transparent);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
}

.crate-ticket.is-skip {
  opacity: 0.72;
}

.crate-ticket.is-blocked {
  background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
}

.crate-ticket__body {
  min-width: 0;
  flex: 1 1 16rem;
}

.crate-ticket__body h2,
.crate-ticket__body p {
  margin: 0;
}

.crate-ticket__body h2 {
  font-size: 0.95rem;
  line-height: 1.2;
}

.crate-ticket__body p {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
}

.crate-ticket__hours {
  margin-top: 2px;
  font-size: 0.75rem;
}

.crate-ticket__note {
  margin-top: 4px;
}

.crate-ticket__stamps {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.crate-stamp {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.crate-stamp--keep {
  border: 1px solid var(--kd-accent);
  background: transparent;
  color: var(--kd-ink);
}

.crate-stamp--keep.is-on {
  background: var(--kd-accent);
  transform: rotate(-2deg);
}

.crate-stamp--skip {
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: transparent;
  color: var(--kd-ink);
}

.crate-stamp--skip.is-on {
  background: color-mix(in srgb, var(--kd-ink) 10%, #faf8f5);
}

.crate-stamp:hover:not(:disabled) {
  filter: brightness(0.97);
}

.crate-stamp:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.crate-stamp:active:not(:disabled) {
  transform: translateY(1px);
}

.crate-stamp--keep.is-on:active:not(:disabled) {
  transform: rotate(-2deg) translateY(1px);
}

.crate-stamp:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.crate-dock {
  position: sticky;
  bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.crate-dock p {
  margin: 0;
  max-width: 36rem;
  font-size: 0.7875rem;
}

@media (max-width: 767px) {
  .crate-ticket__stamps,
  .crate-stamp {
    flex: 1 1 0;
  }

  .crate-dock .admin-btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .crate-mark,
  .crate-stamp--keep.is-on,
  .crate-stamp:active:not(:disabled),
  .crate-stamp--keep.is-on:active:not(:disabled) {
    transform: none;
  }
}
</style>
