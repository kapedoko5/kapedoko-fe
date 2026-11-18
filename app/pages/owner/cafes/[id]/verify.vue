<template>
  <IonPage>
    <OwnerShell
      :title="shop?.name ? `Verify ${shop.name}` : 'Verify your cafe'"
      lede="Send proof for WiFi speed, seating, outlets, and payment. An admin or auditor reviews each submission."
      :status="shellStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <div v-if="shop && pageStatus === 'ready'" class="owner-verify">
        <aside
          v-if="latest?.status === 'rejected'"
          class="owner-verify__notice"
          role="status"
        >
          <p class="owner-verify__notice-stamp">
            <BadgeAlert :size="15" :stroke-width="2.25" aria-hidden="true" />
            Rejected {{ formatOwnerDate(latest.reviewed_at) }}
          </p>
          <p v-if="latest.rejection_reason" class="owner-verify__notice-copy">
            {{ latest.rejection_reason }}
          </p>
          <p class="owner-verify__notice-next">Send a new proof.</p>
        </aside>
        <p
          v-else-if="statusCopy"
          class="owner-verify__status"
          :class="latest ? `is-${latest.status}` : 'is-idle'"
        >
          {{ statusCopy }}
        </p>

        <form class="owner-verify__form" @submit.prevent="onSubmit">
          <section class="owner-verify__block" :class="{ 'is-on': draft.includeWifi }" aria-labelledby="verify-wifi">
            <div class="owner-verify__mast">
              <h2 id="verify-wifi" class="owner-verify__title">
                <Wifi :size="15" :stroke-width="2.25" aria-hidden="true" />
                WiFi speed
              </h2>
              <label class="owner-chip" :class="{ 'is-active': draft.includeWifi }">
                <input v-model="draft.includeWifi" class="sr-only" type="checkbox" />
                {{ draft.includeWifi ? 'Included' : 'Include' }}
              </label>
            </div>
            <div v-if="draft.includeWifi" class="owner-verify__fields">
              <p class="owner-verify__hint">Screenshot from fast.com, plus the download Mbps it shows.</p>
              <div class="owner-verify__photo">
                <img
                  v-if="wifiPreview"
                  class="owner-verify__shot"
                  :src="wifiPreview"
                  alt="fast.com screenshot"
                />
                <label class="owner-verify__attach">
                  <input
                    class="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="onFile('wifi', $event)"
                  />
                  <span class="owner-btn owner-btn--ghost">
                    {{ draft.wifiFile || draft.wifiKey ? 'Replace screenshot' : 'Attach screenshot' }}
                  </span>
                </label>
                <p v-if="draft.wifiFile || draft.wifiKey" class="owner-verify__ready">
                  {{ draft.wifiFile?.name || 'Screenshot already attached.' }}
                </p>
              </div>
              <label class="owner-verify__field">
                Download Mbps
                <input
                  v-model="draft.wifiMbps"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="e.g. 42"
                  :aria-invalid="Boolean(visible.wifi)"
                />
              </label>
              <p v-if="visible.wifi" class="owner-verify__error" role="alert">{{ visible.wifi }}</p>
            </div>
          </section>

          <section class="owner-verify__block" :class="{ 'is-on': draft.includeSeating }" aria-labelledby="verify-seating">
            <div class="owner-verify__mast">
              <h2 id="verify-seating" class="owner-verify__title">
                <Armchair :size="15" :stroke-width="2.25" aria-hidden="true" />
                Seating capacity
              </h2>
              <label class="owner-chip" :class="{ 'is-active': draft.includeSeating }">
                <input v-model="draft.includeSeating" class="sr-only" type="checkbox" />
                {{ draft.includeSeating ? 'Included' : 'Include' }}
              </label>
            </div>
            <div v-if="draft.includeSeating" class="owner-verify__fields">
              <p class="owner-verify__hint">A photo of the interior, plus how many seats guests can use.</p>
              <div class="owner-verify__photo">
                <img
                  v-if="seatingPreview"
                  class="owner-verify__shot"
                  :src="seatingPreview"
                  alt="Cafe interior"
                />
                <label class="owner-verify__attach">
                  <input
                    class="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="onFile('seating', $event)"
                  />
                  <span class="owner-btn owner-btn--ghost">
                    {{ draft.seatingFile || draft.seatingKey ? 'Replace photo' : 'Attach interior photo' }}
                  </span>
                </label>
                <p v-if="draft.seatingFile || draft.seatingKey" class="owner-verify__ready">
                  {{ draft.seatingFile?.name || 'Interior photo already attached.' }}
                </p>
              </div>
              <label class="owner-verify__field">
                Seats
                <input
                  v-model="draft.seatingCapacity"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="e.g. 24"
                  :aria-invalid="Boolean(visible.seating)"
                />
              </label>
              <p v-if="visible.seating" class="owner-verify__error" role="alert">{{ visible.seating }}</p>
            </div>
          </section>

          <section class="owner-verify__block" :class="{ 'is-on': draft.includeOutlets }" aria-labelledby="verify-outlets">
            <div class="owner-verify__mast">
              <h2 id="verify-outlets" class="owner-verify__title">
                <Plug :size="15" :stroke-width="2.25" aria-hidden="true" />
                Power outlets
              </h2>
              <label class="owner-chip" :class="{ 'is-active': draft.includeOutlets }">
                <input v-model="draft.includeOutlets" class="sr-only" type="checkbox" />
                {{ draft.includeOutlets ? 'Included' : 'Include' }}
              </label>
            </div>
            <div v-if="draft.includeOutlets" class="owner-verify__fields">
              <p class="owner-verify__hint">A photo of sockets guests can use.</p>
              <div class="owner-verify__photo">
                <img
                  v-if="outletsPreview"
                  class="owner-verify__shot"
                  :src="outletsPreview"
                  alt="Power outlets"
                />
                <label class="owner-verify__attach">
                  <input
                    class="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="onFile('outlets', $event)"
                  />
                  <span class="owner-btn owner-btn--ghost">
                    {{ draft.outletsFile || draft.outletsKey ? 'Replace photo' : 'Attach outlet photo' }}
                  </span>
                </label>
                <p v-if="draft.outletsFile || draft.outletsKey" class="owner-verify__ready">
                  {{ draft.outletsFile?.name || 'Outlet photo already attached.' }}
                </p>
              </div>
              <p v-if="visible.outlets" class="owner-verify__error" role="alert">{{ visible.outlets }}</p>
            </div>
          </section>

          <section class="owner-verify__block" :class="{ 'is-on': draft.includePayment }" aria-labelledby="verify-payment">
            <div class="owner-verify__mast">
              <h2 id="verify-payment" class="owner-verify__title">
                <Wallet :size="15" :stroke-width="2.25" aria-hidden="true" />
                Payment methods
              </h2>
              <label class="owner-chip" :class="{ 'is-active': draft.includePayment }">
                <input v-model="draft.includePayment" class="sr-only" type="checkbox" />
                {{ draft.includePayment ? 'Included' : 'Include' }}
              </label>
            </div>
            <div v-if="draft.includePayment" class="owner-verify__fields">
              <p class="owner-verify__hint">No photo needed. Say what you accept today.</p>
              <div
                v-for="method in paymentMethods"
                :key="method.id"
                class="owner-verify__pay"
              >
                <p class="owner-verify__pay-name">{{ method.label }}</p>
                <div class="owner-verify__picks" role="radiogroup" :aria-label="method.label">
                  <label
                    v-for="choice in paymentChoices"
                    :key="choice.id"
                    class="owner-chip"
                    :class="{ 'is-active': draft.payment[method.id] === choice.id }"
                  >
                    <input
                      class="sr-only"
                      :name="`pay-${method.id}`"
                      type="radio"
                      :value="choice.id"
                      :checked="draft.payment[method.id] === choice.id"
                      @change="draft.payment[method.id] = choice.id"
                    />
                    {{ choice.label }}
                  </label>
                </div>
              </div>
              <p v-if="visible.payment" class="owner-verify__error" role="alert">{{ visible.payment }}</p>
            </div>
          </section>

          <p v-if="visible.form" class="owner-verify__error" role="alert">{{ visible.form }}</p>
          <p v-if="formError" class="owner-verify__error" role="alert">{{ formError }}</p>

          <button class="owner-btn owner-verify__send" type="submit" :disabled="saving" :aria-busy="saving || undefined">
            <OwnerBusyLabel :busy="saving">
              {{ saving ? 'Sending…' : latest?.status === 'pending' ? 'Update proof' : 'Send proof' }}
            </OwnerBusyLabel>
          </button>
        </form>
      </div>
      <div v-else-if="pageStatus === 'forbidden'" class="owner-verify__empty">
        <p>This listing is not yours to verify yet. An admin has to verify the claim first.</p>
        <NuxtLink class="owner-btn" to="/owner/claims">Open claims</NuxtLink>
      </div>
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { Armchair, BadgeAlert, Plug, Wallet, Wifi } from 'lucide-vue-next'
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import type { ShopAmenityVerificationRow, ShopRow } from '~/types/shop'
import { isShopId, resolveLiveShopId } from '~/utils/approved-shops'
import { formatOwnerDate, settleOwnerIonPages } from '~/utils/owner-nav'
import {
  draftFromVerification,
  emptyOwnerVerifyDraft,
  ownerVerifyErrors,
  ownerVerifyHasErrors,
  verificationStatusWord,
  VERIFY_PAYMENT_CHOICES,
  VERIFY_PAYMENT_METHODS,
  type OwnerVerifyDraft,
} from '~/utils/owner-verify'
import { publicObjectUrl } from '~/utils/shop-mapper'

definePageMeta({
  middleware: ['owner'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const config = useRuntimeConfig()
const toast = useOwnerToast()
const desk = useOwnerPortal()
const {
  waitingClaims,
  saving,
  isOwner,
  shopById,
  loadDesk,
  loadVerifications,
  submitAmenityVerification,
  verifications,
  error,
} = desk

const shop = ref<ShopRow | null>(null)
const pageStatus = ref<'idle' | 'loading' | 'ready' | 'forbidden' | 'error'>('loading')
const formError = ref('')
const attempted = ref(false)
const draft = reactive(emptyOwnerVerifyDraft())
const paymentMethods = VERIFY_PAYMENT_METHODS
const paymentChoices = VERIFY_PAYMENT_CHOICES
const publicBase = String(config.public.r2PublicBaseUrl || '')
const wifiBlob = ref<string | null>(null)
const seatingBlob = ref<string | null>(null)
const outletsBlob = ref<string | null>(null)

const pageError = computed(() => formError.value || error.value)
const shellStatus = computed(() => {
  if (desk.access.value === 'forbidden') return 'forbidden' as const
  if (pageStatus.value === 'forbidden') return 'ready' as const
  return pageStatus.value
})
const latest = computed<ShopAmenityVerificationRow | null>(() =>
  verifications.value.find((row) => row.shop_id === shop.value?.id) ?? null,
)
const issues = computed(() => ownerVerifyErrors(draft))
const visible = computed(() => (attempted.value ? issues.value : {
  form: null,
  wifi: null,
  seating: null,
  outlets: null,
  payment: null,
}))
const statusCopy = computed(() => {
  const row = latest.value
  if (!row) return 'No proof is waiting. Choose the amenities that changed.'
  if (row.status === 'pending') return `Pending since ${formatOwnerDate(row.created_at)}. You can update this while it waits.`
  if (row.status === 'approved') {
    return `Approved ${formatOwnerDate(row.reviewed_at)}. Send a new proof if amenities changed.`
  }
  return `${verificationStatusWord(row.status)} ${formatOwnerDate(row.reviewed_at)}. Send a new proof.`
})
const wifiPreview = computed(() => wifiBlob.value || publicObjectUrl(draft.wifiKey, publicBase))
const seatingPreview = computed(() => seatingBlob.value || publicObjectUrl(draft.seatingKey, publicBase))
const outletsPreview = computed(() => outletsBlob.value || publicObjectUrl(draft.outletsKey, publicBase))

function revokeBlob(url: string | null) {
  if (url) URL.revokeObjectURL(url)
}

function applyDraft(row: ShopAmenityVerificationRow | null) {
  revokeBlob(wifiBlob.value)
  revokeBlob(seatingBlob.value)
  revokeBlob(outletsBlob.value)
  wifiBlob.value = null
  seatingBlob.value = null
  outletsBlob.value = null
  const next = draftFromVerification(row)
  Object.assign(draft, next)
  draft.payment = { ...next.payment }
}

const onFile = (kind: 'wifi' | 'seating' | 'outlets', event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (kind === 'wifi') {
    revokeBlob(wifiBlob.value)
    draft.wifiFile = file
    wifiBlob.value = file ? URL.createObjectURL(file) : null
    if (file) draft.wifiKey = null
  }
  if (kind === 'seating') {
    revokeBlob(seatingBlob.value)
    draft.seatingFile = file
    seatingBlob.value = file ? URL.createObjectURL(file) : null
    if (file) draft.seatingKey = null
  }
  if (kind === 'outlets') {
    revokeBlob(outletsBlob.value)
    draft.outletsFile = file
    outletsBlob.value = file ? URL.createObjectURL(file) : null
    if (file) draft.outletsKey = null
  }
}

function resolveShopId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return resolveLiveShopId(route.fullPath, route.path, param, {
    ionPath: String(ionRouter.routeInfo?.pathname || ''),
    href,
  })
}

const load = async () => {
  formError.value = ''
  const id = resolveShopId()
  if (!isShopId(id)) {
    pageStatus.value = 'error'
    formError.value = 'Cafe not found.'
    return
  }
  pageStatus.value = shop.value?.id === id ? pageStatus.value : 'loading'
  try {
    await loadDesk()
    const owned = shopById(id)
    shop.value = owned
    if (!owned) {
      pageStatus.value = 'forbidden'
      return
    }
    if (!isOwner(id)) {
      pageStatus.value = 'forbidden'
      return
    }
    await loadVerifications()
    applyDraft(verifications.value.find((row) => row.shop_id === id && row.status === 'pending') ?? null)
    pageStatus.value = 'ready'
  } catch (err) {
    pageStatus.value = 'error'
    formError.value = err instanceof Error ? err.message : 'Could not load this cafe.'
  }
}

const onSubmit = async () => {
  if (!shop.value) return
  attempted.value = true
  formError.value = ''
  if (ownerVerifyHasErrors(draft as OwnerVerifyDraft)) return
  try {
    await submitAmenityVerification(shop.value.id, draft as OwnerVerifyDraft)
    toast.success('Proof sent', 'An admin or auditor will review this.')
    applyDraft(verifications.value.find((row) => row.shop_id === shop.value?.id && row.status === 'pending') ?? null)
    attempted.value = false
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not send this proof.'
    toast.error('Could not send', err, 'Could not send this proof.')
  }
}

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void load()
  },
  { immediate: true },
)

onIonViewWillEnter(() => {
  if (import.meta.client) requestAnimationFrame(settleOwnerIonPages)
  void load()
})

onBeforeUnmount(() => {
  revokeBlob(wifiBlob.value)
  revokeBlob(seatingBlob.value)
  revokeBlob(outletsBlob.value)
})
</script>

<style scoped>
.owner-verify {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.owner-verify__form,
.owner-verify__block,
.owner-verify__fields,
.owner-verify__photo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  min-width: 0;
}

.owner-verify__status {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.owner-verify__status.is-pending,
.owner-verify__status.is-approved {
  border-color: var(--kd-primary);
  color: var(--kd-primary);
}

.owner-verify__status.is-rejected {
  border-color: var(--kd-destructive);
  color: var(--kd-destructive);
}

.owner-verify__block {
  margin: 0;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.owner-verify__block.is-on {
  border-color: var(--kd-primary);
}

.owner-verify__mast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.owner-verify__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.owner-verify__title :deep(svg) {
  color: var(--kd-accent);
  flex: 0 0 auto;
}

.owner-verify__mast .owner-chip {
  flex: 0 0 auto;
}

.owner-verify__send {
  align-self: flex-start;
}

.owner-verify__notice {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--kd-destructive);
  border-radius: 16px;
  background: #faf8f5;
}

.owner-verify__notice-stamp,
.owner-verify__notice-copy,
.owner-verify__notice-next {
  margin: 0;
  line-height: 1.3;
}

.owner-verify__notice-stamp {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--kd-destructive);
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-verify__notice-stamp :deep(svg) {
  flex: 0 0 auto;
  color: var(--kd-destructive);
}

.owner-verify__notice-copy {
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
}

.owner-verify__notice-next {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
}

.owner-verify__hint,
.owner-verify__ready,
.owner-verify__error,
.owner-verify__empty p,
.owner-verify__pay-name {
  margin: 0;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-verify__hint,
.owner-verify__ready {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.owner-verify__error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.owner-verify__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-verify__field input {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #f2f2f2;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 400;
  caret-color: var(--kd-primary);
}

.owner-verify__field input::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 45%, #faf8f5);
}

.owner-verify__field input[aria-invalid='true'] {
  border-color: var(--kd-destructive);
}

.owner-verify__shot {
  display: block;
  width: min(100%, 320px);
  height: auto;
  max-height: 200px;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.owner-verify__attach {
  align-self: flex-start;
  cursor: pointer;
}

.owner-verify__attach .owner-btn {
  pointer-events: none;
}

.owner-verify__pay {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.owner-verify__pay-name {
  font-weight: 700;
}

.owner-verify__picks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.owner-verify__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
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

.owner-verify__field input:focus-visible,
.owner-verify__attach:focus-within .owner-btn,
.owner-chip:focus-within {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

:root.is-android .owner-verify__field input,
:root.is-android .owner-verify__mast .owner-chip,
:root.is-android .owner-verify__picks .owner-chip {
  min-height: 48px;
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
