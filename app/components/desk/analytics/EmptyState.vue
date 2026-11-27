<template>
  <div :class="[tone === 'admin' ? 'admin-empty' : 'owner-empty', 'analytics-empty']" role="status">
    <p class="analytics-empty__title">{{ copy.title }}</p>
    <p class="analytics-empty__body">{{ copy.body }}</p>
    <p class="analytics-empty__note">
      Only visitors who allow analytics are counted, so these numbers are lower than real foot traffic.
    </p>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  tone: 'admin' | 'owner'
  kind: 'locked' | 'just-enabled' | 'no-traffic'
  days?: number
}>()

const copy = computed(() => {
  if (props.kind === 'locked') {
    return {
      title: 'Analytics is off for this cafe',
      body: 'It turns on with a partnership. Ask the KapeDoko team if you want to start.',
    }
  }
  if (props.kind === 'just-enabled') {
    return {
      title: 'Analytics is on, and waiting for its first visitors',
      body: 'Numbers appear once people who allow analytics see or open this cafe. It can take a day to show.',
    }
  }
  return {
    title: `No traffic in the last ${props.days ?? 30} days`,
    body: 'There was traffic before this window. Try a longer range, or check that the listing is live and has photos.',
  }
})
</script>

<style scoped>
.analytics-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analytics-empty p {
  margin: 0;
}

.analytics-empty__title {
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
}

.analytics-empty__note {
  font-size: 0.75rem;
}
</style>
