<template>
  <section class="analytics-section voice" aria-labelledby="analytics-voice-title">
    <h2 id="analytics-voice-title">What visitors say</h2>
    <p v-if="summary.count === 0" class="analytics-muted">
      No reviews in the last {{ days }} days yet.
    </p>
    <template v-else>
      <dl class="voice__facts">
        <div>
          <dt>Reviews</dt>
          <dd>{{ formatTrafficCount(summary.count) }}</dd>
        </div>
        <div>
          <dt>Would recommend</dt>
          <dd>{{ formatTrafficRatio(summary.recommendRate) }}</dd>
        </div>
        <div>
          <dt>Would visit again</dt>
          <dd>{{ formatTrafficRatio(summary.visitAgainRate) }}</dd>
        </div>
      </dl>
      <p v-if="summary.recommendRate === null" class="analytics-muted">
        Percentages show once there are {{ REVIEW_MIN_COUNT }} reviews in the window.
      </p>
      <ul v-if="summary.comments.length" class="voice__comments">
        <li v-for="comment in summary.comments" :key="comment.id" class="voice__comment">
          <p class="voice__text">{{ comment.text }}</p>
          <p class="analytics-muted">{{ comment.author }}, {{ formatTrafficDay(dayOf(comment.createdAt)) }}</p>
        </li>
      </ul>
    </template>
    <p class="analytics-muted">
      Reviews are counted on their own. They are not compared with visits, which only include people who allow analytics.
    </p>
  </section>
</template>

<script lang="ts" setup>
import { formatTrafficCount, formatTrafficDay, formatTrafficRatio, manilaDateString } from '~/utils/shop-traffic'
import { REVIEW_MIN_COUNT, type ReviewSummary } from '~/utils/visitor-voice'

defineProps<{ summary: ReviewSummary, days: number }>()

const dayOf = (iso: string) => {
  const time = Date.parse(iso)
  return Number.isFinite(time) ? manilaDateString(new Date(time)) : ''
}
</script>

<style scoped>
.voice__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.voice__facts div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.voice__facts dt {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
}

.voice__facts dd {
  margin: 0;
  color: var(--kd-ink);
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.voice__comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.voice__comment {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 12px;
  border-left: 2px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.voice__text {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
</style>
