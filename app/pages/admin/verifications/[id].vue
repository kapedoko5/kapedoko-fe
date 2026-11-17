<template>
  <IonPage>
    <AdminShell
      :title="row?.shop_name || 'Amenity proof'"
      lede="Look at the photos, then approve only the sections this owner sent."
      :status="pageStatus"
      :error="pageError"
      :proof-count="pendingCount"
      :nav-role="navRole"
    >
      <article v-if="row" class="admin-card proof-detail">
        <p class="admin-status" :class="`admin-status--${row.status}`">
          {{ verificationStatusWord(row.status) }}
        </p>
        <p class="admin-meta">{{ row.owner_name || 'Cafe owner' }} · sent {{ formatAdminDate(row.created_at) }}</p>
        <p v-if="row.reviewed_at" class="admin-meta">Reviewed {{ formatAdminDate(row.reviewed_at) }}</p>
        <aside v-if="row.rejection_reason" class="proof-note" role="status">
          <p class="proof-note__stamp">Rejection</p>
          <p class="proof-note__copy">{{ row.rejection_reason }}</p>
        </aside>
        <p>
          <NuxtLink class="admin-link" :to="`/admin/cafes/${row.shop_id}`">Open cafe</NuxtLink>
        </p>

        <section v-if="row.include_wifi" class="proof-block">
          <h2>WiFi speed</h2>
          <p>{{ row.wifi_download_mbps }} Mbps on fast.com</p>
          <img
            v-if="wifiSrc"
            class="proof-photo"
            :src="wifiSrc"
            alt="fast.com screenshot"
          />
        </section>

        <section v-if="row.include_seating" class="proof-block">
          <h2>Seating</h2>
          <p>About {{ row.seating_capacity }} seats</p>
          <img
            v-if="seatingSrc"
            class="proof-photo"
            :src="seatingSrc"
            alt="Cafe interior"
          />
        </section>

        <section v-if="row.include_outlets" class="proof-block">
          <h2>Power outlets</h2>
          <img
            v-if="outletsSrc"
            class="proof-photo"
            :src="outletsSrc"
            alt="Power outlets"
          />
        </section>

        <section v-if="row.include_payment" class="proof-block">
          <h2>Payment methods</h2>
          <p>QR {{ payWord(row.accepts_qr) }} · Card {{ payWord(row.accepts_card) }} · Cash {{ payWord(row.accepts_cash) }}</p>
        </section>

        <form
          v-if="row.status === 'pending' && rejecting"
          class="proof-reject-form"
          @submit.prevent="submitReject"
        >
          <label class="admin-field" for="proof-reason">
            Why this proof is not approved
            <textarea
              id="proof-reason"
              v-model="rejectReason"
              rows="3"
              maxlength="280"
              required
            />
          </label>
          <p class="proof-count-line">{{ rejectReason.trim().length }} / 280</p>
          <p v-if="rejectIssue" class="admin-error" role="alert">{{ rejectIssue }}</p>
          <div class="admin-row-actions">
            <button type="submit" class="admin-btn" :disabled="Boolean(savingId)" :aria-busy="Boolean(savingId) || undefined">
              <AdminBusyLabel :busy="Boolean(savingId)">
                {{ savingId ? 'Sending…' : 'Send rejection' }}
              </AdminBusyLabel>
            </button>
            <button type="button" class="admin-btn admin-btn--quiet" :disabled="Boolean(savingId)" @click="rejecting = false">
              Cancel
            </button>
          </div>
        </form>

        <div v-else-if="row.status === 'pending'" class="admin-row-actions">
          <button
            type="button"
            class="admin-btn"
            :disabled="Boolean(savingId)"
            :aria-busy="Boolean(savingId) || undefined"
            @click="onApprove"
          >
            <AdminBusyLabel :busy="Boolean(savingId)">
              {{ savingId ? 'Approving…' : 'Approve' }}
            </AdminBusyLabel>
          </button>
          <button
            type="button"
            class="admin-btn admin-btn--ghost"
            :disabled="Boolean(savingId)"
            @click="rejecting = true"
          >
            Write a rejection
          </button>
        </div>
      </article>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { formatAdminDate } from '~/utils/admin-nav'
import { resolveLiveShopId } from '~/utils/approved-shops'
import { publicObjectUrl } from '~/utils/shop-mapper'
import { VERIFY_REJECTION_MAX, verificationStatusWord } from '~/utils/owner-verify'

definePageMeta({
  middleware: ['auth', 'auditor'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const config = useRuntimeConfig()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { navRole, status: sessionStatus, error: sessionError, load: loadSession } = useStaffSession()
const proofs = useAmenityVerifications()
const { rows, error, savingId, pendingCount, load, moderate } = proofs
const rejecting = ref(false)
const rejectReason = ref('')
const rejectIssue = ref('')
const lookingUp = ref(true)

function resolveProofId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return resolveLiveShopId(route.fullPath, route.path, param, {
    ionPath: String(ionRouter.routeInfo?.pathname || ''),
    href,
  })
}

const id = computed(() => resolveProofId())
const row = computed(() => rows.value.find((item) => item.id === id.value) ?? null)
const pageStatus = computed(() => {
  if (sessionStatus.value === 'forbidden') return 'forbidden' as const
  if (lookingUp.value) return 'loading' as const
  if (!row.value) return 'error' as const
  return 'ready' as const
})
const pageError = computed(() => {
  if (row.value) return sessionError.value || error.value
  if (lookingUp.value) return sessionError.value || error.value
  return sessionError.value || error.value || 'Proof was not found.'
})
const publicBase = String(config.public.r2PublicBaseUrl || '')
const wifiSrc = computed(() => publicObjectUrl(row.value?.wifi_screenshot_object_key, publicBase))
const seatingSrc = computed(() => publicObjectUrl(row.value?.seating_photo_object_key, publicBase))
const outletsSrc = computed(() => publicObjectUrl(row.value?.outlets_photo_object_key, publicBase))

const payWord = (value: string | null | undefined) => {
  if (value === 'available') return 'yes'
  if (value === 'unavailable') return 'no'
  return 'unknown'
}

const onApprove = async () => {
  if (!row.value) return
  const choice = await askAdmin({
    title: `Approve ${row.value.shop_name || 'this cafe'}?`,
    message: 'Approved amenities show as Verified on the public listing.',
    confirmLabel: 'Approve',
  })
  if (!choice.confirmed) return
  try {
    await moderate(row.value.id, 'approved')
    toast.success('Proof approved', 'Those amenities are now public.')
  } catch (err) {
    toast.error('Could not approve this proof', err, 'Could not review this proof.')
  }
}

const submitReject = async () => {
  const reason = rejectReason.value.trim()
  if (!reason) {
    rejectIssue.value = 'Add a reason for rejecting this proof.'
    return
  }
  if (reason.length > VERIFY_REJECTION_MAX) {
    rejectIssue.value = 'Keep the rejection reason to 280 characters.'
    return
  }
  if (!row.value) return
  rejectIssue.value = ''
  try {
    await moderate(row.value.id, 'rejected', reason)
    toast.success('Rejection sent', 'The owner can send a new proof.')
    rejecting.value = false
  } catch (err) {
    toast.error('Could not reject this proof', err, 'Could not review this proof.')
  }
}

const loadProof = async () => {
  lookingUp.value = true
  await loadSession()
  let proofId = resolveProofId()
  if (!proofId && import.meta.client) {
    await nextTick()
    proofId = resolveProofId()
  }
  if (!proofId) {
    lookingUp.value = false
    return
  }
  if (!rows.value.some((item) => item.id === proofId)) {
    await load()
  }
  lookingUp.value = false
}

onMounted(() => {
  void loadProof()
})

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void loadProof()
  },
)

onIonViewWillEnter(() => {
  void loadProof()
})
</script>

<style scoped>
.proof-detail,
.proof-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.proof-detail h2,
.proof-detail p {
  margin: 0;
}

.proof-photo {
  width: min(100%, 420px);
  height: auto;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 18%, transparent);
  border-radius: 12px;
}

.proof-note {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border: 1px solid var(--kd-destructive);
  border-radius: 16px;
  background: #faf8f5;
}

.proof-note__stamp,
.proof-note__copy {
  margin: 0;
  line-height: 1.3;
}

.proof-note__stamp {
  color: var(--kd-destructive);
  font-size: 0.75rem;
  font-weight: 700;
}

.proof-note__copy {
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
}

.admin-error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.proof-count-line {
  margin: 0;
  font-size: 0.75rem;
}

.proof-reject-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
