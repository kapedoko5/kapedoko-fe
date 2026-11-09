<template>
  <IonPage>
    <AdminShell
      title="New audit"
      lede="One visit, both amenities, under three minutes. Save still works after a weak signal."
      :status="pageStatus"
      :error="pageError"
      :nav-role="navRole"
    >
      <form class="audit-visit" @submit.prevent="onSubmit">
        <div class="audit-progress" role="status">
          <p>{{ progressLabel }}</p>
          <div class="audit-progress__ticks" aria-hidden="true">
            <span v-for="step in steps" :key="step.id" :class="{ 'is-on': step.done }" />
          </div>
        </div>
        <p v-if="draft.correctsAuditId" class="audit-aside">This visit corrects an earlier audit.</p>

        <section id="audit-cafe" class="audit-block" aria-labelledby="audit-cafe-title">
          <h2 id="audit-cafe-title">
            <Coffee :size="16" :stroke-width="2.25" aria-hidden="true" />
            Cafe
          </h2>
          <AdminSearchPicker
            v-model="draft.shopId"
            required
            title="Choose a cafe"
            placeholder="Search an approved cafe"
            search-placeholder="Cafe name or address"
            empty-copy="No approved cafes yet."
            no-match-copy="No cafes match that search."
            loading-copy="Loading cafes…"
            error-copy="Could not load cafes."
            item-label="cafe"
            :options="options"
            :status="pickerStatus"
            :invalid="Boolean(visible.shop)"
            :described-by="visible.shop ? 'audit-cafe-error' : undefined"
          />
          <p v-if="visible.shop" id="audit-cafe-error" class="audit-issue" role="alert">{{ visible.shop }}</p>
        </section>

        <div class="audit-visit__pair">
          <section id="audit-wifi" class="audit-block" aria-labelledby="audit-wifi-title">
            <h2 id="audit-wifi-title">
              <Wifi :size="16" :stroke-width="2.25" aria-hidden="true" />
              WiFi
            </h2>
            <AuditChoiceGroup
              v-model="draft.wifi.result"
              legend="WiFi result"
              hide-legend
              :options="resultOptions"
              :error="wifiSlot(visible.wifi) === 'result' ? visible.wifi : null"
            />
            <div v-if="draft.wifi.result === 'available'" class="audit-stack">
              <div class="audit-split">
                <label class="audit-field">
                  <span>Download Mbps</span>
                  <input
                    v-model="draft.wifi.downloadMbps"
                    inputmode="decimal"
                    autocomplete="off"
                    :class="{ 'is-invalid': wifiSlot(visible.wifi) === 'download' }"
                    :aria-invalid="wifiSlot(visible.wifi) === 'download' || undefined"
                    :aria-describedby="wifiSlot(visible.wifi) === 'download' ? 'audit-wifi-download-error' : undefined"
                  >
                </label>
                <label class="audit-field">
                  <span>Upload Mbps</span>
                  <input
                    v-model="draft.wifi.uploadMbps"
                    inputmode="decimal"
                    autocomplete="off"
                    :class="{ 'is-invalid': wifiSlot(visible.wifi) === 'upload' }"
                    :aria-invalid="wifiSlot(visible.wifi) === 'upload' || undefined"
                    :aria-describedby="wifiSlot(visible.wifi) === 'upload' ? 'audit-wifi-upload-error' : undefined"
                  >
                </label>
              </div>
              <p v-if="wifiSlot(visible.wifi) === 'download'" id="audit-wifi-download-error" class="audit-issue" role="alert">{{ visible.wifi }}</p>
              <p v-if="wifiSlot(visible.wifi) === 'upload'" id="audit-wifi-upload-error" class="audit-issue" role="alert">{{ visible.wifi }}</p>
              <label class="audit-field">
                <span class="audit-field__line">
                  <span>Network name</span>
                  <span class="audit-field__hint">Staff only</span>
                </span>
                <input v-model="draft.wifi.networkName" autocomplete="off">
              </label>
            </div>
            <label class="audit-field">
              <span class="audit-field__line">
                <span>{{ draft.wifi.result === 'unknown' ? 'Why WiFi is unknown' : 'WiFi notes' }}</span>
                <span v-if="draft.wifi.result === 'unknown'" class="audit-field__need">Needed</span>
              </span>
              <textarea
                v-model="draft.wifi.notes"
                rows="2"
                autocomplete="off"
                :class="{ 'is-invalid': wifiSlot(visible.wifi) === 'notes' }"
                :aria-invalid="wifiSlot(visible.wifi) === 'notes' || undefined"
                :aria-describedby="wifiSlot(visible.wifi) === 'notes' ? 'audit-wifi-notes-error' : undefined"
              />
            </label>
            <p v-if="wifiSlot(visible.wifi) === 'notes'" id="audit-wifi-notes-error" class="audit-issue" role="alert">{{ visible.wifi }}</p>
          </section>

          <section id="audit-outlets" class="audit-block" aria-labelledby="audit-outlets-title">
            <h2 id="audit-outlets-title">
              <Plug :size="16" :stroke-width="2.25" aria-hidden="true" />
              Outlets
            </h2>
            <AuditChoiceGroup
              v-model="draft.outlets.result"
              legend="Outlets result"
              hide-legend
              :options="resultOptions"
              :error="outletSlot(visible.outlets) === 'result' ? visible.outlets : null"
            />
            <div v-if="draft.outlets.result === 'available'" class="audit-stack">
              <label class="audit-field">
                <span>Approximate count</span>
                <input
                  v-model="draft.outlets.approxCount"
                  inputmode="numeric"
                  autocomplete="off"
                  :class="{ 'is-invalid': outletSlot(visible.outlets) === 'count' }"
                  :aria-invalid="outletSlot(visible.outlets) === 'count' || undefined"
                  :aria-describedby="outletSlot(visible.outlets) === 'count' ? 'audit-outlets-count-error' : undefined"
                >
              </label>
              <p v-if="outletSlot(visible.outlets) === 'count'" id="audit-outlets-count-error" class="audit-issue" role="alert">{{ visible.outlets }}</p>
              <AuditChoiceGroup
                v-model="draft.outlets.reliability"
                legend="How easy are the outlets?"
                :needed="!draft.outlets.reliability"
                :options="reliabilityOptions"
                :error="outletSlot(visible.outlets) === 'reliability' ? visible.outlets : null"
              />
            </div>
            <label class="audit-field">
              <span>Seating near outlets</span>
              <textarea v-model="draft.outlets.seatingNearOutletNotes" rows="2" autocomplete="off" />
            </label>
            <label class="audit-field">
              <span class="audit-field__line">
                <span>{{ draft.outlets.result === 'unknown' ? 'Why outlets are unknown' : 'Outlet notes' }}</span>
                <span v-if="draft.outlets.result === 'unknown'" class="audit-field__need">Needed</span>
              </span>
              <textarea
                v-model="draft.outlets.notes"
                rows="2"
                autocomplete="off"
                :class="{ 'is-invalid': outletSlot(visible.outlets) === 'notes' }"
                :aria-invalid="outletSlot(visible.outlets) === 'notes' || undefined"
                :aria-describedby="outletSlot(visible.outlets) === 'notes' ? 'audit-outlets-notes-error' : undefined"
              />
            </label>
            <p v-if="outletSlot(visible.outlets) === 'notes'" id="audit-outlets-notes-error" class="audit-issue" role="alert">{{ visible.outlets }}</p>
          </section>
        </div>

        <section id="audit-pay" class="audit-block" aria-labelledby="audit-pay-title">
          <h2 id="audit-pay-title">
            <Wallet :size="16" :stroke-width="2.25" aria-hidden="true" />
            Payment
          </h2>
          <div class="audit-pay">
            <AuditChoiceGroup
              v-for="method in paymentMethods"
              :key="method.id"
              :model-value="draft.payment[method.id]"
              :legend="method.label"
              :options="paymentOptions"
              :invalid="payMissing(method.id)"
              :described-by="payMissing(method.id) ? 'audit-pay-error' : undefined"
              @update:model-value="draft.payment[method.id] = $event"
            />
          </div>
          <p v-if="visible.payment" id="audit-pay-error" class="audit-issue" role="alert">{{ visible.payment }}</p>
        </section>

        <div class="audit-visit__pair">
          <section id="audit-stay" class="audit-block" aria-labelledby="audit-stay-title">
            <h2 id="audit-stay-title">
              <Hourglass :size="16" :stroke-width="2.25" aria-hidden="true" />
              Long-stay stance
            </h2>
            <AuditChoiceGroup
              v-model="draft.longStayStance"
              legend="Long-stay stance"
              hide-legend
              :options="stanceOptions"
              :error="visible.longStay"
            />
            <label class="audit-check">
              <input v-model="draft.staffConfirmedLongStay" type="checkbox">
              <span class="audit-check__box" aria-hidden="true" />
              <span>Asked staff</span>
            </label>
          </section>

          <section id="audit-notes" class="audit-block" aria-labelledby="audit-notes-title">
            <h2 id="audit-notes-title">
              <PenLine :size="16" :stroke-width="2.25" aria-hidden="true" />
              Notes
            </h2>
            <label class="audit-field">
              <span>Seating capacity estimate</span>
              <input
                v-model="draft.seatingCapacity"
                inputmode="numeric"
                autocomplete="off"
                :class="{ 'is-invalid': Boolean(visible.seating) }"
                :aria-invalid="Boolean(visible.seating) || undefined"
                :aria-describedby="visible.seating ? 'audit-seating-error' : undefined"
              >
            </label>
            <p v-if="visible.seating" id="audit-seating-error" class="audit-issue" role="alert">{{ visible.seating }}</p>
            <label class="audit-field">
              <span>Visit notes</span>
              <textarea
                v-model="draft.notes"
                rows="3"
                autocomplete="off"
                :class="{ 'is-invalid': Boolean(visible.notes) }"
                :aria-invalid="Boolean(visible.notes) || undefined"
                :aria-describedby="visible.notes ? 'audit-visit-notes-error' : undefined"
              />
            </label>
            <p v-if="visible.notes" id="audit-visit-notes-error" class="audit-issue" role="alert">{{ visible.notes }}</p>
          </section>
        </div>

        <div class="audit-save">
          <p v-if="queueNotice" class="audit-save__note" :class="{ 'is-blocked': queueNotice.startsWith('Could not') }" role="status">{{ queueNotice }}</p>
          <button type="submit" class="admin-btn audit-save__btn" :disabled="saving" :aria-busy="saving || undefined">
            <AdminBusyLabel :busy="saving">{{ saving ? 'Saving…' : 'Save audit' }}</AdminBusyLabel>
          </button>
        </div>
      </form>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { Coffee, Hourglass, PenLine, Plug, Wallet, Wifi } from 'lucide-vue-next'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminSearchPicker from '~/components/admin/AdminSearchPicker.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import AuditChoiceGroup from '~/components/admin/AuditChoiceGroup.vue'
import type { AdminPickerOption } from '~/utils/admin-picker'
import {
  auditFormError,
  auditFormHasErrors,
  emptyAuditDraft,
  PAYMENT_CHOICES,
  PAYMENT_METHODS,
  type AuditAmenityResult,
  type CafeAuditFormErrors,
  type LongStayStance,
  type PaymentMethod,
} from '~/utils/audit-form'
import { POWER_ACCESS_OPTIONS } from '~/utils/cafe-review'

definePageMeta({
  middleware: ['auth', 'auditor'],
})

const route = useRoute()
const toast = useAdminToast()
const { navRole, status, error, load } = useStaffSession()
const audits = useCafeAudits()
const draft = reactive(emptyAuditDraft())
const options = ref<AdminPickerOption[]>([])
const pickerStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const saving = ref(false)
const queueNotice = ref('')
const formError = ref('')
const attempted = ref(false)
const resultOptions: Array<{ value: AuditAmenityResult; label: string }> = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'unknown', label: 'Unknown' },
]
const stanceOptions: Array<{ value: LongStayStance; label: string }> = [
  { value: 'welcome', label: 'Welcome' },
  { value: 'discouraged', label: 'Discouraged' },
  { value: 'unknown', label: 'Unknown' },
]
const paymentMethods = PAYMENT_METHODS
const paymentOptions = PAYMENT_CHOICES.map((choice) => ({ value: choice.id, label: choice.label }))
const reliabilityOptions = POWER_ACCESS_OPTIONS

const issues = computed(() => auditFormError(draft))
const visible = computed(() => (attempted.value ? issues.value : {
  shop: null,
  wifi: null,
  outlets: null,
  longStay: null,
  payment: null,
  seating: null,
  notes: null,
  photos: null,
}))
const steps = computed(() => [
  { id: 'cafe', label: 'Cafe', done: !issues.value.shop },
  { id: 'wifi', label: 'WiFi', done: !issues.value.wifi },
  { id: 'outlets', label: 'Outlets', done: !issues.value.outlets },
  { id: 'pay', label: 'Pay', done: !issues.value.payment },
  { id: 'stay', label: 'Stay', done: !issues.value.longStay },
])
const progressLabel = computed(() => {
  const done = steps.value.filter((step) => step.done).length
  const clear = !auditFormHasErrors(issues.value)
  if (done === steps.value.length && clear) return 'Ready to save.'
  if (done === 0) return attempted.value ? '0 of 5 answered.' : 'Five answers, then save.'
  return `${done} of ${steps.value.length} answered.`
})
const pageStatus = computed(() => (status.value === 'ready' ? pickerStatus.value === 'error' ? 'error' : 'ready' : status.value))
const pageError = computed(() => error.value || formError.value)

const ISSUE_TARGETS: Array<[keyof CafeAuditFormErrors, string]> = [
  ['shop', 'audit-cafe'],
  ['wifi', 'audit-wifi'],
  ['outlets', 'audit-outlets'],
  ['payment', 'audit-pay'],
  ['longStay', 'audit-stay'],
  ['seating', 'audit-notes'],
  ['notes', 'audit-notes'],
]

function wifiSlot(message: string | null): 'result' | 'download' | 'upload' | 'notes' | null {
  if (!message) return null
  if (message.startsWith('Download')) return 'download'
  if (message.startsWith('Upload')) return 'upload'
  if (message.includes('unknown') || message.includes('note')) return 'notes'
  return 'result'
}

function outletSlot(message: string | null): 'result' | 'count' | 'reliability' | 'notes' | null {
  if (!message) return null
  if (message.includes('reliability')) return 'reliability'
  if (message.includes('count') || message.includes('negative')) return 'count'
  if (message.includes('unknown')) return 'notes'
  return 'result'
}

function payMissing(id: PaymentMethod) {
  return Boolean(visible.value.payment) && !draft.payment[id]
}

function openSummary(current: CafeAuditFormErrors) {
  const labels = [
    current.shop ? 'cafe' : '',
    current.wifi ? 'WiFi' : '',
    current.outlets ? 'outlets' : '',
    current.payment ? 'payment' : '',
    current.longStay ? 'long-stay' : '',
    current.seating ? 'seating' : '',
    current.notes ? 'notes' : '',
  ].filter(Boolean)
  if (labels.length === 1) return `Check ${labels[0]}.`
  return `Still open: ${labels.join(', ')}.`
}

function focusIssue(current: CafeAuditFormErrors) {
  if (!import.meta.client) return
  const hit = ISSUE_TARGETS.find(([key]) => current[key])
  if (!hit) return
  const node = document.getElementById(hit[1])
  if (!node) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  const invalid = node.querySelector<HTMLElement>('[aria-invalid="true"] input, input[aria-invalid="true"], textarea[aria-invalid="true"], button[aria-invalid="true"]')
  const focusable = invalid || node.querySelector<HTMLElement>('input, button, textarea')
  focusable?.focus()
}

onMounted(async () => {
  await load()
  pickerStatus.value = 'loading'
  try {
    options.value = await audits.loadApprovedOptions()
    pickerStatus.value = 'ready'
    const shop = typeof route.query.shop === 'string' ? route.query.shop : ''
    if (shop) draft.shopId = shop
    const corrects = typeof route.query.corrects === 'string' ? route.query.corrects : ''
    if (corrects) draft.correctsAuditId = corrects
  } catch (err) {
    pickerStatus.value = 'error'
    formError.value = err instanceof Error ? err.message : 'Could not load cafes.'
    toast.warning('Could not load cafes', formError.value)
  }
})

const onSubmit = async () => {
  const current = auditFormError(draft)
  if (auditFormHasErrors(current)) {
    attempted.value = true
    formError.value = openSummary(current)
    toast.warning('Check this visit', formError.value)
    await nextTick()
    focusIssue(current)
    return
  }
  saving.value = true
  formError.value = ''
  const key = crypto.randomUUID()
  try {
    await audits.submitDraft(draft, key)
    queueNotice.value = 'Saved.'
    toast.success('Audit saved', 'The visit is on the cafe history.')
    await navigateTo('/admin/audits')
  } catch (err) {
    queueNotice.value = 'Could not reach the server. Your answers are still on this screen — tap Save again.'
    formError.value = err instanceof Error ? err.message : 'Could not save that audit.'
    toast.error('Could not save that audit', formError.value)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.audit-visit {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
  caret-color: var(--kd-primary);
}

.audit-visit ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.audit-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 28px;
}

.audit-progress__ticks {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.audit-progress__ticks span {
  width: 16px;
  height: 6px;
  background: color-mix(in srgb, var(--kd-ink) 22%, transparent);
  transition: background-color 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.audit-progress__ticks span.is-on {
  background: var(--kd-accent);
}

.audit-progress p,
.audit-aside,
.audit-save__note {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.audit-progress p {
  font-weight: 700;
}

.audit-aside {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.audit-visit__pair,
.audit-pay {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.audit-pay {
  gap: 12px;
}

.audit-block {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.audit-block h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.audit-block h2 svg {
  flex: 0 0 auto;
  color: var(--kd-accent);
}

.audit-stack {
  display: grid;
  gap: 12px;
}

.audit-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.audit-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.audit-field__line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.audit-field__hint {
  font-weight: 400;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.audit-field__need {
  color: var(--kd-destructive);
}

.audit-field input,
.audit-field textarea {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #f2f2f2;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.3;
}

.audit-field textarea {
  min-height: 88px;
  resize: vertical;
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 28%, transparent) #f2f2f2;
}

.audit-field input::placeholder,
.audit-field textarea::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.audit-field input.is-invalid,
.audit-field textarea.is-invalid {
  border-color: var(--kd-destructive);
}

.audit-field input:focus-visible,
.audit-field textarea:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.audit-check {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.3;
  cursor: pointer;
}

.audit-check input {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: 0;
  opacity: 0;
}

.audit-check__box {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 8px;
  background: #f2f2f2;
}

.audit-check input:checked + .audit-check__box {
  border-color: var(--kd-accent);
  background: var(--kd-accent);
}

.audit-check input:checked + .audit-check__box::after {
  content: '';
  width: 6px;
  height: 10px;
  border: solid var(--kd-ink);
  border-width: 0 2px 2px 0;
  transform: translateY(-1px) rotate(45deg);
}

.audit-check input:focus-visible + .audit-check__box {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.audit-issue {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.audit-save {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-bottom: env(safe-area-inset-bottom);
}

.audit-save__note {
  flex: 1 1 12rem;
  font-weight: 700;
}

.audit-save__note.is-blocked {
  color: var(--kd-destructive);
}

.audit-visit .audit-save__btn {
  width: 100%;
}

.audit-visit .audit-save__btn:disabled {
  cursor: wait;
  opacity: 0.6;
}

@media (max-width: 380px) {
  .audit-split {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) {
  .audit-visit__pair {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }

  .audit-pay {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .audit-visit .audit-save__btn {
    width: auto;
    min-width: 148px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .audit-progress__ticks span {
    transition: none;
  }
}

:root.is-android .audit-field input,
:root.is-android .audit-check {
  min-height: 48px;
}
</style>
