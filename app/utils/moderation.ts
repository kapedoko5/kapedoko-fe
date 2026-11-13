import type { ContentReportRow, ContentReportTarget, ShopReviewPublicRow } from '../types/shop'
import { reviewQuote } from './cafe-review'

export type ReportedReviewSource = Pick<
  ShopReviewPublicRow,
  'id' | 'comment' | 'wifi_available' | 'wifi_speed' | 'power_available' | 'power_access' | 'recommend'
>

export function withReportedReviewText(
  reports: ContentReportRow[],
  reviews: ReportedReviewSource[],
): ContentReportRow[] {
  const byId = new Map(reviews.map((row) => [row.id, row]))
  return reports.map((report) => {
    if (report.target_type !== 'review' || !report.review_id) {
      return { ...report, review_text: null }
    }
    const row = byId.get(report.review_id)
    return {
      ...report,
      review_text: row ? reviewQuote(row) : null,
    }
  })
}

export function reportedReviewCopy(report: Pick<ContentReportRow, 'target_type' | 'review_text'>): string | null {
  if (report.target_type !== 'review') return null
  return report.review_text || 'This review is no longer available.'
}

export function reportTargetWord(type: ContentReportTarget): string {
  if (type === 'review') return 'review'
  if (type === 'shop_owner') return 'claim'
  return 'photo'
}

export function reportTargetHeading(type: ContentReportTarget): string {
  if (type === 'review') return 'Review report'
  if (type === 'shop_owner') return 'Ownership report'
  return 'Photo report'
}

export function reportTargetNote(report: Pick<ContentReportRow, 'target_type' | 'reason'>): string {
  if (report.reason) return report.reason
  if (report.target_type === 'shop_owner') return 'Someone says this listing’s owner is a mistake.'
  return 'No note from the reporter.'
}
