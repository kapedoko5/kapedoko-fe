<template>
  <IonPage>
    <AdminShell
      :title="shopName ? `${shopName} audits` : 'Cafe audits'"
      lede="Append-only history. Correct by filing a new visit. Voiding needs an admin reason."
      :status="pageStatus"
      :error="pageError"
      :nav-role="navRole"
    >
      <template #actions>
        <NuxtLink class="admin-btn" :to="`/admin/audits/new?shop=${shopId}`">New audit</NuxtLink>
      </template>

      <p v-if="visits.length === 0" class="visit-empty">
        No team visits for this cafe yet. File the first one with
        <NuxtLink class="visit-inline" :to="`/admin/audits/new?shop=${shopId}`">New audit</NuxtLink>.
      </p>

      <div v-else class="visit-log">
        <p class="visit-log__count">{{ visitCountCopy(visits.length) }}</p>

        <article
          v-for="visit in visits"
          :key="visit.id"
          class="admin-card visit-slip"
          :class="{ 'is-voided': Boolean(visit.voidReason), 'is-latest': visit.isLatest }"
        >
          <header class="visit-head">
            <div class="visit-head__when">
              <h2>{{ visit.when }}</h2>
              <p>
                Visit {{ visit.number }}
                <template v-if="visit.relative"> · {{ visit.relative }}</template>
              </p>
            </div>
            <span
              class="visit-stamp"
              :class="visit.voidReason ? 'visit-stamp--void' : 'visit-stamp--valid'"
            >
              <span class="visit-stamp__mark" aria-hidden="true" />
              {{ visit.voidReason ? 'Voided' : 'Valid' }}
            </span>
          </header>

          <p v-if="visit.voidReason" class="visit-void">{{ visit.voidReason }}</p>
          <p v-if="visit.correctsLabel" class="visit-corrects">{{ visit.correctsLabel }}</p>

          <div class="visit-facts">
            <section class="visit-group" :aria-labelledby="`visit-stay-${visit.id}`">
              <h3 :id="`visit-stay-${visit.id}`">
                <Hourglass :size="16" :stroke-width="2.25" aria-hidden="true" />
                Stay
              </h3>
              <p class="visit-fact" :class="toneClass(visit.stay.tone)">
                <span class="visit-fact__mark" aria-hidden="true" />
                {{ visit.stay.stance }}
              </p>
              <p v-if="visit.stay.askedStaff" class="visit-detail">Asked staff</p>
              <p v-if="visit.stay.seating" class="visit-detail">{{ visit.stay.seating }}</p>
            </section>

            <section class="visit-group" :aria-labelledby="`visit-connect-${visit.id}`">
              <h3 :id="`visit-connect-${visit.id}`">
                <Wifi :size="16" :stroke-width="2.25" aria-hidden="true" />
                Connectivity
              </h3>
              <p v-if="visit.connectivity.length === 0" class="visit-detail">No amenity marks on this visit.</p>
              <div v-for="fact in visit.connectivity" :key="`${visit.id}-${fact.key}`" class="visit-amenity">
                <p class="visit-amenity__label">{{ fact.label }}</p>
                <p class="visit-fact" :class="toneClass(fact.tone)">
                  <span class="visit-fact__mark" aria-hidden="true" />
                  {{ fact.value }}
                </p>
                <p v-if="fact.detail" class="visit-detail">{{ fact.detail }}</p>
              </div>
            </section>

            <section class="visit-group" :aria-labelledby="`visit-pay-${visit.id}`">
              <h3 :id="`visit-pay-${visit.id}`">
                <Wallet :size="16" :stroke-width="2.25" aria-hidden="true" />
                Payment
              </h3>
              <p class="visit-fact" :class="toneClass(visit.pay.tone)">
                <span class="visit-fact__mark" aria-hidden="true" />
                {{ visit.pay.word }}
              </p>
            </section>
          </div>

          <p v-if="visit.notes" class="visit-notes">{{ visit.notes }}</p>

          <div class="visit-actions">
            <NuxtLink
              class="admin-link"
              :to="`/admin/audits/new?shop=${shopId}&corrects=${visit.id}`"
              :aria-label="`Correct visit on ${visit.when}`"
            >
              Correct
            </NuxtLink>
            <button
              v-if="isAdmin && !visit.voidReason"
              type="button"
              class="admin-btn admin-btn--danger"
              :disabled="Boolean(voidingId)"
              :aria-busy="voidingId === visit.id || undefined"
              :aria-label="`Void visit on ${visit.when}`"
              @click="onVoid(visit.id)"
            >
              <AdminBusyLabel :busy="voidingId === visit.id">
                {{ voidingId === visit.id ? 'Voiding…' : 'Void' }}
              </AdminBusyLabel>
            </button>
          </div>
        </article>
      </div>

      <section v-if="seedReports.length" class="admin-panel visit-seeds" aria-labelledby="visit-seeds-heading">
        <h2 id="visit-seeds-heading">Seed reports</h2>
        <ul>
          <li v-for="report in seedReports" :key="report.id">
            {{ report.label }} · {{ report.result }} · {{ report.when }}
          </li>
        </ul>
      </section>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { Hourglass, Wallet, Wifi } from 'lucide-vue-next'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { isShopId, resolveLiveShopId } from '~/utils/approved-shops'
import { voidReasonError } from '~/utils/audit-form'
import {
  presentAuditHistory,
  presentSeedReports,
  visitCountCopy,
  type AuditHistoryTone,
} from '~/utils/audit-history'
import type { CafeAuditResultRow, CafeAuditRow } from '~/composables/useCafeAudits'

definePageMeta({
  middleware: ['auth', 'auditor'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const { navRole, status, error, isAdmin, load } = useStaffSession()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const api = useCafeAudits()

function resolveShopId(): string {
  const param = route.params.shopId
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return resolveLiveShopId(route.fullPath, route.path, param, {
    ionPath: String(ionRouter.routeInfo?.pathname || ''),
    href,
  })
}

const shopId = computed(() => resolveShopId())
const shopName = ref('')
const auditsList = ref<CafeAuditRow[]>([])
const results = ref<CafeAuditResultRow[]>([])
const voids = ref<Array<{ audit_id: string; reason: string }>>([])
const reports = ref<Array<{ id: string; amenity_key: string; result: string; observed_at: string }>>([])
const loadError = ref('')
const voidingId = ref('')
const historyStatus = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')

const pageStatus = computed(() => {
  if (status.value !== 'ready') return status.value
  if (historyStatus.value === 'loading') return 'loading'
  if (historyStatus.value === 'missing' || historyStatus.value === 'error') return 'error'
  return 'ready'
})
const pageError = computed(() => {
  if (status.value !== 'ready') return error.value
  if (historyStatus.value === 'missing') return 'That cafe was not found.'
  return loadError.value
})

const visits = computed(() => presentAuditHistory({
  audits: auditsList.value,
  results: results.value,
  voids: voids.value,
}))
const seedReports = computed(() => presentSeedReports(reports.value))
const toneClass = (tone: AuditHistoryTone) => {
  if (tone === 'ok') return 'visit-fact--ok'
  if (tone === 'no') return 'visit-fact--no'
  return 'visit-fact--unknown'
}

let loadSeq = 0
let loadedFor = ''
let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const loadPage = async (force = false) => {
  if (emptyIdTimer) {
    window.clearTimeout(emptyIdTimer)
    emptyIdTimer = null
  }
  if (status.value !== 'ready') await load()
  if (status.value !== 'ready') return

  const id = resolveShopId()
  if (!isShopId(id)) {
    if (id) {
      historyStatus.value = 'missing'
      auditsList.value = []
      return
    }
    historyStatus.value = loadedFor ? 'ready' : 'loading'
    emptyIdTimer = window.setTimeout(() => {
      const retry = resolveShopId()
      if (isShopId(retry)) {
        void loadPage(force)
        return
      }
      if (historyStatus.value === 'loading') historyStatus.value = 'missing'
    }, 600)
    return
  }

  if (loadedFor === id && historyStatus.value === 'ready' && !force) return

  const seq = ++loadSeq
  if (loadedFor !== id) {
    historyStatus.value = 'loading'
    shopName.value = ''
    auditsList.value = []
    results.value = []
    voids.value = []
    reports.value = []
  }
  loadError.value = ''
  try {
    const supabase = useSupabaseClient()
    const { data } = await supabase.from('shops').select('name').eq('id', id).maybeSingle()
    if (seq !== loadSeq) return
    shopName.value = (data as { name?: string } | null)?.name || ''
    const history = await api.loadHistory(id)
    if (seq !== loadSeq) return
    auditsList.value = history.audits
    results.value = history.results.filter((row) => history.audits.some((audit) => audit.id === row.audit_id))
    voids.value = history.voids
    reports.value = history.reports as Array<{ id: string; amenity_key: string; result: string; observed_at: string }>
    loadedFor = id
    historyStatus.value = 'ready'
  } catch (err) {
    if (seq !== loadSeq) return
    historyStatus.value = 'error'
    loadError.value = err instanceof Error ? err.message : 'Could not load audit history.'
  }
}

watch(
  () => [route.fullPath, route.path, route.params.shopId],
  () => {
    void loadPage()
  },
  { immediate: true },
)

onIonViewWillEnter(() => {
  void loadPage(true)
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
})

const onVoid = async (id: string) => {
  if (voidingId.value) return
  const choice = await askAdmin({
    title: 'Void this visit?',
    message: shopName.value
      ? `This cancels the visit record for ${shopName.value}. The cafe stays listed.`
      : 'This cancels that visit record. The cafe stays listed.',
    confirmLabel: 'Void visit',
    variant: 'destructive',
    promptLabel: 'Why is this audit voided?',
    validatePrompt: voidReasonError,
  })
  if (!choice.confirmed) return
  voidingId.value = id
  try {
    await api.voidAudit(id, choice.prompt)
    voids.value = [...voids.value, { audit_id: id, reason: choice.prompt }]
    toast.success('Visit voided', shopName.value ? `${shopName.value} keeps its other visits.` : 'That visit is voided.')
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Could not void that audit.'
    toast.error('Could not void that audit', err, 'Could not void that audit.')
  } finally {
    voidingId.value = ''
  }
}
</script>

<style scoped>
.visit-log,
.visit-seeds,
.visit-empty,
.visit-slip {
  caret-color: var(--kd-primary);
}

.visit-log ::selection,
.visit-seeds ::selection,
.visit-empty ::selection,
.visit-slip ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.visit-empty {
  margin: 0;
  padding: 16px;
  max-width: 42rem;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.35;
}

.visit-inline {
  color: var(--kd-primary);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.visit-log {
  display: grid;
  gap: 12px;
}

.visit-log__count {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.visit-slip {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
}

.visit-slip.is-voided {
  background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
}

.visit-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 16px;
}

.visit-head__when {
  min-width: 0;
}

.visit-slip .visit-head h2 {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.visit-slip .visit-head p,
.visit-slip p.visit-corrects,
.visit-slip p.visit-detail {
  margin: 4px 0 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.visit-stamp {
  display: inline-flex;
  flex: 0 0 auto;
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

.visit-stamp__mark {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.visit-stamp--valid {
  background: color-mix(in srgb, var(--kd-primary) 14%, #faf8f5);
  color: var(--kd-primary);
}

.visit-stamp--valid .visit-stamp__mark {
  background: var(--kd-primary);
}

.visit-stamp--void {
  background: color-mix(in srgb, var(--kd-destructive) 16%, #faf8f5);
  color: var(--kd-destructive);
}

.visit-stamp--void .visit-stamp__mark {
  background: var(--kd-destructive);
}

.visit-slip p.visit-void {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.visit-facts {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.visit-group {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
}

.visit-group h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 2px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.visit-group h3 svg {
  flex: 0 0 auto;
  color: var(--kd-accent);
}

.visit-amenity {
  display: grid;
  grid-template-columns: minmax(6.5rem, auto) minmax(0, 1fr);
  gap: 2px 10px;
  align-items: baseline;
}

.visit-slip p.visit-amenity__label {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.visit-amenity .visit-detail {
  grid-column: 1 / -1;
}

.visit-slip p.visit-fact {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.visit-fact__mark {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 0.35em;
  border-radius: 16px;
  box-shadow: inset 0 0 0 1.5px currentColor;
}

.visit-fact--ok {
  color: var(--kd-primary);
}

.visit-fact--no {
  color: var(--kd-destructive);
}

.visit-fact--ok .visit-fact__mark,
.visit-fact--no .visit-fact__mark {
  background: currentColor;
  box-shadow: none;
}

.visit-slip p.visit-notes {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.visit-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.visit-seeds {
  margin-top: 24px;
}

.visit-seeds ul {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.visit-seeds li {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.visit-inline:focus-visible,
.visit-actions :deep(.admin-link:focus-visible),
.visit-actions :deep(.admin-btn:focus-visible) {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .visit-inline:hover {
    color: var(--kd-ink);
  }
}

@media (min-width: 720px) {
  .visit-facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 24px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .visit-slip.is-latest .visit-stamp__mark {
    animation: visit-print 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
}

@keyframes visit-print {
  from {
    clip-path: inset(0 100% 0 0 round 8px);
  }

  to {
    clip-path: inset(0 0 0 0 round 8px);
  }
}
</style>
