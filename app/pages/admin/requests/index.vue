<template>
  <IonPage>
    <AdminShell
      title="Cafe requests"
      lede="Stamp a listing onto Home and Map, or keep it off. Rejected cafes stay private."
      :status="status"
      :error="error"
      :pending-count="pending.length"
      :claim-count="pendingClaims.length"
    >
      <p v-if="notice" class="request-notice" role="status">{{ notice }}</p>

      <div class="request-toolbar">
        <input
          v-model="query"
          class="admin-search"
          type="search"
          placeholder="Find a cafe name or address"
          aria-label="Find a cafe name or address"
        >
        <div class="request-filters" role="tablist" aria-label="Request status">
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            role="tab"
            class="admin-chip"
            :class="{ 'is-active': activeFilter === filter.id }"
            :aria-selected="activeFilter === filter.id"
            @click="activeFilter = filter.id"
          >
            {{ filter.label }}
            <span class="request-count">{{ tally[filter.id] }}</span>
          </button>
        </div>
      </div>

      <p v-if="visible.length === 0" class="admin-meta">{{ emptyCopy }}</p>

      <ol v-else class="request-list">
        <li v-for="shop in visible" :key="shop.id">
          <article
            :id="`request-${shop.id}`"
            class="request-ticket"
            :class="{
              'is-pending': shop.status === 'pending',
              'is-approved': shop.status === 'approved',
              'is-rejected': shop.status === 'rejected',
              'is-focus': focusId === shop.id,
              'is-rejecting': rejectingId === shop.id,
            }"
          >
            <div class="request-mast">
              <div class="request-mark" aria-hidden="true">
                <img
                  v-if="logoSrc(shop)"
                  :src="logoSrc(shop)"
                  alt=""
                  width="40"
                  height="40"
                >
                <Store v-else :size="18" :stroke-width="2.25" />
              </div>
              <div class="request-copy">
                <h2>{{ shop.name }}</h2>
                <p>{{ shop.address }}</p>
                <p class="request-hours">{{ requestHoursCopy(shop.hours) }}</p>
                <p v-if="shop.contact_number" class="request-meta">{{ shop.contact_number }}</p>
                <p v-if="shop.source === 'openstreetmap'" class="request-meta">
                  OpenStreetMap
                  {{ shop.osm_type && shop.osm_id ? `${shop.osm_type}/${shop.osm_id}` : 'import' }}
                </p>
                <p v-if="shop.reviewed_at" class="request-meta">Reviewed {{ formatAdminDate(shop.reviewed_at) }}</p>
                <p v-if="shop.rejection_reason" class="request-note">{{ shop.rejection_reason }}</p>
              </div>
              <span
                v-if="shop.status !== 'pending'"
                class="request-stamp"
                :class="`request-stamp--${shop.status}`"
              >
                <span class="request-stamp__mark" aria-hidden="true" />
                {{ requestStatusWord(shop.status) }}
              </span>
            </div>

            <form
              v-if="shop.status === 'pending' && rejectingId === shop.id"
              class="request-reject"
              @submit.prevent="submitReject(shop)"
            >
              <label class="admin-field" :for="`request-reason-${shop.id}`">
                Why this listing stays off Home and Map
                <textarea
                  :id="`request-reason-${shop.id}`"
                  v-model="rejectReason"
                  rows="3"
                  maxlength="280"
                  required
                  @keydown.esc.prevent="cancelReject"
                />
              </label>
              <p class="request-count-line" :class="{ 'is-over': rejectOver }">
                {{ rejectReason.trim().length }} / 280
              </p>
              <p v-if="rejectIssue" class="admin-error" role="alert">{{ rejectIssue }}</p>
              <div class="request-stamps">
                <button type="submit" class="request-btn request-btn--reject" :disabled="busy" :aria-busy="savingId === shop.id || undefined">
                  <AdminBusyLabel :busy="savingId === shop.id">
                    {{ savingId === shop.id ? 'Rejecting…' : 'Send rejection' }}
                  </AdminBusyLabel>
                </button>
                <button type="button" class="admin-btn admin-btn--quiet" :disabled="busy" @click="cancelReject">
                  Cancel
                </button>
              </div>
            </form>

            <div v-else-if="shop.status === 'pending'" class="request-stamps" role="group" :aria-label="`Stamp ${shop.name}`">
              <button
                type="button"
                class="request-btn request-btn--approve"
                :disabled="busy"
                :aria-busy="savingId === shop.id || undefined"
                @click="onApprove(shop)"
              >
                <AdminBusyLabel :busy="savingId === shop.id">
                  {{ savingId === shop.id ? 'Approving…' : 'Approve' }}
                </AdminBusyLabel>
              </button>
              <button
                type="button"
                class="request-btn request-btn--reject"
                :disabled="busy"
                @click="startReject(shop.id)"
              >
                Reject
              </button>
              <NuxtLink class="request-open" :to="`/admin/cafes/${shop.id}`">Open cafe</NuxtLink>
            </div>

            <p v-else class="request-done">
              <NuxtLink class="request-open" :to="`/admin/cafes/${shop.id}`">Open cafe</NuxtLink>
            </p>
          </article>
        </li>
      </ol>

      <div v-if="activeFilter === 'pending' && queue.length > 0" class="request-dock">
        <template v-if="bulkIntent === 'approve'">
          <p id="request-dock-copy">{{ queue.length === 1 ? 'This cafe goes live on Home and Map.' : `${queue.length} cafes go live on Home and Map.` }}</p>
          <div class="request-dock__actions">
            <button type="button" class="admin-btn" :disabled="busy" :aria-busy="busy || undefined" @click="confirmBulk('approved')">
              <AdminBusyLabel :busy="busy">
                {{ busy ? bulkProgress : bulkApproveCopy(queue.length) }}
              </AdminBusyLabel>
            </button>
            <button type="button" class="admin-btn admin-btn--quiet" :disabled="busy" @click="cancelBulk">
              Cancel
            </button>
          </div>
        </template>
        <template v-else-if="bulkIntent === 'reject'">
          <form class="request-dock__reject" @submit.prevent="confirmBulk('rejected')">
            <label class="admin-field" for="request-bulk-reason">
              Why these listings stay off Home and Map
              <textarea
                id="request-bulk-reason"
                v-model="rejectReason"
                rows="3"
                maxlength="280"
                required
                @keydown.esc.prevent="cancelBulk"
              />
            </label>
            <p class="request-count-line" :class="{ 'is-over': rejectOver }">
              {{ rejectReason.trim().length }} / 280
            </p>
            <p v-if="rejectIssue" class="admin-error" role="alert">{{ rejectIssue }}</p>
            <div class="request-dock__actions">
              <button type="submit" class="request-btn request-btn--reject" :disabled="busy" :aria-busy="busy || undefined">
                <AdminBusyLabel :busy="busy">
                  {{ busy ? bulkProgress : bulkRejectCopy(queue.length) }}
                </AdminBusyLabel>
              </button>
              <button type="button" class="admin-btn admin-btn--quiet" :disabled="busy" @click="cancelBulk">
                Cancel
              </button>
            </div>
          </form>
        </template>
        <template v-else>
          <p id="request-dock-copy">{{ dockCopy }}</p>
          <div class="request-dock__actions">
            <button
              type="button"
              class="admin-btn"
              :disabled="busy"
              aria-describedby="request-dock-copy"
              @click="startBulk('approve')"
            >
              {{ bulkApproveCopy(queue.length) }}
            </button>
            <button
              type="button"
              class="admin-btn admin-btn--ghost"
              :disabled="busy"
              @click="startBulk('reject')"
            >
              {{ bulkRejectCopy(queue.length) }}
            </button>
          </div>
        </template>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { Store } from 'lucide-vue-next'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { ShopRow, ShopStatus } from '~/types/shop'
import { formatAdminDate } from '~/utils/admin-nav'
import { isKapedokoMark } from '~/utils/logo'
import { shopImageUrl } from '~/utils/shop-mapper'
import {
  REQUEST_REJECTION_MAX,
  bulkApproveCopy,
  bulkProgressCopy,
  bulkRejectCopy,
  matchesRequestSearch,
  requestHoursCopy,
  requestRejectionReasonError,
  requestStatusWord,
  requestsQueueEmptyCopy,
} from '~/utils/cafe-requests'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { show: showBusy, hide: hideBusy } = useAdminBusy()
const { shops, claims, status, error, savingId, load, moderate, moderateMany } = admin
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const route = useRoute()
const query = ref('')
const activeFilter = ref<ShopStatus>('pending')
const rejectingId = ref<string | null>(null)
const rejectReason = ref('')
const rejectIssue = ref('')
const bulkIntent = ref<null | 'approve' | 'reject'>(null)
const bulkDone = ref(0)
const bulkTotal = ref(0)
const notice = ref('')
const focusId = ref('')

const filters = [
  { id: 'pending' as const, label: 'Pending' },
  { id: 'approved' as const, label: 'Approved' },
  { id: 'rejected' as const, label: 'Rejected' },
]

const logoSrc = (shop: ShopRow) => {
  const url = shopImageUrl(shop, publicBase)
  return isKapedokoMark(url) ? '' : url
}

const pending = computed(() => shops.value.filter((shop) => shop.status === 'pending'))
const queue = computed(() => pending.value.filter((shop) => matchesRequestSearch(shop, query.value)))
const pendingClaims = computed(() => claims.value.filter((claim) => claim.status === 'pending'))
const tally = computed(() => ({
  pending: pending.value.length,
  approved: shops.value.filter((shop) => shop.status === 'approved').length,
  rejected: shops.value.filter((shop) => shop.status === 'rejected').length,
}))
const visible = computed(() => shops.value.filter((shop) => (
  shop.status === activeFilter.value && matchesRequestSearch(shop, query.value)
)))
const busy = computed(() => Boolean(savingId.value))
const rejectOver = computed(() => rejectReason.value.trim().length > REQUEST_REJECTION_MAX)
const emptyCopy = computed(() => {
  if (query.value.trim()) return 'No cafes match that search.'
  return requestsQueueEmptyCopy(activeFilter.value)
})
const dockCopy = computed(() => {
  if (query.value.trim()) {
    return queue.value.length === 1
      ? 'Stamp this search result, or send it from here.'
      : `Stamp one, or send all ${queue.value.length} in this search.`
  }
  if (queue.value.length === 1) return 'Stamp this cafe, or send the whole crate from here.'
  return `Stamp one, or send all ${queue.value.length} from here.`
})
const bulkProgress = computed(() => {
  const next = bulkIntent.value === 'reject' ? 'rejected' : 'approved'
  return bulkProgressCopy(next, bulkDone.value, bulkTotal.value || queue.value.length)
})

const resetNotes = () => {
  rejectReason.value = ''
  rejectIssue.value = ''
}

const cancelReject = () => {
  rejectingId.value = null
  resetNotes()
}

const cancelBulk = () => {
  bulkIntent.value = null
  bulkDone.value = 0
  bulkTotal.value = 0
  resetNotes()
}

const startReject = async (shopId: string) => {
  cancelBulk()
  rejectingId.value = shopId
  resetNotes()
  notice.value = ''
  await nextTick()
  document.getElementById(`request-reason-${shopId}`)?.focus()
}

const startBulk = async (intent: 'approve' | 'reject') => {
  cancelReject()
  bulkIntent.value = intent
  resetNotes()
  notice.value = ''
  if (intent === 'reject') {
    await nextTick()
    document.getElementById('request-bulk-reason')?.focus()
  }
}

const onApprove = async (shop: ShopRow) => {
  const choice = await askAdmin({
    title: `Approve ${shop.name}?`,
    message: 'It goes live on Home and Map.',
    confirmLabel: 'Approve',
  })
  if (!choice.confirmed) return
  notice.value = ''
  cancelReject()
  try {
    await moderate(shop, 'approved')
    notice.value = `${shop.name} is on Home and Map.`
    toast.success('Approved', notice.value)
  } catch (err) {
    toast.error('Could not approve this cafe', err, 'Could not update this cafe.')
  }
}

const submitReject = async (shop: ShopRow) => {
  const issue = requestRejectionReasonError(rejectReason.value)
  rejectIssue.value = issue || ''
  if (issue) return
  notice.value = ''
  try {
    await moderate(shop, 'rejected', rejectReason.value.trim())
    notice.value = `${shop.name} stays off Home and Map.`
    toast.success('Rejected', notice.value)
    cancelReject()
    activeFilter.value = 'rejected'
  } catch (err) {
    toast.error('Could not reject this cafe', err, 'Could not update this cafe.')
  }
}

const confirmBulk = async (next: 'approved' | 'rejected') => {
  if (next === 'rejected') {
    const issue = requestRejectionReasonError(rejectReason.value)
    rejectIssue.value = issue || ''
    if (issue) return
  }
  const batch = queue.value
  bulkDone.value = 0
  bulkTotal.value = batch.length
  notice.value = ''
  const verb = next === 'approved' ? 'Approving' : 'Rejecting'
  showBusy(`${verb} cafes…`)
  try {
    const done = await moderateMany(
      batch,
      next,
      next === 'rejected' ? rejectReason.value.trim() : '',
      (count, total) => {
        bulkDone.value = count
        bulkTotal.value = total
        showBusy(`${verb} ${count} of ${total}…`)
      },
    )
    cancelBulk()
    if (next === 'approved') {
      notice.value = done.length === 1
        ? '1 cafe is on Home and Map.'
        : `${done.length} cafes are on Home and Map.`
      activeFilter.value = 'approved'
    } else {
      notice.value = done.length === 1
        ? '1 cafe stays off Home and Map.'
        : `${done.length} cafes stay off Home and Map.`
      activeFilter.value = 'rejected'
    }
    toast.success(next === 'approved' ? 'Approved' : 'Rejected', notice.value)
  } catch (err) {
    toast.error('Could not update these cafes', err, 'Could not update these cafes.')
  } finally {
    hideBusy()
  }
}

watch(activeFilter, () => {
  cancelReject()
  cancelBulk()
})

watch(query, () => {
  if (bulkIntent.value) cancelBulk()
})

onMounted(() => {
  const focus = typeof route.query.id === 'string' ? route.query.id : ''
  void load().then(async () => {
    if (!focus) return
    const found = shops.value.find((shop) => shop.id === focus)
    if (!found) return
    focusId.value = found.id
    if (found.status !== 'pending') activeFilter.value = found.status
    await nextTick()
    document.getElementById(`request-${found.id}`)?.scrollIntoView({ block: 'center' })
  })
})
</script>

<style scoped>
.request-notice,
.request-toolbar,
.request-ticket,
.request-dock {
  caret-color: var(--kd-primary);
}

.request-notice ::selection,
.request-toolbar ::selection,
.request-ticket ::selection,
.request-dock ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.request-notice {
  margin: 0 0 16px;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.request-toolbar {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.request-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.request-count {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.request-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 0 96px;
  list-style: none;
}

.request-ticket {
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.request-ticket.is-focus {
  border-color: var(--kd-accent);
}

.request-ticket.is-approved {
  border-color: color-mix(in srgb, var(--kd-primary) 35%, transparent);
}

.request-ticket.is-rejected {
  opacity: 0.86;
}

.request-mast {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 16px;
}

.request-mark {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--kd-accent) 18%, #faf8f5);
}

.request-mark img {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: cover;
}

.request-copy {
  min-width: 0;
  flex: 1 1 14rem;
}

.request-copy h2,
.request-copy p {
  margin: 0;
}

.request-copy h2 {
  font-size: 0.95rem;
  line-height: 1.2;
}

.request-copy p {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
}

.request-hours {
  margin-top: 2px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.request-meta {
  margin-top: 2px;
  font-size: 0.75rem;
}

.request-note {
  margin-top: 4px;
  color: var(--kd-destructive);
  font-size: 0.75rem;
}

.request-stamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.request-stamp__mark {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.request-stamp--approved {
  background: color-mix(in srgb, var(--kd-primary) 16%, #faf8f5);
  color: var(--kd-primary);
}

.request-stamp--approved .request-stamp__mark {
  background: var(--kd-primary);
}

.request-stamp--pending {
  background: color-mix(in srgb, var(--kd-accent) 28%, #faf8f5);
  color: var(--kd-ink);
}

.request-stamp--pending .request-stamp__mark {
  background: var(--kd-accent);
}

.request-stamp--rejected {
  background: color-mix(in srgb, var(--kd-destructive) 14%, #faf8f5);
  color: var(--kd-destructive);
}

.request-stamp--rejected .request-stamp__mark {
  background: var(--kd-destructive);
}

.request-stamps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.request-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.request-btn--approve {
  border: 1px solid var(--kd-accent);
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.request-ticket.is-pending .request-btn--approve:not(:disabled) {
  transform: rotate(-1.5deg);
}

.request-btn--reject {
  border: 1px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
}

.request-btn:hover:not(:disabled) {
  filter: brightness(0.97);
}

.request-btn:focus-visible,
.request-open:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.request-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.request-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.request-open {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: none;
}

.request-open:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.request-done {
  margin: 8px 0 0;
}

.request-reject {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.request-count-line {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.request-count-line.is-over {
  color: var(--kd-destructive);
  font-weight: 700;
}

.request-dock {
  position: sticky;
  bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.request-dock p {
  margin: 0;
  max-width: 36rem;
  font-size: 0.7875rem;
}

.request-dock__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.request-dock__reject {
  display: grid;
  gap: 8px;
  width: 100%;
}

@media (max-width: 767px) {
  .request-stamps .request-btn,
  .request-dock__actions .admin-btn,
  .request-dock__actions .request-btn {
    flex: 1 1 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .request-ticket.is-pending .request-btn--approve:not(:disabled),
  .request-btn:active:not(:disabled) {
    transform: none;
  }
}
</style>
