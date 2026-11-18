<template>
  <IonPage>
    <AdminShell
      title="Amenity proofs"
      lede="Owner photos and payment declarations. Approve only what you can confirm."
      :status="pageStatus"
      :error="pageError"
      :proof-count="pendingCount"
      :nav-role="navRole"
    >
      <p v-if="notice" class="proof-notice" role="status">{{ notice }}</p>

      <div class="admin-toolbar" role="tablist" aria-label="Proof status">
        <button
          v-for="filter in filters"
          :id="`proof-tab-${filter.id}`"
          :key="filter.id"
          type="button"
          role="tab"
          class="admin-chip"
          :class="{ 'is-active': activeFilter === filter.id }"
          :aria-selected="activeFilter === filter.id"
          :aria-controls="`proof-panel-${filter.id}`"
          @click="activeFilter = filter.id"
        >
          {{ filter.label }}
          <span class="proof-count">{{ countFor(filter.id) }}</span>
        </button>
      </div>

      <div
        :id="`proof-panel-${activeFilter}`"
        role="tabpanel"
        :aria-labelledby="`proof-tab-${activeFilter}`"
      >
        <p v-if="visible.length === 0" class="admin-empty">{{ verificationQueueEmptyCopy(activeFilter) }}</p>
        <div v-else class="admin-grid proof-list">
        <article
          v-for="row in visible"
          :key="row.id"
          class="admin-card proof-ticket"
          :class="{
            'is-rejecting': rejectingId === row.id,
            'is-stamping': savingId === row.id && !rejectingId,
          }"
        >
          <div class="proof-ticket__mast">
            <h2>{{ row.shop_name || 'Unknown cafe' }}</h2>
            <p class="admin-status" :class="`admin-status--${row.status}`">
              {{ verificationStatusWord(row.status) }}
            </p>
          </div>
          <p class="admin-meta">{{ row.owner_name || 'Cafe owner' }} · {{ includedCopy(row) }}</p>
          <p class="admin-meta">Sent {{ formatAdminDate(row.created_at) }}</p>
          <aside v-if="row.rejection_reason" class="proof-note" role="status">
            <p class="proof-note__stamp">Rejection</p>
            <p class="proof-note__copy">{{ row.rejection_reason }}</p>
          </aside>

          <form
            v-if="row.status === 'pending' && rejectingId === row.id"
            class="proof-reject-form"
            @submit.prevent="submitReject(row)"
          >
            <label class="admin-field" :for="`proof-reason-${row.id}`">
              Why this proof is not approved
              <textarea
                :id="`proof-reason-${row.id}`"
                v-model="rejectReason"
                rows="3"
                maxlength="280"
                required
                @keydown.esc.prevent="cancelReject"
              />
            </label>
            <p class="proof-count-line" :class="{ 'is-over': rejectOver }">
              {{ rejectReason.trim().length }} / 280
            </p>
            <p v-if="rejectIssue" class="admin-error" role="alert">{{ rejectIssue }}</p>
            <div class="admin-row-actions">
              <button type="submit" class="admin-btn admin-btn--danger" :disabled="savingId === row.id" :aria-busy="savingId === row.id || undefined">
                <AdminBusyLabel :busy="savingId === row.id">
                  {{ savingId === row.id ? 'Sending…' : 'Send rejection' }}
                </AdminBusyLabel>
              </button>
              <button type="button" class="admin-btn admin-btn--ghost" :disabled="savingId === row.id" @click="cancelReject">
                Cancel
              </button>
            </div>
          </form>

          <div v-else-if="row.status === 'pending'" class="admin-row-actions">
            <button
              type="button"
              class="admin-btn"
              :disabled="savingId === row.id"
              :aria-busy="savingId === row.id || undefined"
              @click="onApprove(row)"
            >
              <AdminBusyLabel :busy="savingId === row.id">
                {{ savingId === row.id ? 'Approving…' : 'Approve' }}
              </AdminBusyLabel>
            </button>
            <button
              type="button"
              class="admin-btn admin-btn--ghost"
              :disabled="savingId === row.id"
              @click="startReject(row.id)"
            >
              Write a rejection
            </button>
            <NuxtLink class="admin-btn admin-btn--ghost" :to="`/admin/verifications/${row.id}`">Open proof</NuxtLink>
          </div>

          <div v-else class="admin-row-actions">
            <NuxtLink class="admin-btn admin-btn--ghost" :to="`/admin/verifications/${row.id}`">Open proof</NuxtLink>
          </div>
        </article>
        </div>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { AmenityVerificationStatus, ShopAmenityVerificationRow } from '~/types/shop'
import { formatAdminDate } from '~/utils/admin-nav'
import {
  VERIFY_REJECTION_MAX,
  verificationQueueEmptyCopy,
  verificationStatusWord,
} from '~/utils/owner-verify'

definePageMeta({
  middleware: ['auth', 'auditor'],
})

const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { navRole, status: sessionStatus, error: sessionError, load: loadSession } = useStaffSession()
const proofs = useAmenityVerifications()
const { rows, status, error, savingId, pendingCount, load, moderate } = proofs
const activeFilter = ref<AmenityVerificationStatus>('pending')
const notice = ref('')
const rejectingId = ref<string | null>(null)
const rejectReason = ref('')
const rejectIssue = ref('')

const filters = [
  { id: 'pending' as const, label: 'Pending' },
  { id: 'approved' as const, label: 'Approved' },
  { id: 'rejected' as const, label: 'Rejected' },
]

const pageStatus = computed(() => (sessionStatus.value === 'forbidden' ? 'forbidden' : status.value))
const pageError = computed(() => sessionError.value || error.value)
const visible = computed(() => rows.value.filter((row) => row.status === activeFilter.value))
const rejectOver = computed(() => rejectReason.value.trim().length > VERIFY_REJECTION_MAX)
const countFor = (id: AmenityVerificationStatus) =>
  rows.value.filter((row) => row.status === id).length

const includedCopy = (row: ShopAmenityVerificationRow) => {
  const parts = [
    row.include_wifi ? 'WiFi' : '',
    row.include_seating ? 'Seating' : '',
    row.include_outlets ? 'Outlets' : '',
    row.include_payment ? 'Payment' : '',
  ].filter(Boolean)
  return parts.join(' · ') || 'No sections'
}

const startReject = async (id: string) => {
  rejectingId.value = id
  rejectReason.value = ''
  rejectIssue.value = ''
  notice.value = ''
  await nextTick()
  document.getElementById(`proof-reason-${id}`)?.focus()
}

const cancelReject = () => {
  rejectingId.value = null
  rejectReason.value = ''
  rejectIssue.value = ''
}

const onApprove = async (row: ShopAmenityVerificationRow) => {
  const name = row.shop_name || 'this cafe'
  const choice = await askAdmin({
    title: `Approve ${name}?`,
    message: 'Approved amenities show as Verified on the public listing.',
    confirmLabel: 'Approve',
  })
  if (!choice.confirmed) return
  notice.value = ''
  try {
    await moderate(row.id, 'approved')
    notice.value = `${row.shop_name || 'That cafe'} is now owner-verified for ${includedCopy(row).toLowerCase()}.`
    toast.success('Proof approved', notice.value)
  } catch (err) {
    toast.error('Could not approve this proof', err, 'Could not review this proof.')
  }
}

const submitReject = async (row: ShopAmenityVerificationRow) => {
  const reason = rejectReason.value.trim()
  if (!reason) {
    rejectIssue.value = 'Add a reason for rejecting this proof.'
    return
  }
  if (reason.length > VERIFY_REJECTION_MAX) {
    rejectIssue.value = 'Keep the rejection reason to 280 characters.'
    return
  }
  rejectIssue.value = ''
  notice.value = ''
  try {
    await moderate(row.id, 'rejected', reason)
    notice.value = `Rejection sent for ${row.shop_name || 'this cafe'}.`
    toast.success('Rejection sent', notice.value)
    cancelReject()
    activeFilter.value = 'rejected'
  } catch (err) {
    toast.error('Could not reject this proof', err, 'Could not review this proof.')
  }
}

watch(activeFilter, () => {
  cancelReject()
})

onMounted(() => {
  void loadSession()
  void load()
})
</script>

<style scoped>
.proof-notice {
  margin: 0;
  font-size: 0.7875rem;
  font-weight: 700;
}

.proof-count {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.proof-list {
  margin-top: 0;
}

.proof-ticket {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.proof-ticket__mast {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 12px;
}

.proof-ticket.is-stamping {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.proof-ticket h2,
.proof-ticket p {
  margin: 0;
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

.proof-count-line.is-over {
  color: var(--kd-destructive);
}

.proof-reject-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
