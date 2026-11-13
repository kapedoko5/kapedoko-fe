<template>
  <IonPage>
    <OwnerShell
      title="Claims"
      lede="Admin verifies a claim before you can edit hours, contact, or the logo."
      :status="pageStatus"
      :error="error"
      :claim-count="waitingClaims.length"
    >
      <div class="owner-claims">
        <div class="owner-claims__filters" role="tablist" aria-label="Claim status">
          <button
            v-for="filter in filters"
            :id="`owner-claim-tab-${filter.id}`"
            :key="filter.id"
            type="button"
            role="tab"
            class="owner-chip"
            :class="{ 'is-active': activeFilter === filter.id }"
            :aria-selected="activeFilter === filter.id"
            :aria-controls="`owner-claim-panel-${filter.id}`"
            @click="activeFilter = filter.id"
          >
            {{ filter.label }}
            <span class="owner-claims__count">{{ countFor(filter.id) }}</span>
          </button>
        </div>

        <div
          :id="`owner-claim-panel-${activeFilter}`"
          role="tabpanel"
          :aria-labelledby="`owner-claim-tab-${activeFilter}`"
        >
          <p v-if="visible.length === 0" class="owner-claims__empty">
            {{ ownerClaimsEmptyCopy(activeFilter) }}
          </p>
          <div v-else class="owner-claims__list">
            <OwnerClaimTicket
              v-for="claim in visible"
              :key="claim.id"
              :claim="claim"
              :shop-name="shopNameForClaim(claim.shop_id)"
              :withdrawing="withdrawingId === claim.id"
              :fresh="unmarkedIds.has(claim.id)"
              @withdraw="onWithdraw"
            />
          </div>
        </div>
      </div>
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import OwnerClaimTicket from '~/components/owner-portal/OwnerClaimTicket.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import type { ShopClaimStatus } from '~/types/shop'
import { ownerClaimsEmptyCopy, ownerClaimsForFilter } from '~/utils/owner-portal'

definePageMeta({
  middleware: ['owner'],
})

const toast = useOwnerToast()
const confirm = useOwnerConfirm()
const desk = useOwnerPortal()
const {
  claims,
  waitingClaims,
  unmarkedWaiting,
  status,
  error,
  shopNameForClaim,
  withdrawClaim,
  loadDesk,
  markClaimsNoticed,
} = desk

const filters: Array<{ id: ShopClaimStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
]

const activeFilter = ref<ShopClaimStatus | 'all'>('all')
const withdrawingId = ref<string | null>(null)
const unmarkedIds = computed(() => new Set(unmarkedWaiting.value.map((claim) => claim.id)))
const pageStatus = computed(() => {
  if (desk.access.value === 'forbidden') return 'forbidden' as const
  return status.value
})
const visible = computed(() => ownerClaimsForFilter(claims.value, activeFilter.value))
const countFor = (id: ShopClaimStatus | 'all') => ownerClaimsForFilter(claims.value, id).length

const onWithdraw = async (claimId: string) => {
  const claim = claims.value.find((row) => row.id === claimId)
  if (!claim) return
  const choice = await confirm.ask({
    title: `Withdraw claim for ${shopNameForClaim(claim.shop_id)}?`,
    message: 'Admin will no longer see this claim. You can send a new one from the cafe page in the app.',
    confirmLabel: 'Withdraw claim',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  withdrawingId.value = claimId
  try {
    await withdrawClaim(claimId)
    toast.success('Claim withdrawn')
  } catch (err) {
    toast.error('Could not withdraw this claim', err, 'Could not withdraw this claim.')
  } finally {
    withdrawingId.value = null
  }
}

onMounted(async () => {
  await loadDesk()
  markClaimsNoticed()
})
</script>

<style scoped>
.owner-claims {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.owner-claims__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.owner-claims__count {
  font-variant-numeric: tabular-nums;
}

.owner-claims__empty {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-claims__list {
  display: grid;
  gap: 12px;
}
</style>
