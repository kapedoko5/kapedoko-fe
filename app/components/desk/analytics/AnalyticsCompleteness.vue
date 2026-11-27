<template>
  <section class="analytics-section complete" aria-labelledby="analytics-complete-title">
    <div class="analytics-section__head">
      <h2 id="analytics-complete-title">Listing completeness</h2>
      <p class="complete__score" aria-live="polite">{{ completeness.score }}%</p>
    </div>
    <div
      class="complete__track"
      role="progressbar"
      aria-labelledby="analytics-complete-title"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="completeness.score"
      :aria-valuetext="`${completeness.score} percent complete`"
    >
      <span class="complete__fill" :style="{ width: `${completeness.score}%` }" />
    </div>
    <p v-if="completeness.missing.length === 0" class="analytics-muted">
      Everything on this checklist is in place. Keep hours and photos current.
    </p>
    <ul class="complete__list">
      <li v-for="item in completeness.items" :key="item.id" class="complete__item">
        <span class="complete__label">{{ item.label }}</span>
        <span v-if="item.done" class="complete__state">Done</span>
        <NuxtLink v-else class="complete__link" :to="item.to">
          {{ item.action }}<span v-if="item.progress" class="complete__progress"> ({{ item.progress }})</span>
        </NuxtLink>
      </li>
    </ul>
    <p class="analytics-muted">A fuller listing is easier to choose. It does not change how cafes are ranked.</p>
  </section>
</template>

<script lang="ts" setup>
import type { ListingCompleteness } from '~/utils/listing-completeness'

defineProps<{ completeness: ListingCompleteness }>()
</script>

<style scoped>
.complete__score {
  margin: 0;
  color: var(--kd-ink);
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.complete__track {
  display: block;
  height: 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--kd-ink) 10%, transparent);
  overflow: hidden;
}

.complete__fill {
  display: block;
  height: 100%;
  border-radius: 6px;
  background: var(--kd-primary);
}

.complete__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.complete__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  font-size: 0.7875rem;
}

.complete__item + .complete__item {
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
}

.complete__label {
  color: var(--kd-ink);
  font-weight: 700;
}

.complete__state {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
}

.complete__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--kd-primary);
  font-weight: 700;
  text-align: right;
  text-decoration: underline;
}

.complete__link:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.complete__progress {
  margin-left: 4px;
  font-weight: 400;
}
</style>
