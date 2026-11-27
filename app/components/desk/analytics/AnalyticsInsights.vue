<template>
  <section class="analytics-section insights" aria-labelledby="analytics-insights-title">
    <h2 id="analytics-insights-title">What to look at</h2>
    <ul class="insights__list">
      <li v-for="item in insights" :key="item.id" :class="['insights__item', `insights__item--${item.tone}`]">
        <p class="insights__kind">{{ KIND_LABEL[item.tone] }}</p>
        <h3 class="insights__title">{{ item.title }}</h3>
        <p class="insights__body">{{ item.body }}</p>
        <NuxtLink v-if="item.cta" class="owner-btn insights__cta" :to="item.cta.to">
          {{ item.cta.label }}
        </NuxtLink>
      </li>
    </ul>
    <p class="analytics-muted">
      Hints come from simple rules on your own numbers. They stay quiet until there is enough traffic to say something.
    </p>
  </section>
</template>

<script lang="ts" setup>
import type { Insight, InsightTone } from '~/utils/analytics-insights'

defineProps<{ insights: Insight[] }>()

const KIND_LABEL: Record<InsightTone, string> = {
  attention: 'Worth a look',
  tip: 'Try this',
  info: 'Good to know',
}
</script>

<style scoped>
.insights__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.insights__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 4px 0 4px 12px;
  border-left: 4px solid var(--kd-primary);
}

.insights__item--tip {
  border-left-color: var(--kd-accent);
}

.insights__item--attention {
  border-left-color: var(--kd-ink);
}

.insights__kind {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7rem;
  font-weight: 700;
}

.insights__title {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.insights__body {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.35;
}

.insights__cta {
  margin-top: 4px;
  min-height: 44px;
}
</style>
