<template>
  <IonPage>
    <AdminShell
      title="Moderation"
      lede="Open reports stay here until you hide the review or restore it."
      :status="status"
      :error="error"
    >
      <p v-if="openReports.length === 0" class="admin-meta">No open reports.</p>
      <article v-for="report in openReports" :key="report.id" class="admin-card report-card">
        <header class="report-head">
          <h2>{{ report.target_type === 'review' ? 'Review report' : 'Photo report' }}</h2>
          <span class="report-stamp report-stamp--open">
            <span class="report-stamp__mark" aria-hidden="true" />
            Open
          </span>
        </header>
        <template v-if="reportedText(report)">
          <blockquote class="report-quote">{{ reportedText(report) }}</blockquote>
        </template>
        <p class="report-note">{{ report.reason || 'No note from the reporter.' }}</p>
        <p class="report-meta">
          <span>{{ formatAdminDate(report.created_at) }}</span>
          <span v-if="reference(report)" :title="referenceTitle(report)">{{ reference(report) }}</span>
        </p>
        <div class="report-actions">
          <button
            type="button"
            class="report-warn"
            :disabled="savingId === report.id"
            :aria-busy="savingId === report.id && pendingOutcome === 'hidden' || undefined"
            :aria-label="`Keep ${targetWord(report)} hidden`"
            @click="onResolve(report, 'hidden')"
          >
            <AdminBusyLabel :busy="savingId === report.id && pendingOutcome === 'hidden'">
              {{ savingId === report.id && pendingOutcome === 'hidden' ? 'Hiding…' : 'Keep hidden' }}
            </AdminBusyLabel>
          </button>
          <button
            type="button"
            class="report-restore"
            :disabled="savingId === report.id"
            :aria-busy="savingId === report.id && pendingOutcome === 'dismissed' || undefined"
            :aria-label="`Restore ${targetWord(report)}`"
            @click="onResolve(report, 'dismissed')"
          >
            <AdminBusyLabel :busy="savingId === report.id && pendingOutcome === 'dismissed'">
              {{ savingId === report.id && pendingOutcome === 'dismissed' ? 'Restoring…' : 'Restore' }}
            </AdminBusyLabel>
          </button>
        </div>
      </article>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { formatAdminDate } from '~/utils/admin-nav'
import { reportedReviewCopy } from '~/utils/moderation'
import type { ContentReportRow } from '~/types/shop'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { reports, status, error, savingId, load, resolveReport } = admin
const openReports = computed(() => reports.value.filter((report) => report.status === 'open'))
const reportedText = (report: ContentReportRow) => reportedReviewCopy(report)
const pendingOutcome = ref<'hidden' | 'dismissed' | null>(null)

const targetWord = (report: ContentReportRow) => (report.target_type === 'review' ? 'review' : 'photo')

const reference = (report: ContentReportRow) => {
  if (report.review_id) return `Review ${report.review_id.slice(0, 8)}`
  if (report.shop_id) return `Cafe ${report.shop_id.slice(0, 8)}`
  return ''
}

const referenceTitle = (report: ContentReportRow) => report.review_id || report.shop_id || report.id

const onResolve = async (report: ContentReportRow, outcome: 'hidden' | 'dismissed') => {
  const word = targetWord(report)
  const choice = outcome === 'hidden'
    ? await askAdmin({
      title: `Keep this ${word} hidden?`,
      message: 'It stays off the cafe until you restore the report.',
      confirmLabel: 'Keep hidden',
      variant: 'destructive',
    })
    : await askAdmin({
      title: `Restore this ${word}?`,
      message: 'It can show on the cafe again.',
      confirmLabel: 'Restore',
    })
  if (!choice.confirmed) return
  pendingOutcome.value = outcome
  try {
    await resolveReport(report.id, outcome)
    toast.success(
      outcome === 'hidden' ? 'Kept hidden' : 'Restored',
      outcome === 'hidden' ? `The ${word} stays off the cafe.` : `The ${word} can show on the cafe again.`,
    )
  } catch (err) {
    toast.error('Could not update this report', err, 'Could not update this report.')
  } finally {
    pendingOutcome.value = null
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.report-card {
  caret-color: var(--kd-primary);
}

.report-card ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.report-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.report-head h2 {
  margin: 0;
}

.report-stamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.report-stamp__mark {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.report-stamp--open {
  background: color-mix(in srgb, var(--kd-accent) 28%, #faf8f5);
  color: var(--kd-ink);
}

.report-stamp--open .report-stamp__mark {
  background: var(--kd-accent);
}

.report-card.admin-card .report-note {
  margin: 12px 0 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.report-card.admin-card .report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 8px 0 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.report-warn,
.report-restore {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.report-warn {
  border: 1px solid var(--kd-destructive);
  background: var(--kd-destructive);
  color: var(--kd-white);
}

.report-restore {
  border: 1px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
}

.report-restore:hover:not(:disabled) {
  background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
}

.report-warn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--kd-destructive) 88%, #1c1917);
}

.report-warn:focus-visible,
.report-restore:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.report-warn:active:not(:disabled),
.report-restore:active:not(:disabled) {
  transform: translateY(1px);
}

.report-warn:disabled,
.report-restore:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .report-warn:active:not(:disabled),
  .report-restore:active:not(:disabled) {
    transform: none;
  }
}
</style>
