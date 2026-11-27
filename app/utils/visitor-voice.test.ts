import { describe, expect, test } from 'bun:test'
import { REVIEW_COMMENT_LIMIT, parseReviewRows, summarizeReviews, type PublicReviewRow } from './visitor-voice'

const NOW = new Date('2026-11-19T12:00:00+08:00')

const review = (id: string, created: string, extra: Partial<PublicReviewRow> = {}): PublicReviewRow => ({
  id,
  shop_id: 'a',
  created_at: created,
  author_name: 'Kape Fan',
  recommend: true,
  visit_again: true,
  comment: null,
  ...extra,
})

describe('review summary', () => {
  test('counts only reviews inside the window', () => {
    const summary = summarizeReviews([
      review('1', '2026-11-18T10:00:00+08:00'),
      review('2', '2026-11-13T00:30:00+08:00'),
      review('3', '2026-11-12T23:30:00+08:00'),
    ], 7, NOW)
    expect(summary.count).toBe(2)
  })

  test('hides percentages below the minimum count', () => {
    const summary = summarizeReviews([review('1', '2026-11-18T10:00:00+08:00')], 7, NOW)
    expect(summary.count).toBe(1)
    expect(summary.recommendRate).toBeNull()
    expect(summary.visitAgainRate).toBeNull()
  })

  test('computes recommend and visit-again shares', () => {
    const summary = summarizeReviews([
      review('1', '2026-11-18T10:00:00+08:00'),
      review('2', '2026-11-17T10:00:00+08:00', { recommend: false }),
      review('3', '2026-11-16T10:00:00+08:00', { visit_again: false }),
      review('4', '2026-11-15T10:00:00+08:00'),
    ], 7, NOW)
    expect(summary.recommendRate).toBe(0.75)
    expect(summary.visitAgainRate).toBe(0.75)
  })

  test('returns the latest non-empty comments, capped', () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      review(String(i), `2026-11-${String(10 + i).padStart(2, '0')}T10:00:00+08:00`, {
        comment: i === 5 ? '   ' : `note ${i}`,
      }))
    const summary = summarizeReviews(rows, 30, NOW)
    expect(summary.comments).toHaveLength(REVIEW_COMMENT_LIMIT)
    expect(summary.comments.map((c) => c.text)).toEqual(['note 4', 'note 3', 'note 2'])
  })

  test('parses rows defensively and names anonymous authors', () => {
    const rows = parseReviewRows([
      { id: '1', shop_id: 'a', created_at: '2026-11-18T00:00:00Z', recommend: true, visit_again: false, comment: 'Nice', author_name: ' ' },
      { id: '2' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.author_name).toBe('A visitor')
    expect(rows[0]?.visit_again).toBe(false)
  })
})
