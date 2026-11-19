<template>
  <article class="owner-claim" :class="[`is-${claim.status}`, { 'is-fresh': fresh }]">
    <div class="owner-claim__mast">
      <h2>{{ shopName }}</h2>
      <p class="admin-status" :class="`admin-status--${claim.status}`">{{ claimStatusWord(claim.status) }}</p>
    </div>
    <p class="owner-claim__copy">{{ claimStatusCopy(claim.status, claim.rejection_reason) }}</p>
    <dl class="owner-claim__facts">
      <div>
        <dt>Proof</dt>
        <dd>{{ claim.evidence_note }}</dd>
      </div>
      <div v-if="claim.contact_email || claim.contact_phone">
        <dt>Reach</dt>
        <dd>{{ [claim.contact_email, claim.contact_phone].filter(Boolean).join(' · ') }}</dd>
      </div>
      <div>
        <dt>Sent</dt>
        <dd>{{ formatOwnerDate(claim.created_at) }}</dd>
      </div>
      <div v-if="claim.reviewed_at">
        <dt>Reviewed</dt>
        <dd>{{ formatOwnerDate(claim.reviewed_at) }}</dd>
      </div>
    </dl>
    <div
      v-if="claim.status === 'verified' || canWithdrawClaim(claim.status)"
      class="owner-claim__actions"
    >
      <NuxtLink
        v-if="claim.status === 'verified'"
        class="owner-btn"
        :to="ownerCafeEditPath(claim.shop_id)"
        @click="onEdit"
      >
        Edit listing
      </NuxtLink>
      <button
        v-else
        type="button"
        class="owner-btn owner-btn--danger"
        :disabled="withdrawing"
        :aria-busy="withdrawing || undefined"
        @click="emit('withdraw', claim.id)"
      >
        <OwnerBusyLabel :busy="withdrawing">
          {{ withdrawing ? 'Withdrawing…' : 'Withdraw claim' }}
        </OwnerBusyLabel>
      </button>
    </div>
  </article>
</template>

<script lang="ts" setup>
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'
import type { ShopClaimRow } from '~/types/shop'
import { formatOwnerDate, ownerCafeEditPath, settleOwnerIonPages } from '~/utils/owner-nav'
import { canWithdrawClaim, claimStatusCopy, claimStatusWord } from '~/utils/shop-claims'

const props = defineProps<{
  claim: ShopClaimRow
  shopName: string
  withdrawing?: boolean
  fresh?: boolean
}>()

const emit = defineEmits<{
  withdraw: [claimId: string]
}>()

const onEdit = (event: MouseEvent) => {
  if (event.defaultPrevented) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  void navigateTo(ownerCafeEditPath(props.claim.shop_id)).then(() => {
    if (import.meta.client) requestAnimationFrame(settleOwnerIonPages)
  })
}
</script>

<style scoped>
.owner-claim {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 20px;
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.owner-claim.is-fresh {
  border-color: var(--kd-accent);
}

.owner-claim__mast {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}

.owner-claim h2,
.owner-claim__copy {
  margin: 0;
}

.owner-claim h2 {
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.owner-claim__copy {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-claim__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  grid-column: 1 / -1;
  margin: 0;
}

.owner-claim__facts > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.owner-claim__facts dt {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.owner-claim__facts dd {
  margin: 0;
  font-size: 0.7875rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.owner-claim__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 12px;
  grid-column: 2;
  grid-row: 1 / span 2;
}

.owner-claim ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

@media (max-width: 639px) {
  .owner-claim {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .owner-claim__facts {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .owner-claim__actions {
    justify-content: flex-start;
  }
}

:root.is-android .owner-claim__actions .owner-btn {
  min-height: 48px;
}
</style>
