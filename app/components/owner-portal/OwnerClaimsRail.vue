<template>
  <section v-if="claims.length > 0" class="owner-rail" aria-labelledby="owner-rail-title">
    <div class="owner-rail__head">
      <h2 id="owner-rail-title">Waiting on admin</h2>
      <NuxtLink class="owner-rail__all" to="/owner/claims">Open claims</NuxtLink>
    </div>
    <ul class="owner-rail__track">
      <li
        v-for="claim in claims"
        :key="claim.id"
        class="owner-rail__stub"
        :class="{ 'is-fresh': unmarked.has(claim.id), [`is-${claim.status}`]: true }"
      >
        <p class="owner-rail__name">{{ shopName(claim.shop_id) }}</p>
        <p class="owner-rail__status">{{ claimStatusWord(claim.status) }}</p>
        <p class="owner-rail__note">{{ claimStatusCopy(claim.status, claim.rejection_reason) }}</p>
      </li>
    </ul>
  </section>
</template>

<script lang="ts" setup>
import type { ShopClaimRow } from '~/types/shop'
import { claimStatusCopy, claimStatusWord } from '~/utils/shop-claims'

const props = defineProps<{
  claims: ShopClaimRow[]
  unmarkedIds?: string[]
  shopName: (shopId: string) => string
}>()

const unmarked = computed(() => new Set(props.unmarkedIds ?? []))
</script>

<style scoped>
.owner-rail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.owner-rail__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.owner-rail__head h2,
.owner-rail__name,
.owner-rail__status,
.owner-rail__note {
  margin: 0;
}

.owner-rail__head h2 {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.owner-rail__all {
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.owner-rail__all:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.owner-rail__track {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0 2px 6px;
  list-style: none;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.owner-rail__track::-webkit-scrollbar {
  display: none;
}

.owner-rail__stub {
  flex: 0 0 min(240px, 78vw);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 92px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.owner-rail__stub.is-fresh {
  border-color: var(--kd-accent);
}

.owner-rail__name {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.owner-rail__status {
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-rail__stub.is-pending .owner-rail__status {
  color: var(--kd-primary);
}

.owner-rail__stub.is-rejected .owner-rail__status {
  color: #8c3a2f;
}

.owner-rail__note {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}
</style>
