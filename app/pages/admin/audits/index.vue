<template>
  <IonPage>
    <AdminShell
      title="Audits"
      lede="Needs-recheck first, then stale visits. Current team visits sit below."
      :status="pageStatus"
      :error="pageError"
      :nav-role="navRole"
    >
      <template #actions>
        <NuxtLink class="admin-btn" to="/admin/audits/new">New audit</NuxtLink>
      </template>

      <section class="audit-queue" aria-labelledby="audit-queue-heading">
        <div class="audit-queue__head">
          <h2 id="audit-queue-heading">Needs a visit</h2>
          <p v-if="queueCountCopy">{{ queueCountCopy }}</p>
        </div>

        <p
          v-if="queueTickets.length === 0"
          class="audit-slip audit-slip--sheet"
          :class="{ 'audit-slip--clear': caughtUp }"
        >
          <span v-if="caughtUp" class="audit-slip__mark" aria-hidden="true">
            <Check :size="16" :stroke-width="2.25" />
          </span>
          <span>{{ queueEmptyCopy }}</span>
        </p>

        <div v-else class="audit-queue__scroller">
          <NuxtLink
            v-for="ticket in queueTickets"
            :key="ticket.id"
            class="admin-ticket"
            :class="ticket.urgency === 'stale' ? 'audit-ticket--stale' : 'audit-ticket--recheck'"
            :to="ticket.to"
          >
            <span class="admin-ticket__name">{{ ticket.name }}</span>
            <span class="admin-ticket__addr">{{ ticket.detail }}</span>
          </NuxtLink>
        </div>
      </section>

      <section class="audit-catalog" aria-labelledby="audited-heading">
        <div class="audit-catalog__head">
          <h2 id="audited-heading">Audited cafes</h2>
          <p v-if="auditedCountCopy">{{ auditedCountCopy }}</p>
        </div>

        <div v-if="audited.length" class="audit-catalog__find">
          <input
            v-model="query"
            class="admin-search"
            type="search"
            placeholder="Search cafe name"
            aria-label="Search audited cafes"
          />
        </div>

        <p v-if="audited.length === 0" class="audit-slip audit-slip--sheet">
          No team visits yet. Start with
          <NuxtLink class="audit-inline" to="/admin/audits/new">New audit</NuxtLink>.
        </p>
        <p
          v-else-if="visible.length === 0"
          class="audit-slip audit-slip--sheet"
          aria-live="polite"
        >
          No audited cafes match that search.
        </p>

        <div v-else class="admin-ledger audit-ledger">
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th scope="col">Cafe</th>
                  <th scope="col">Last visit</th>
                  <th scope="col">WiFi</th>
                  <th scope="col">Outlets</th>
                  <th scope="col">Pay</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in visible" :key="row.shopId">
                  <td>{{ row.name }}</td>
                  <td class="audit-when">{{ formatAdminDate(row.auditedAt) }}</td>
                  <td>
                    <span class="audit-fact" :class="amenityFactClass(row.wifi)">
                      <span class="audit-fact__mark" aria-hidden="true" />
                      {{ auditAmenityWord('wifi', row.wifi) }}
                    </span>
                  </td>
                  <td>
                    <span class="audit-fact" :class="amenityFactClass(row.outlets)">
                      <span class="audit-fact__mark" aria-hidden="true" />
                      {{ auditAmenityWord('outlets', row.outlets) }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="audit-fact audit-fact--wrap"
                      :class="factClass(paymentTone(row.qr, row.card, row.cash))"
                    >
                      <span class="audit-fact__mark" aria-hidden="true" />
                      {{ paymentWord(row.qr, row.card, row.cash) }}
                    </span>
                  </td>
                  <td>
                    <div class="audit-actions">
                      <NuxtLink class="audit-history" :to="`/admin/audits/${row.shopId}`">History</NuxtLink>
                      <NuxtLink class="audit-go" :to="`/admin/audits/new?shop=${row.shopId}`">Audit</NuxtLink>
                      <button
                        v-if="isAdmin"
                        type="button"
                        class="audit-remove"
                        :disabled="Boolean(removingId)"
                        :aria-busy="removingId === row.auditId || undefined"
                        :aria-label="removeAuditAriaLabel(row.name)"
                        @click="onRemoveAudit(row)"
                      >
                        <AdminBusyLabel :busy="removingId === row.auditId">
                          {{ removingId === row.auditId ? 'Removing…' : 'Remove audit' }}
                        </AdminBusyLabel>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="admin-cards">
            <article v-for="row in visible" :key="row.shopId" class="admin-card audit-card">
              <h2>{{ row.name }}</h2>
              <p class="audit-when">{{ formatAdminDate(row.auditedAt) }}</p>
              <div class="audit-field">
                <span class="audit-fact" :class="amenityFactClass(row.wifi)">
                  <span class="audit-fact__mark" aria-hidden="true" />
                  {{ auditAmenityCardWord('wifi', row.wifi) }}
                </span>
                <span class="audit-fact" :class="amenityFactClass(row.outlets)">
                  <span class="audit-fact__mark" aria-hidden="true" />
                  {{ auditAmenityCardWord('outlets', row.outlets) }}
                </span>
              </div>
              <p class="audit-field">
                <span class="audit-field__label">Pay</span>
                <span
                  class="audit-fact audit-fact--wrap"
                  :class="factClass(paymentTone(row.qr, row.card, row.cash))"
                >
                  <span class="audit-fact__mark" aria-hidden="true" />
                  {{ paymentWord(row.qr, row.card, row.cash) }}
                </span>
              </p>
              <p class="audit-field">
                <span class="audit-field__label">Long-stay</span>
                <span class="audit-fact" :class="factClass(stanceTone(row.longStayStance))">
                  <span class="audit-fact__mark" aria-hidden="true" />
                  {{ longStayWord(row.longStayStance) }}
                </span>
              </p>
              <div class="audit-actions">
                <NuxtLink class="audit-history" :to="`/admin/audits/${row.shopId}`">History</NuxtLink>
                <NuxtLink class="audit-go" :to="`/admin/audits/new?shop=${row.shopId}`">Audit</NuxtLink>
                <button
                  v-if="isAdmin"
                  type="button"
                  class="audit-remove"
                  :disabled="Boolean(removingId)"
                  :aria-busy="removingId === row.auditId || undefined"
                  :aria-label="removeAuditAriaLabel(row.name)"
                  @click="onRemoveAudit(row)"
                >
                  <AdminBusyLabel :busy="removingId === row.auditId">
                    {{ removingId === row.auditId ? 'Removing…' : 'Remove audit' }}
                  </AdminBusyLabel>
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { Check } from 'lucide-vue-next'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { AuditDeskCafe, AuditDeskQueueCafe } from '~/composables/useCafeAudits'
import { formatAdminDate } from '~/utils/admin-nav'
import {
  removeAuditAriaLabel,
  removeAuditReasonPromptCopy,
  voidReasonError,
} from '~/utils/audit-form'
import {
  auditAmenityCardWord,
  auditAmenityTone,
  auditAmenityWord,
  filterAuditedCafes,
  longStayWord,
  paymentTone,
  paymentWord,
  queueTicketDetail,
} from '~/utils/audit-list'

definePageMeta({
  middleware: ['auth', 'auditor'],
})

const { navRole, isAdmin, status, error, load } = useStaffSession()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const audits = useCafeAudits()
const queueCafes = ref<AuditDeskQueueCafe[]>([])
const audited = ref<AuditDeskCafe[]>([])
const query = ref('')
const loadError = ref('')
const deskStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const removingId = ref<string | null>(null)

const pageStatus = computed(() => {
  if (status.value !== 'ready') return status.value
  if (deskStatus.value === 'error') return 'error'
  if (deskStatus.value !== 'ready') return 'loading'
  return 'ready'
})
const pageError = computed(() => error.value || loadError.value)

const queueTickets = computed(() =>
  queueCafes.value.map((cafe) => ({
    id: cafe.shopId,
    name: cafe.name,
    detail: queueTicketDetail(cafe),
    to: `/admin/audits/new?shop=${cafe.shopId}`,
    urgency: cafe.urgency,
  })),
)
const queueCountCopy = computed(() => {
  const total = queueTickets.value.length
  if (total === 0) return ''
  return total === 1 ? '1 cafe' : `${total} cafes`
})
const queueEmptyCopy = computed(() =>
  audited.value.length
    ? 'Catch-up visits are current.'
    : 'No cafes need a recheck or are stale.',
)
const caughtUp = computed(() => audited.value.length > 0 && queueTickets.value.length === 0)

const visible = computed(() => filterAuditedCafes(audited.value, query.value).slice(0, 80))
const auditedCountCopy = computed(() => {
  if (!audited.value.length) return ''
  const shown = visible.value.length
  const total = audited.value.length
  if (query.value.trim() && shown !== total) {
    return `${shown} of ${total} cafes`
  }
  return total === 1 ? '1 cafe' : `${total} cafes`
})

const factClass = (tone: 'ok' | 'no' | 'unknown') => {
  if (tone === 'ok') return 'audit-fact--ok'
  if (tone === 'no') return 'audit-fact--no'
  return 'audit-fact--unknown'
}
const amenityFactClass = (result: string | null) => factClass(auditAmenityTone(result))
const stanceTone = (stance: string | null | undefined) => {
  if (stance === 'welcome') return 'ok' as const
  if (stance === 'discouraged') return 'no' as const
  return 'unknown' as const
}

const applyDesk = (desk: { queueCafes: AuditDeskQueueCafe[]; audited: AuditDeskCafe[] }) => {
  queueCafes.value = desk.queueCafes
  audited.value = desk.audited
}

const loadDesk = async () => {
  applyDesk(await audits.loadDesk())
}

const onRemoveAudit = async (row: AuditDeskCafe) => {
  if (removingId.value) return
  const choice = await askAdmin({
    title: `Remove the latest audit for ${row.name}?`,
    message: 'This cancels that visit record. It does not delete the cafe.',
    confirmLabel: 'Remove audit',
    variant: 'destructive',
    promptLabel: removeAuditReasonPromptCopy(),
    validatePrompt: voidReasonError,
  })
  if (!choice.confirmed) return
  removingId.value = row.auditId
  loadError.value = ''
  try {
    await audits.voidAudit(row.auditId, choice.prompt)
    await loadDesk()
    toast.success('Audit removed', `${row.name} no longer uses that visit.`)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Could not remove that audit.'
    toast.error('Could not remove that audit', err, 'Could not remove that audit.')
  } finally {
    removingId.value = null
  }
}

onMounted(async () => {
  await load()
  if (status.value !== 'ready') return
  deskStatus.value = 'loading'
  try {
    await loadDesk()
    deskStatus.value = 'ready'
  } catch (err) {
    deskStatus.value = 'error'
    loadError.value = err instanceof Error ? err.message : 'Could not load audits.'
  }
})
</script>

<style scoped>
.audit-queue {
  margin: 0 0 32px;
}

.audit-queue__head,
.audit-catalog__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.audit-queue__head {
  margin-bottom: 10px;
}

.audit-catalog__head {
  margin-bottom: 8px;
}

.audit-queue__head h2,
.audit-catalog__head h2 {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.audit-queue__head p,
.audit-catalog__head p {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.audit-slip {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.35;
}

.audit-slip--clear {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audit-slip__mark {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--kd-primary) 14%, #faf8f5);
  color: var(--kd-primary);
}

.audit-slip__mark svg {
  display: block;
}

.audit-slip--sheet {
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.audit-queue .audit-slip--sheet {
  width: fit-content;
  max-width: 100%;
}

.audit-inline {
  color: var(--kd-primary);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.audit-catalog {
  caret-color: var(--kd-primary);
}

.audit-catalog ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.audit-catalog__find {
  margin-bottom: 12px;
}

.audit-queue__scroller {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  margin: 0 -4px;
  padding: 4px 4px 6px;
  scroll-padding-inline: 4px;
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 28%, transparent) #faf8f5;
}

.audit-queue .admin-ticket {
  transition:
    filter 150ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 120ms cubic-bezier(0.16, 1, 0.3, 1);
}

.audit-queue .admin-ticket.audit-ticket--stale {
  border: 1px solid var(--kd-accent);
  background: #faf8f5;
  color: var(--kd-ink);
}

.audit-queue .admin-ticket.audit-ticket--stale .admin-ticket__addr {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.audit-queue .admin-ticket:active {
  box-shadow: inset 0 2px 0 color-mix(in srgb, var(--kd-ink) 24%, transparent);
}

.audit-when {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.audit-fact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
}

.audit-fact--wrap {
  white-space: normal;
}

.audit-fact--ok {
  color: var(--kd-primary);
}

.audit-fact--no {
  color: var(--kd-destructive);
}

.audit-fact__mark {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 16px;
  box-shadow: inset 0 0 0 1.5px currentColor;
}

.audit-fact--ok .audit-fact__mark,
.audit-fact--no .audit-fact__mark {
  background: currentColor;
  box-shadow: none;
}

.audit-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.audit-field__label {
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
}

.audit-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  width: max-content;
}

.audit-history,
.audit-go,
.audit-remove {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.audit-history {
  color: var(--kd-primary);
}

.audit-remove {
  border: 0;
  background: transparent;
  color: var(--kd-destructive);
  cursor: pointer;
}

.audit-remove:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.audit-go {
  border: 1px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
  transition: background-color 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.audit-catalog .admin-ledger.audit-ledger th,
.audit-catalog .admin-ledger.audit-ledger td {
  vertical-align: middle;
  padding-top: 6px;
  padding-bottom: 6px;
}

.audit-catalog .admin-ledger.audit-ledger th:last-child,
.audit-catalog .admin-ledger.audit-ledger td:last-child {
  width: 1%;
  padding-right: 0;
  text-align: right;
  white-space: nowrap;
}

.audit-catalog .admin-ledger.audit-ledger .audit-actions {
  justify-content: flex-end;
}

.audit-catalog .admin-ledger.audit-ledger tbody tr:focus-within {
  background: color-mix(in srgb, var(--kd-primary) 8%, #faf8f5);
}

.audit-catalog .audit-card.admin-card h2 {
  overflow-wrap: anywhere;
}

.audit-catalog .audit-card .audit-when,
.audit-catalog .audit-card .audit-field {
  color: var(--kd-ink);
}

.audit-inline:focus-visible,
.audit-history:focus-visible,
.audit-go:focus-visible,
.audit-remove:focus-visible,
.audit-queue .admin-ticket:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .audit-catalog .admin-ledger.audit-ledger tbody tr:hover {
    background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
  }

  .audit-history:hover,
  .audit-remove:hover:not(:disabled) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .audit-go:hover {
    background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
  }

  .audit-inline:hover {
    color: var(--kd-ink);
  }
}

.audit-go:active {
  background: color-mix(in srgb, var(--kd-primary) 16%, #faf8f5);
}

@media (max-width: 767px) {
  .audit-when {
    white-space: normal;
  }

  .audit-catalog .admin-ledger.audit-ledger .audit-actions,
  .audit-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .audit-history,
  .audit-go,
  .audit-remove {
    flex: 1 1 0;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .audit-slip__mark {
    animation: audit-print 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
}

@keyframes audit-print {
  from {
    clip-path: inset(0 100% 0 0 round 8px);
  }

  to {
    clip-path: inset(0 0 0 0 round 8px);
  }
}
</style>
