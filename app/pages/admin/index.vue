<template>
  <IonPage>
    <AdminShell
      title="Dashboard"
      lede="Queues, live promotions, and people — without leaving the app."
      :status="status"
      :error="error"
      :pending-count="counts.pending"
      :claim-count="counts.pendingClaims"
    >
      <div class="desk">
        <ul class="desk-tallies" aria-label="Admin totals">
          <li
            v-for="card in cards"
            :key="card.label"
            class="desk-tallies__item"
            :class="`is-${card.tone}`"
          >
            <span class="desk-tallies__num">{{ card.value }}</span>
            <span class="desk-tallies__label">{{ card.label }}</span>
          </li>
        </ul>

        <div class="desk-queues">
          <AdminPendingRail :shops="pending" :status="status" />
          <AdminPendingRail
            :shops="claimShops"
            :status="status"
            title="Waiting to verify"
            empty-copy="No ownership claims waiting."
            :to="claimTo"
          />
        </div>

        <section class="desk-reports" aria-labelledby="open-reports-heading">
          <h2 id="open-reports-heading">Open reports</h2>
          <p v-if="openReports.length === 0" class="desk-clear" role="status">No open reports.</p>
          <ol v-else class="desk-slips">
            <li
              v-for="report in openReports.slice(0, 5)"
              :key="report.id"
              class="desk-slip"
              :class="report.target_type === 'review' ? 'desk-slip--review' : 'desk-slip--photo'"
            >
              <h3 class="desk-slip__title">
                <MessageSquareText
                  v-if="report.target_type === 'review'"
                  :size="18"
                  :stroke-width="2.25"
                  aria-hidden="true"
                />
                <ImageIcon
                  v-else
                  :size="18"
                  :stroke-width="2.25"
                  aria-hidden="true"
                />
                {{ report.target_type === 'review' ? 'Review' : 'Photo' }}
              </h3>
              <figure v-if="reportedText(report)" class="desk-quote">
                <figcaption>Reported text</figcaption>
                <blockquote class="report-quote">{{ reportedText(report) }}</blockquote>
              </figure>
              <p class="desk-slip__note">{{ report.reason || 'No note from the reporter.' }}</p>
              <NuxtLink
                class="admin-btn desk-slip__go"
                to="/admin/moderation"
                :aria-label="report.target_type === 'review' ? 'Open moderation for this review' : 'Open moderation for this photo'"
              >
                Open moderation
              </NuxtLink>
            </li>
          </ol>
        </section>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { Image as ImageIcon, MessageSquareText } from 'lucide-vue-next'
import AdminPendingRail from '~/components/admin/AdminPendingRail.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { reportedReviewCopy } from '~/utils/moderation'
import type { ContentReportRow } from '~/types/shop'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const actionLabels = new Set(['Pending', 'Hidden', 'Claims', 'Reports'])

const admin = useAdminData()
const usersAdmin = useAdminUsers()
const { shops, reports, claims, counts, status, error, load } = admin
const pending = computed(() => shops.value.filter((shop) => shop.status === 'pending'))
const claimShops = computed(() => {
  const ids = new Set(claims.value.filter((claim) => claim.status === 'pending').map((claim) => claim.shop_id))
  return shops.value.filter((shop) => ids.has(shop.id))
})
const claimTo = () => '/admin/claims'
const openReports = computed(() => reports.value.filter((report) => report.status === 'open'))
const reportedText = (report: ContentReportRow) => reportedReviewCopy(report)
const userTotal = computed(() => usersAdmin.total.value)
const cards = computed(() => {
  const rows = [
    { label: 'Pending', value: counts.value.pending },
    { label: 'Hidden', value: counts.value.hidden },
    { label: 'Claims', value: counts.value.pendingClaims },
    { label: 'Approved', value: counts.value.approved },
    { label: 'Rejected', value: counts.value.rejected },
    { label: 'Reports', value: counts.value.openReports },
    { label: 'Live pins', value: counts.value.activePlacements },
    { label: 'Live ads', value: counts.value.activeAds },
    { label: 'Users', value: userTotal.value },
    { label: 'Check-ins 30d', value: counts.value.checkIns30d },
  ]
  return rows.map((card) => ({
    ...card,
    tone: (card.value === 0 ? 'quiet' : actionLabels.has(card.label) ? 'due' : 'total') as 'quiet' | 'due' | 'total',
  }))
})

onMounted(async () => {
  await Promise.all([load(), usersAdmin.load('', 1)])
})
</script>

<style scoped>
.desk {
  display: grid;
  gap: 20px;
  min-width: 0;
  caret-color: var(--kd-primary);
}

.desk ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.desk-tallies {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  overflow: hidden;
}

.desk-tallies__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 12px 12px 10px;
  border-right: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.desk-tallies__item:nth-child(2n) {
  border-right: 0;
}

.desk-tallies__item:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.desk-tallies__item:nth-child(odd):last-child {
  grid-column: 1 / -1;
  border-right: 0;
}

.desk-tallies__num {
  color: var(--kd-ink);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.desk-tallies__label {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.desk-tallies__item.is-quiet .desk-tallies__num,
.desk-tallies__item.is-quiet .desk-tallies__label {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-weight: 500;
}

.desk-tallies__item.is-due .desk-tallies__num {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.desk-tallies__item.is-due .desk-tallies__label {
  color: var(--kd-ink);
  font-weight: 700;
}

.desk-queues {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.desk-queues.desk-queues :deep(.admin-rail) {
  margin: 0;
  min-width: 0;
}

.desk-queues.desk-queues :deep(.admin-rail:has(.admin-rail__empty)) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 16px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.desk-queues.desk-queues :deep(.admin-rail:has(.admin-rail__empty) .admin-rail__head) {
  flex: 0 1 auto;
  margin: 0;
  min-width: 0;
}

.desk-queues.desk-queues :deep(.admin-rail__empty) {
  flex: 1 1 14rem;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.desk-queues.desk-queues :deep(.admin-rail__empty)::before,
.desk-clear::before {
  content: "";
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 8px;
  vertical-align: -3px;
  background: var(--kd-primary);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}

.desk-reports h2 {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  text-wrap: balance;
}

.desk-clear::before {
  margin-right: 0;
}

.desk-clear {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.desk-slips {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.desk-slip {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.desk-slip__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.desk-slip__title svg {
  flex: none;
}

.desk-quote {
  margin: 12px 0 0;
  min-width: 0;
  max-width: 62ch;
}

.desk-quote figcaption {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.desk-slip.desk-slip--review .report-quote {
  margin: 6px 0 0;
  max-width: 62ch;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.desk-slip__note {
  margin: 10px 0 0;
  color: var(--kd-ink);
  font-size: 0.95rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.desk-slip--review .desk-slip__note {
  margin-top: 8px;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.desk-slip__go {
  width: 100%;
  margin-top: 16px;
}

.desk-queues.desk-queues :deep(.admin-rail *)::selection,
.desk ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

@media (hover: hover) and (pointer: fine) {
  .desk-slip a.desk-slip__go:hover {
    background: color-mix(in srgb, var(--kd-accent) 86%, #1c1917);
  }
}

.desk-slip a.desk-slip__go:active {
  background: color-mix(in srgb, var(--kd-accent) 78%, #1c1917);
}

@media (min-width: 640px) {
  .desk-tallies {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .desk-tallies__item:nth-child(2n) {
    border-right: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  }

  .desk-tallies__item:nth-child(4n) {
    border-right: 0;
  }

  .desk-tallies__item:nth-last-child(-n + 4) {
    border-bottom: 0;
  }
}

@media (min-width: 720px) {
  .desk-queues {
    grid-template-columns: 1fr 1fr;
  }

  .desk-slips {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    align-items: start;
  }
}

@media (min-width: 880px) {
  .desk-tallies {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }

  .desk-tallies__item,
  .desk-tallies__item:nth-child(2n),
  .desk-tallies__item:nth-child(4n),
  .desk-tallies__item:nth-last-child(-n + 4) {
    border-bottom: 0;
    border-right: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  }

  .desk-tallies__item:last-child {
    border-right: 0;
  }
}

@media (forced-colors: active) {
  .desk-tallies__item.is-due .desk-tallies__num {
    background: Highlight;
    color: HighlightText;
    forced-color-adjust: none;
  }

  .desk-queues.desk-queues :deep(.admin-rail__empty)::before,
  .desk-clear::before {
    background: CanvasText;
  }
}
</style>
