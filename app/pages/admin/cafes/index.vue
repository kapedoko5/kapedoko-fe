<template>
  <IonPage>
    <AdminShell
      title="Cafes"
      lede="Search, edit, publish, or delete a cafe immediately. Location is not limited to Metro Manila."
      :status="status"
      :error="error"
      :pending-count="counts.pending"
      :claim-count="counts.pendingClaims"
    >
      <template #actions>
        <NuxtLink class="admin-btn admin-btn--ghost" to="/admin/cafes/import">Import CSV</NuxtLink>
        <NuxtLink class="admin-btn" to="/admin/cafes/new">Add cafe</NuxtLink>
      </template>

      <p v-if="stampNotice || importedCopy" class="cafe-notice" role="status">{{ stampNotice || importedCopy }}</p>

      <AdminPendingRail :shops="pending" :status="status" />

      <div class="admin-toolbar cafe-board">
        <input
          v-model="query"
          class="admin-search"
          type="search"
          placeholder="Search cafe name or address"
          aria-label="Search cafe name or address"
        />
        <div class="cafe-filters" role="group" aria-label="Filter by status">
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            class="admin-chip"
            :class="{ 'is-active': statusFilter === filter.id }"
            :aria-pressed="statusFilter === filter.id"
            @click="statusFilter = filter.id"
          >
            <span
              v-if="filter.tone"
              class="cafe-pip"
              :class="`cafe-pip--${filter.tone}`"
              aria-hidden="true"
            />
            {{ filter.label }}
            <span class="cafe-count">{{ tally[filter.id] }}</span>
          </button>
        </div>
      </div>

      <AdminCafeLogoDialog
        class="cafe-stamp-pad"
        :shop="logoShop"
        :sources="logoSources"
        :status="logoSourcesStatus"
        :public-base="publicBase"
        :saving="busy"
        :selected-count="Math.max(selectedIds.size, logoShop ? 1 : 0)"
        @close="closeLogoPicker"
        @assign="assignLogo"
      >
        <template #ticks>
          <button type="button" class="admin-btn admin-btn--ghost" :disabled="busy" @click="tickPaged">
            This page
          </button>
          <button
            v-if="visible.length > 1"
            type="button"
            class="admin-btn"
            :disabled="busy"
            @click="tickVisible"
          >
            All {{ visible.length }} in this search
          </button>
          <button type="button" class="admin-btn admin-btn--quiet" :disabled="busy" @click="resetTicks">
            Clear extra ticks
          </button>
        </template>
      </AdminCafeLogoDialog>

      <p v-if="visible.length === 0" class="admin-meta">No cafes match that search.</p>

      <div v-else ref="ledgerEl" class="admin-ledger cafe-board" :class="{ 'is-stamping': Boolean(logoShop) }">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>
                  <span class="cafe-heading">
                    <label v-if="logoShop" class="cafe-tick">
                      <input
                        ref="pageTickEl"
                        type="checkbox"
                        :checked="pageTick === 'all'"
                        :disabled="busy"
                        @change="onPageTick"
                      />
                      <span class="sr-only">Tick cafes on this page</span>
                    </label>
                    Cafe
                  </span>
                </th>
                <th>Status</th>
                <th>Address</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="shop in paged" :key="shop.id" :class="{ 'is-ticked': selectedIds.has(shop.id) }">
                <td>
                  <div class="cafe-identity">
                    <label v-if="logoShop" class="cafe-tick">
                      <input
                        type="checkbox"
                        :checked="selectedIds.has(shop.id)"
                        :disabled="busy"
                        :aria-label="`Also stamp onto ${shop.name}`"
                        @change="toggleTick(shop.id, ($event.target as HTMLInputElement).checked)"
                      />
                    </label>
                    <AdminCafeLogoButton
                      :shop="shop"
                      :public-base="publicBase"
                      :saving="savingId === shop.id || savingId === 'logos'"
                      :expanded="logoShop?.id === shop.id"
                      @click="openLogoPicker(shop)"
                    />
                    <NuxtLink class="cafe-name" :to="`/admin/cafes/${shop.id}`">{{ shop.name }}</NuxtLink>
                  </div>
                </td>
                <td>
                  <span class="cafe-stamp" :class="`cafe-stamp--${shop.status}`">
                    <span class="cafe-stamp__mark" aria-hidden="true" />
                    {{ statusWord(shop.status) }}
                  </span>
                </td>
                <td>{{ shop.address }}</td>
                <td class="cafe-when">{{ formatAdminDate(shop.updated_at) }}</td>
                <td>
                  <AdminCafeActionsMenu
                    :shop="shop"
                    :open="menuShopId === shop.id"
                    :busy="savingId === shop.id"
                    @toggle="toggleMenu(shop.id)"
                    @close="closeMenu"
                    @select="onMenuAction(shop, $event)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-cards">
          <article
            v-for="shop in paged"
            :key="shop.id"
            class="admin-card"
            :class="{ 'is-ticked': selectedIds.has(shop.id) }"
          >
            <div class="cafe-identity">
              <label v-if="logoShop" class="cafe-tick">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(shop.id)"
                  :disabled="busy"
                  :aria-label="`Also stamp onto ${shop.name}`"
                  @change="toggleTick(shop.id, ($event.target as HTMLInputElement).checked)"
                />
              </label>
              <AdminCafeLogoButton
                :shop="shop"
                :public-base="publicBase"
                :saving="savingId === shop.id || savingId === 'logos'"
                :expanded="logoShop?.id === shop.id"
                @click="openLogoPicker(shop)"
              />
              <h2>
                <NuxtLink class="cafe-name" :to="`/admin/cafes/${shop.id}`">{{ shop.name }}</NuxtLink>
              </h2>
              <AdminCafeActionsMenu
                class="cafe-menu-slot"
                :shop="shop"
                :open="menuShopId === shop.id"
                :busy="savingId === shop.id"
                @toggle="toggleMenu(shop.id)"
                @close="closeMenu"
                @select="onMenuAction(shop, $event)"
              />
            </div>
            <p>
              <span class="cafe-stamp" :class="`cafe-stamp--${shop.status}`">
                <span class="cafe-stamp__mark" aria-hidden="true" />
                {{ statusWord(shop.status) }}
              </span>
            </p>
            <p>{{ shop.address }}</p>
          </article>
        </div>

        <div class="cafe-pages">
          <p class="cafe-pages__status" aria-live="polite">
            Showing {{ range.start }}–{{ range.end }} of {{ visible.length }}
          </p>
          <nav v-if="pageCount > 1" class="cafe-pages__nav" aria-label="Cafe pages">
            <button
              type="button"
              class="cafe-page cafe-page--step"
              :disabled="currentPage === 1"
              aria-label="Previous page"
              @click="goToPage(currentPage - 1)"
            >
              Previous
            </button>
            <template v-for="(token, index) in pageTokens" :key="`${token}-${index}`">
              <span v-if="token === 'gap'" class="cafe-page-gap" aria-hidden="true">…</span>
              <button
                v-else
                type="button"
                class="cafe-page"
                :class="{ 'is-current': token === currentPage }"
                :aria-current="token === currentPage ? 'page' : undefined"
                :aria-label="`Page ${token}`"
                @click="goToPage(token)"
              >
                {{ token }}
              </button>
            </template>
            <button
              type="button"
              class="cafe-page cafe-page--step"
              :disabled="currentPage === pageCount"
              aria-label="Next page"
              @click="goToPage(currentPage + 1)"
            >
              Next
            </button>
          </nav>
        </div>
      </div>

      <AdminConfirmDialog
        :open="Boolean(pendingAction)"
        :variant="pendingAction ? cafeDeskConfirmVariant(pendingAction.kind) : 'default'"
        :title="pendingAction ? cafeDeskConfirmTitle(pendingAction.kind, pendingAction.shop.name) : ''"
        :message="pendingAction ? cafeDeskConfirmMessage(pendingAction.kind) : ''"
        :confirm-label="pendingAction ? cafeDeskConfirmAction(pendingAction.kind) : ''"
        :busy-label="pendingAction ? cafeDeskBusyLabel(pendingAction.kind) : ''"
        :busy="Boolean(pendingAction && savingId === pendingAction.shop.id)"
        :prompt-label="pendingAction?.kind === 'reject' ? 'Why this listing stays off Home and Map' : ''"
        v-model:prompt-value="rejectReason"
        :prompt-error="rejectIssue"
        @confirm="confirmPending"
        @cancel="cancelPending"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter } from '@ionic/vue'
import AdminCafeActionsMenu from '~/components/admin/AdminCafeActionsMenu.vue'
import AdminCafeLogoButton from '~/components/admin/AdminCafeLogoButton.vue'
import AdminCafeLogoDialog from '~/components/admin/AdminCafeLogoDialog.vue'
import AdminConfirmDialog from '~/components/admin/AdminConfirmDialog.vue'
import AdminPendingRail from '~/components/admin/AdminPendingRail.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { ShopRow, ShopStatus } from '~/types/shop'
import {
  cafeLogoSources,
  logoOverwriteCount,
  logoTickState,
  stampLogoConfirmCopy,
  stampLogoDoneCopy,
} from '~/utils/admin-logos'
import { formatAdminDate } from '~/utils/admin-nav'
import { ledgerPageCount, ledgerPageRange, ledgerPageSlice, ledgerPageTokens } from '~/utils/admin-ledger'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import {
  cafeDeskBusyLabel,
  cafeDeskConfirmAction,
  cafeDeskConfirmMessage,
  cafeDeskConfirmTitle,
  cafeDeskConfirmVariant,
  cafeDeskDoneCopy,
  shopStatusWord,
  type CafeDeskAction,
} from '~/utils/admin-shop'
import { requestRejectionReasonError } from '~/utils/cafe-requests'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const route = useRoute()
const config = useRuntimeConfig()
const { shops, counts, status, error, savingId, load, moderate, updateShopLogos, deleteShop } = admin
const publicBase = String(config.public.r2PublicBaseUrl || '')
const query = ref('')
const logoShop = ref<ShopRow | null>(null)
const menuShopId = ref<string | null>(null)
const pendingAction = ref<{ shop: ShopRow; kind: Exclude<CafeDeskAction, 'edit'> } | null>(null)
const rejectReason = ref('')
const rejectIssue = ref('')
const selectedIds = ref<Set<string>>(new Set())
const stampNotice = ref('')
const pageTickEl = ref<HTMLInputElement | null>(null)
const statusFilter = ref<'all' | ShopStatus>(Number(route.query.imported) > 0 ? 'hidden' : 'all')
const importedCopy = computed(() => {
  const count = Number(route.query.imported)
  if (!Number.isFinite(count) || count < 1) return ''
  return count === 1
    ? '1 cafe landed unpublished. Publish when the address looks right.'
    : `${count} cafes landed unpublished. Publish when the addresses look right.`
})
const page = ref(1)
const ledgerEl = ref<HTMLElement | null>(null)
const filters = [
  { id: 'all' as const, label: 'All', tone: '' },
  { id: 'approved' as const, label: 'Approved', tone: 'approved' },
  { id: 'hidden' as const, label: 'Hidden', tone: 'hidden' },
  { id: 'pending' as const, label: 'Pending', tone: 'pending' },
  { id: 'rejected' as const, label: 'Rejected', tone: 'rejected' },
]

const pending = computed(() => shops.value.filter((shop) => shop.status === 'pending'))
const tally = computed(() => ({
  all: shops.value.length,
  approved: shops.value.filter((shop) => shop.status === 'approved').length,
  hidden: shops.value.filter((shop) => shop.status === 'hidden').length,
  pending: pending.value.length,
  rejected: shops.value.filter((shop) => shop.status === 'rejected').length,
}))
const visible = computed(() => {
  const term = query.value.trim().toLowerCase()
  return shops.value.filter((shop) => {
    if (statusFilter.value !== 'all' && shop.status !== statusFilter.value) return false
    if (!term) return true
    return `${shop.name} ${shop.address}`.toLowerCase().includes(term)
  })
})
const pageCount = computed(() => ledgerPageCount(visible.value.length))
const currentPage = computed(() => Math.min(page.value, pageCount.value))
const paged = computed(() => ledgerPageSlice(visible.value, currentPage.value))
const range = computed(() => ledgerPageRange(visible.value.length, currentPage.value))
const pageTokens = computed(() => ledgerPageTokens(currentPage.value, pageCount.value))
const logoSources = computed(() => cafeLogoSources(shops.value, publicBase))
const logoSourcesStatus = computed(() => {
  if (status.value === 'loading' || status.value === 'idle') return 'loading' as const
  if (status.value === 'error' || status.value === 'forbidden') return 'error' as const
  return 'ready' as const
})
const busy = computed(() => Boolean(savingId.value))
const pageTick = computed(() => logoTickState(paged.value.map((shop) => shop.id), selectedIds.value))
const selectedShops = computed(() => shops.value.filter((shop) => selectedIds.value.has(shop.id)))

const closeMenu = () => {
  menuShopId.value = null
}

const toggleMenu = (id: string) => {
  menuShopId.value = menuShopId.value === id ? null : id
}

watch([query, statusFilter], () => {
  page.value = 1
  closeMenu()
})

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

const scrollLedgerIntoView = async (el: HTMLElement) => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth'
  const content = el.closest('ion-content') as (HTMLElement & { getScrollElement?: () => Promise<HTMLElement> }) | null
  if (content?.getScrollElement) {
    const scroller = await content.getScrollElement()
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    scroller.scrollTo({ top: Math.max(0, top - 8), behavior })
    return
  }
  el.scrollIntoView({ block: 'start', behavior })
}

const goToPage = (next: number) => {
  const target = Math.min(Math.max(1, next), pageCount.value)
  if (target === currentPage.value) return
  closeMenu()
  page.value = target
  void nextTick(() => {
    const el = ledgerEl.value
    if (el) void scrollLedgerIntoView(el)
  })
}

const statusWord = shopStatusWord

const openLogoPicker = (shop: ShopRow) => {
  closeMenu()
  stampNotice.value = ''
  if (!logoShop.value) {
    selectedIds.value = new Set([shop.id])
  } else {
    const next = new Set(selectedIds.value)
    next.add(shop.id)
    selectedIds.value = next
  }
  logoShop.value = shop
}

const closeLogoPicker = () => {
  logoShop.value = null
  selectedIds.value = new Set()
}

const toggleTick = (id: string, on: boolean) => {
  const next = new Set(selectedIds.value)
  if (on) next.add(id)
  else next.delete(id)
  selectedIds.value = next
}

const tickPaged = () => {
  const next = new Set(selectedIds.value)
  for (const shop of paged.value) next.add(shop.id)
  selectedIds.value = next
}

const tickVisible = () => {
  selectedIds.value = new Set(visible.value.map((shop) => shop.id))
}

const resetTicks = () => {
  selectedIds.value = new Set(logoShop.value ? [logoShop.value.id] : [])
}

const onPageTick = (event: Event) => {
  const on = (event.target as HTMLInputElement).checked
  const next = new Set(selectedIds.value)
  for (const shop of paged.value) {
    if (on) next.add(shop.id)
    else next.delete(shop.id)
  }
  selectedIds.value = next
}

const assignLogo = async (payload: { logoFile: File | null; logoObjectKey: string | null }) => {
  const queue = selectedShops.value.length > 0
    ? selectedShops.value
    : logoShop.value
      ? [logoShop.value]
      : []
  if (queue.length === 0) return
  if (queue.length > 1) {
    const overwrite = logoOverwriteCount(
      queue,
      new Set(queue.map((shop) => shop.id)),
      payload.logoObjectKey,
      Boolean(payload.logoFile),
    )
    const choice = await askAdmin({
      title: 'Stamp this logo?',
      message: stampLogoConfirmCopy(queue.length, overwrite),
      confirmLabel: 'Stamp logo',
      variant: overwrite > 0 ? 'warning' : 'default',
    })
    if (!choice.confirmed) return
  }
  try {
    const done = await updateShopLogos(queue, payload)
    const copy = stampLogoDoneCopy(done.length)
    stampNotice.value = copy
    toast.success('Logo stamped', copy)
    closeLogoPicker()
  } catch (err) {
    toast.error('Could not stamp this logo', err, 'Could not stamp this logo.')
  }
}

watch(pageTick, (state) => {
  if (pageTickEl.value) pageTickEl.value.indeterminate = state === 'some'
})

const onMenuAction = (shop: ShopRow, action: Exclude<CafeDeskAction, 'edit'>) => {
  closeMenu()
  rejectReason.value = ''
  rejectIssue.value = ''
  pendingAction.value = { shop, kind: action }
}

const cancelPending = () => {
  if (pendingAction.value && savingId.value === pendingAction.value.shop.id) return
  pendingAction.value = null
  rejectReason.value = ''
  rejectIssue.value = ''
}

const confirmPending = async () => {
  const current = pendingAction.value
  if (!current) return
  if (current.kind === 'reject') {
    const issue = requestRejectionReasonError(rejectReason.value)
    rejectIssue.value = issue || ''
    if (issue) return
  }
  try {
    if (current.kind === 'delete') {
      await deleteShop(current.shop)
      if (logoShop.value?.id === current.shop.id) closeLogoPicker()
      else {
        const next = new Set(selectedIds.value)
        next.delete(current.shop.id)
        selectedIds.value = next
      }
    } else if (current.kind === 'unpublish') {
      await moderate(current.shop, 'hidden')
    } else if (current.kind === 'reject') {
      await moderate(current.shop, 'rejected', rejectReason.value.trim())
    } else {
      await moderate(current.shop, 'approved')
    }
    const copy = cafeDeskDoneCopy(current.kind, current.shop.name)
    stampNotice.value = copy
    toast.success(cafeDeskConfirmAction(current.kind), copy)
    pendingAction.value = null
    rejectReason.value = ''
    rejectIssue.value = ''
  } catch (err) {
    toast.error('Could not update this cafe', err, adminActionErrorMessage(err, 'Could not update this cafe.'))
  }
}

onMounted(() => {
  void load()
})

onIonViewWillEnter(() => {
  if (status.value === 'ready') void load({ silent: true })
})
</script>

<style scoped>
.cafe-notice {
  margin: 0 0 16px;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.cafe-stamp-pad {
  position: sticky;
  top: 8px;
  z-index: 3;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--kd-ink) 8%, transparent);
}

.cafe-stamp-pad :deep(.admin-btn) {
  transform: rotate(-1.25deg);
}

.cafe-stamp-pad :deep(.admin-btn--ghost),
.cafe-stamp-pad :deep(.admin-btn--quiet) {
  transform: none;
}

.cafe-heading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cafe-tick {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0;
  flex: 0 0 auto;
  cursor: pointer;
}

.cafe-tick input {
  width: 18px;
  height: 18px;
  accent-color: var(--kd-primary);
  cursor: pointer;
}

.cafe-tick input:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-board.admin-ledger.is-stamping tr.is-ticked td,
.admin-card.is-ticked {
  background: color-mix(in srgb, var(--kd-accent) 12%, #faf8f5);
}

.cafe-board {
  caret-color: var(--kd-primary);
}

.cafe-board ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.cafe-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cafe-filters .admin-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-color: color-mix(in srgb, var(--kd-ink) 16%, transparent);
}

.cafe-filters .admin-chip.is-active {
  border-color: var(--kd-accent);
}

.cafe-pip {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.cafe-pip--approved {
  background: var(--kd-primary);
}

.cafe-pip--pending {
  background: var(--kd-accent);
}

.cafe-pip--hidden {
  background: color-mix(in srgb, var(--kd-ink) 45%, #faf8f5);
}

.cafe-pip--rejected {
  background: var(--kd-destructive);
}

.cafe-count {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.cafe-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cafe-menu-slot {
  margin-left: auto;
}

.cafe-identity h2 {
  min-width: 0;
  flex: 1 1 auto;
}

.cafe-name {
  min-width: 0;
  color: var(--kd-ink);
  font-weight: 700;
  text-decoration: none;
}

.cafe-name:hover {
  color: var(--kd-primary);
}

.cafe-name:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-stamp {
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

.cafe-stamp__mark {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.cafe-stamp--approved {
  background: color-mix(in srgb, var(--kd-primary) 16%, #faf8f5);
  color: var(--kd-primary);
}

.cafe-stamp--approved .cafe-stamp__mark {
  background: var(--kd-primary);
}

.cafe-stamp--pending {
  background: color-mix(in srgb, var(--kd-accent) 28%, #faf8f5);
  color: var(--kd-ink);
}

.cafe-stamp--pending .cafe-stamp__mark {
  background: var(--kd-accent);
}

.cafe-stamp--hidden {
  background: color-mix(in srgb, var(--kd-ink) 10%, #faf8f5);
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
}

.cafe-stamp--hidden .cafe-stamp__mark {
  background: color-mix(in srgb, var(--kd-ink) 45%, #faf8f5);
}

.cafe-stamp--rejected {
  background: color-mix(in srgb, var(--kd-destructive) 14%, #faf8f5);
  color: var(--kd-destructive);
}

.cafe-stamp--rejected .cafe-stamp__mark {
  background: var(--kd-destructive);
}

.cafe-when {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.cafe-board.admin-ledger th,
.cafe-board.admin-ledger td {
  vertical-align: middle;
}

.cafe-board.admin-ledger th:last-child,
.cafe-board.admin-ledger td:last-child {
  width: 1%;
}

.cafe-pages {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 8px 0 12px;
}

.cafe-pages__status {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.cafe-pages__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.cafe-page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.cafe-page--step {
  padding: 0 14px;
  border-color: var(--kd-primary);
  color: var(--kd-primary);
}

.cafe-page.is-current {
  background: color-mix(in srgb, var(--kd-primary) 16%, #faf8f5);
  color: var(--kd-primary);
}

.cafe-page-gap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 44px;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-variant-numeric: tabular-nums;
}

.cafe-page:hover:not(:disabled):not(.is-current) {
  background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
}

.cafe-page:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-page:active:not(:disabled) {
  transform: translateY(1px);
}

.cafe-page:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .cafe-stamp-pad :deep(.admin-btn) {
    flex: 1 1 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cafe-page:active:not(:disabled),
  .cafe-stamp-pad :deep(.admin-btn) {
    transform: none;
  }
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
