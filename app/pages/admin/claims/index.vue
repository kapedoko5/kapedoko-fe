<template>
  <IonPage>
    <AdminShell
      title="Ownership claims"
      lede="Verify people who say they represent a listed cafe. Approved owners can edit hours, contact, and the logo — not publish status."
      :status="status"
      :error="error"
      :pending-count="pendingShops.length"
      :claim-count="pending.length"
    >
      <p v-if="notice" class="claim-notice" role="status">{{ notice }}</p>

      <div class="admin-toolbar" role="tablist" aria-label="Claim status">
        <button
          v-for="filter in filters"
          :id="`claim-tab-${filter.id}`"
          :key="filter.id"
          type="button"
          role="tab"
          class="admin-chip"
          :class="{ 'is-active': activeFilter === filter.id }"
          :aria-selected="activeFilter === filter.id"
          :aria-controls="`claim-panel-${filter.id}`"
          @click="activeFilter = filter.id"
        >
          {{ filter.label }}
          <span class="claim-count">{{ countFor(filter.id) }}</span>
        </button>
      </div>

      <div
        :id="`claim-panel-${activeFilter}`"
        role="tabpanel"
        :aria-labelledby="`claim-tab-${activeFilter}`"
      >
        <p v-if="visible.length === 0" class="admin-meta">{{ claimsQueueEmptyCopy(activeFilter) }}</p>

        <article
          v-for="claim in visible"
          :key="claim.id"
          class="admin-card claim-ticket"
          :class="{
            'is-rejecting': rejectingId === claim.id,
            'is-stamping': savingId === claim.id && !rejectingId,
          }"
        >
          <div class="claim-mast">
            <div class="claim-stamp" aria-hidden="true">
              <img
                v-if="logoSrc(claim.shop_id)"
                :src="logoSrc(claim.shop_id)"
                alt=""
                width="40"
                height="40"
              />
              <Store v-else :size="18" :stroke-width="2.25" />
            </div>
            <div class="claim-copy">
              <h2>{{ shopName(claim.shop_id) }}</h2>
              <p class="admin-status" :class="`admin-status--${claim.status}`">
                {{ claimStatusWord(claim.status) }}
              </p>
              <p v-if="shopAddress(claim.shop_id)">{{ shopAddress(claim.shop_id) }}</p>
            </div>
          </div>

          <dl class="claim-facts">
            <div>
              <dt>Proof</dt>
              <dd>{{ claim.evidence_note }}</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>{{ claimantLabel(claim) }}</dd>
            </div>
            <div>
              <dt>Reach</dt>
              <dd>{{ reachLabel(claim) }}</dd>
            </div>
            <div>
              <dt>Sent</dt>
              <dd>{{ formatAdminDate(claim.created_at) }}</dd>
            </div>
            <div v-if="claim.reviewed_at">
              <dt>Reviewed</dt>
              <dd>{{ formatAdminDate(claim.reviewed_at) }}</dd>
            </div>
            <div v-if="claim.rejection_reason">
              <dt>Note</dt>
              <dd>{{ claim.rejection_reason }}</dd>
            </div>
          </dl>

          <form
            v-if="claim.status === 'pending' && rejectingId === claim.id"
            class="claim-reject"
            @submit.prevent="submitReject(claim)"
          >
            <label class="admin-field" :for="`claim-reason-${claim.id}`">
              Why this claim is not verified
              <textarea
                :id="`claim-reason-${claim.id}`"
                v-model="rejectReason"
                rows="3"
                maxlength="280"
                required
                @keydown.esc.prevent="cancelReject"
              />
            </label>
            <p class="claim-count-line" :class="{ 'is-over': rejectOver }">
              {{ rejectReason.trim().length }} / 280
            </p>
            <p v-if="rejectIssue" class="admin-error" role="alert">{{ rejectIssue }}</p>
            <div class="admin-row-actions">
              <button type="submit" class="admin-btn" :disabled="savingId === claim.id" :aria-busy="savingId === claim.id || undefined">
                <AdminBusyLabel :busy="savingId === claim.id">
                  {{ savingId === claim.id ? 'Sending…' : 'Send rejection' }}
                </AdminBusyLabel>
              </button>
              <button type="button" class="admin-btn admin-btn--quiet" :disabled="savingId === claim.id" @click="cancelReject">
                Cancel
              </button>
            </div>
          </form>

          <div v-else-if="claim.status === 'pending'" class="admin-row-actions">
            <button
              type="button"
              class="admin-btn"
              :disabled="savingId === claim.id"
              :aria-busy="savingId === claim.id || undefined"
              :aria-describedby="`claim-verify-hint-${claim.id}`"
              @click="onVerify(claim)"
            >
              <AdminBusyLabel :busy="savingId === claim.id">
                {{ savingId === claim.id ? 'Verifying…' : 'Verify owner' }}
              </AdminBusyLabel>
            </button>
            <button
              type="button"
              class="admin-btn admin-btn--ghost"
              :disabled="savingId === claim.id"
              @click="startReject(claim.id)"
            >
              Write a rejection
            </button>
          </div>
          <p
            v-if="claim.status === 'pending' && rejectingId !== claim.id"
            :id="`claim-verify-hint-${claim.id}`"
            class="claim-hint"
          >
            They can then edit hours, contact, and the logo — not publish status.
          </p>

          <p>
            <NuxtLink class="admin-link" :to="`/admin/cafes/${claim.shop_id}`">Open cafe</NuxtLink>
          </p>
        </article>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { Store } from 'lucide-vue-next'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { ShopClaimRow, ShopClaimStatus } from '~/types/shop'
import { formatAdminDate } from '~/utils/admin-nav'
import { isKapedokoMark } from '~/utils/logo'
import { shopImageUrl } from '~/utils/shop-mapper'
import {
  CLAIM_REJECTION_MAX,
  claimRejectionReasonError,
  claimStatusWord,
  claimsQueueEmptyCopy,
} from '~/utils/shop-claims'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { shops, claims, status, error, savingId, load, moderateClaim } = admin
const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const activeFilter = ref<ShopClaimStatus>('pending')
const rejectingId = ref<string | null>(null)
const rejectReason = ref('')
const rejectIssue = ref('')
const notice = ref('')
const claimantNames = ref<Record<string, string>>({})

const filters = [
  { id: 'pending' as const, label: 'Pending' },
  { id: 'verified' as const, label: 'Verified' },
  { id: 'rejected' as const, label: 'Rejected' },
]

const visible = computed(() => claims.value.filter((claim) => claim.status === activeFilter.value))
const pending = computed(() => claims.value.filter((claim) => claim.status === 'pending'))
const pendingShops = computed(() => shops.value.filter((shop) => shop.status === 'pending'))
const rejectOver = computed(() => rejectReason.value.trim().length > CLAIM_REJECTION_MAX)

const countFor = (id: ShopClaimStatus) =>
  claims.value.filter((claim) => claim.status === id).length

const shopFor = (shopId: string) => shops.value.find((shop) => shop.id === shopId)

const shopName = (shopId: string) => shopFor(shopId)?.name || 'Unknown cafe'

const shopAddress = (shopId: string) => shopFor(shopId)?.address || ''

const logoSrc = (shopId: string) => {
  const shop = shopFor(shopId)
  if (!shop) return ''
  const url = shopImageUrl(shop, publicBase)
  return isKapedokoMark(url) ? '' : url
}

const claimantLabel = (claim: ShopClaimRow) =>
  claimantNames.value[claim.claimant_id] || 'Signed-in KapéBean'

const reachLabel = (claim: ShopClaimRow) => {
  const parts = [claim.contact_email, claim.contact_phone].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'No phone or email on the claim'
}

const loadClaimantNames = async () => {
  const ids = [...new Set(claims.value.map((claim) => claim.claimant_id))]
  if (!ids.length) {
    claimantNames.value = {}
    return
  }
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', ids)
  claimantNames.value = Object.fromEntries(
    ((data ?? []) as Array<{ id: string; display_name: string | null }>)
      .filter((row) => row.display_name)
      .map((row) => [row.id, row.display_name as string]),
  )
}

const startReject = async (claimId: string) => {
  rejectingId.value = claimId
  rejectReason.value = ''
  rejectIssue.value = ''
  notice.value = ''
  await nextTick()
  document.getElementById(`claim-reason-${claimId}`)?.focus()
}

const cancelReject = () => {
  rejectingId.value = null
  rejectReason.value = ''
  rejectIssue.value = ''
}

const onVerify = async (claim: ShopClaimRow) => {
  const name = shopName(claim.shop_id)
  const choice = await askAdmin({
    title: `Verify ${name}?`,
    message: 'They can then edit hours, contact, and the logo — not publish status.',
    confirmLabel: 'Verify owner',
  })
  if (!choice.confirmed) return
  notice.value = ''
  try {
    await moderateClaim(claim, 'verified')
    notice.value = `${name} is theirs to keep current.`
    toast.success('Owner verified', notice.value)
  } catch (err) {
    toast.error('Could not verify this claim', err, 'Could not update this claim.')
  }
}

const submitReject = async (claim: ShopClaimRow) => {
  const issue = claimRejectionReasonError(rejectReason.value)
  rejectIssue.value = issue || ''
  if (issue) return
  notice.value = ''
  try {
    await moderateClaim(claim, 'rejected', rejectReason.value.trim())
    notice.value = `Rejection sent for ${shopName(claim.shop_id)}.`
    toast.success('Rejection sent', notice.value)
    cancelReject()
    activeFilter.value = 'rejected'
  } catch (err) {
    toast.error('Could not reject this claim', err, 'Could not update this claim.')
  }
}

watch(activeFilter, () => {
  cancelReject()
})

onMounted(() => {
  void load().then(() => loadClaimantNames())
})
</script>

<style scoped>
.claim-notice {
  margin: 0 0 16px;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.claim-count {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.claim-ticket {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.claim-ticket.is-stamping {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.claim-mast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.claim-stamp {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--kd-accent) 18%, #faf8f5);
  color: var(--kd-ink);
}

.claim-stamp img {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: cover;
}

.claim-copy {
  min-width: 0;
}

.claim-copy h2,
.claim-copy p {
  margin: 0;
}

.claim-copy .admin-status {
  margin-top: 2px;
}

.claim-copy p:last-child {
  margin-top: 4px;
}

.claim-facts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
}

.claim-facts div {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  column-gap: 8px;
  align-items: baseline;
}

.claim-facts dt,
.claim-facts dd {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.claim-facts dt {
  font-weight: 400;
}

.claim-facts dd {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.claim-hint {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.claim-reject {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.claim-reject .admin-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.claim-reject textarea {
  min-height: 88px;
  resize: vertical;
  caret-color: var(--kd-primary);
}

.claim-count-line {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.claim-count-line.is-over {
  color: var(--kd-destructive);
  font-weight: 700;
}

.claim-ticket :deep(.admin-row-actions) {
  margin-top: 4px;
}

.claim-ticket :deep(.admin-btn) {
  border: 1px solid var(--kd-accent);
  transition: box-shadow 160ms ease;
}

.claim-ticket :deep(.admin-btn--ghost) {
  border-color: var(--kd-primary);
}

.claim-ticket :deep(.admin-btn--quiet) {
  border-color: transparent;
}

@media (hover: hover) {
  .claim-ticket :deep(.admin-btn:hover:not(:disabled)) {
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .claim-ticket,
  .claim-ticket :deep(.admin-btn) {
    transition: none;
  }

  .claim-ticket.is-stamping {
    box-shadow: none;
  }
}
</style>
