import { describe, expect, test } from 'bun:test'
import type { ContentReportRow } from '../types/shop'
import { reportedReviewCopy, reportTargetHeading, reportTargetNote, reportTargetWord, withReportedReviewText, type ReportedReviewSource } from './moderation'

const report = (overrides: Partial<ContentReportRow> = {}): ContentReportRow => ({
  id: 'report-1',
  reporter_id: 'user-2',
  target_type: 'review',
  review_id: 'rev-1',
  shop_id: 'shop-1',
  reason: 'Reported from cafe detail',
  status: 'open',
  created_at: '2026-09-30T08:34:00.000Z',
  resolved_at: null,
  resolved_by: null,
  ...overrides,
})

const review = (overrides: Partial<ReportedReviewSource> = {}): ReportedReviewSource => ({
  id: 'rev-1',
  comment: 'The WiFi dropped every few minutes.',
  wifi_available: 'yes',
  wifi_speed: 'slow',
  power_available: 'yes',
  power_access: 'limited',
  recommend: false,
  ...overrides,
})

describe('reported review text', () => {
  test('uses the written comment as the reported text', () => {
    const [row] = withReportedReviewText([report()], [review()])
    expect(row?.review_text).toBe('The WiFi dropped every few minutes.')
    expect(reportedReviewCopy(row!)).toBe('The WiFi dropped every few minutes.')
  })

  test('builds the same sentence visitors see when the comment is empty', () => {
    const [row] = withReportedReviewText([report()], [review({ comment: '  ' })])
    expect(row?.review_text).toBe('WiFi felt slow. Had power sockets')
  })

  test('says the review is gone when the row cannot be loaded', () => {
    const [row] = withReportedReviewText([report()], [])
    expect(row?.review_text).toBeNull()
    expect(reportedReviewCopy(row!)).toBe('This review is no longer available.')
  })

  test('leaves photo reports without review text', () => {
    const [row] = withReportedReviewText(
      [report({ target_type: 'shop_photo', review_id: null })],
      [review()],
    )
    expect(row?.review_text).toBeNull()
    expect(reportedReviewCopy(row!)).toBeNull()
  })

  test('labels ownership reports without naming the owner', () => {
    expect(reportTargetWord('shop_owner')).toBe('claim')
    expect(reportTargetHeading('shop_owner')).toBe('Ownership report')
    expect(reportTargetNote({ target_type: 'shop_owner', reason: null })).toMatch(/owner is a mistake/)
    expect(reportTargetNote({ target_type: 'shop_photo', reason: null })).toBe('No note from the reporter.')
  })
})
