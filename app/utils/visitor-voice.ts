import { trafficRangeStartIso } from './shop-traffic'

/** Rates need a handful of reviews before they mean anything. */
export const REVIEW_MIN_COUNT = 3
export const REVIEW_COMMENT_LIMIT = 3

export type PublicReviewRow = {
  id: string
  shop_id: string
  created_at: string
  author_name: string
  recommend: boolean
  visit_again: boolean
  comment: string | null
}

export type ReviewComment = {
  id: string
  author: string
  text: string
  createdAt: string
}

export type ReviewSummary = {
  count: number
  /** Share of reviews that recommend the cafe. Null below REVIEW_MIN_COUNT. */
  recommendRate: number | null
  visitAgainRate: number | null
  comments: ReviewComment[]
}

export function parseReviewRows(rows: unknown): PublicReviewRow[] {
  if (!Array.isArray(rows)) return []
  const out: PublicReviewRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const id = typeof item.id === 'string' ? item.id : ''
    const shopId = typeof item.shop_id === 'string' ? item.shop_id : ''
    const created = typeof item.created_at === 'string' ? item.created_at : ''
    if (!id || !shopId || !created) continue
    out.push({
      id,
      shop_id: shopId,
      created_at: created,
      author_name: typeof item.author_name === 'string' && item.author_name.trim() ? item.author_name.trim() : 'A visitor',
      recommend: item.recommend === true,
      visit_again: item.visit_again === true,
      comment: typeof item.comment === 'string' ? item.comment : null,
    })
  }
  return out
}

/**
 * Review sentiment for a window. Reviews are their own count: never divide
 * them into (or by) consent-gated traffic.
 */
export function summarizeReviews(
  rows: PublicReviewRow[],
  days: number,
  now = new Date(),
): ReviewSummary {
  const from = Date.parse(trafficRangeStartIso(days, now))
  const inWindow = rows
    .filter((row) => {
      const time = Date.parse(row.created_at)
      return Number.isFinite(time) && time >= from
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const count = inWindow.length
  const enough = count >= REVIEW_MIN_COUNT
  const comments: ReviewComment[] = []
  for (const row of inWindow) {
    const text = (row.comment ?? '').trim()
    if (!text) continue
    comments.push({ id: row.id, author: row.author_name, text, createdAt: row.created_at })
    if (comments.length >= REVIEW_COMMENT_LIMIT) break
  }
  return {
    count,
    recommendRate: enough ? inWindow.filter((row) => row.recommend).length / count : null,
    visitAgainRate: enough ? inWindow.filter((row) => row.visit_again).length / count : null,
    comments,
  }
}
