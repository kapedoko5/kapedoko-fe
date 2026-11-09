<template>
  <article class="owner-claim" :class="[`is-${claim.status}`, { 'is-fresh': fresh }]">
    <div class="owner-claim__mast">
      <h2>{{ shopName }}</h2>
      <p class="owner-claim__status">{{ claimStatusWord(claim.status) }}</p>
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
    <div class="owner-claim__actions">
      <NuxtLink
        v-if="claim.status === 'verified'"
        class="owner-btn"
        :to="ownerCafeEditPath(claim.shop_id)"
      >
        Edit listing
      </NuxtLink>
      <button
        v-else-if="canWithdrawClaim(claim.status)"
        type="button"
        class="owner-btn owner-btn--ghost"
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
import { formatOwnerDate, ownerCafeEditPath } from '~/utils/owner-nav'
import { canWithdrawClaim, claimStatusCopy, claimStatusWord } from '~/utils/shop-claims'

defineProps<{
  claim: ShopClaimRow
  shopName: string
  withdrawing?: boolean
  fresh?: boolean
}>()

const emit = defineEmits<{
  withdraw: [claimId: string]
}>()
</script>

<style scoped>
.owner-claim {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
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
  align-items: baseline;
  gap: 8px 12px;
}

.owner-claim h2,
.owner-claim__status,
.owner-claim__copy {
  margin: 0;
}

.owner-claim h2 {
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.owner-claim__status {
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-claim.is-pending .owner-claim__status {
  color: var(--kd-primary);
}

.owner-claim.is-verified .owner-claim__status {
  color: var(--kd-primary);
}

.owner-claim.is-rejected .owner-claim__status {
  color: #8c3a2f;
}

.owner-claim__copy {
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-claim__facts {
  display: grid;
  gap: 10px;
  margin: 0;
}

.owner-claim__facts dt {
  color: color-mix(in srgb, var(--kd-ink) 62%, #faf8f5);
  font-size: 0.75rem;
}

.owner-claim__facts dd {
  margin: 2px 0 0;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-claim__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
