#!/usr/bin/env bun
/**
 * Delete every row in public.reviews on production.
 *
 * Review rows in content_reports go with them. Shop photo reports, shops,
 * busyness check-ins, and amenity reports stay.
 *
 * Counts only:
 *   bun run reviews:clear
 *
 * Delete:
 *   bun run reviews:clear -- --confirm=delete-prod-reviews
 *
 * Uses the unprefixed POSTGRES_URL from .env (the production block).
 * It never reads STAGING_POSTGRES_URL.
 */
import { SQL } from 'bun'
import {
  connectionError,
  countOf,
  openProductionSql,
  parseArgs,
  resolveProductionPostgresUrl,
} from './prod-postgres'

export const CONFIRM_PHRASE = 'delete-prod-reviews'

async function reviewReportCount(sql: SQL) {
  const [reg] = await sql`select to_regclass('public.content_reports') as name`
  if (!reg?.name) return 0
  const [row] = await sql`
    select count(*)::int as count
    from public.content_reports
    where target_type = 'review' or review_id is not null
  `
  return countOf(row)
}

async function main() {
  const { confirm } = parseArgs(process.argv.slice(2), CONFIRM_PHRASE)
  const { url, host } = resolveProductionPostgresUrl(process.env)
  const sql = openProductionSql(url)

  try {
    const [reviews] = await sql`select count(*)::int as count from public.reviews`
    const reviewReports = await reviewReportCount(sql)
    const report = {
      host,
      reviews: countOf(reviews),
      reviewReports,
      mode: confirm ? 'delete' : 'dry-run',
    }
    console.log(JSON.stringify(report, null, 2))

    if (!confirm) {
      console.log(`Dry run only. Re-run with --confirm=${CONFIRM_PHRASE} to delete these reviews on ${host}.`)
      return
    }

    const deleted = await sql.begin(async (tx) => {
      let reportsDeleted = 0
      const [reg] = await tx`select to_regclass('public.content_reports') as name`
      if (reg?.name) {
        const [reports] = await tx`
          with deleted as (
            delete from public.content_reports
            where target_type = 'review' or review_id is not null
            returning 1
          )
          select count(*)::int as count from deleted
        `
        reportsDeleted = countOf(reports)
      }
      const [removed] = await tx`
        with deleted as (
          delete from public.reviews
          returning 1
        )
        select count(*)::int as count from deleted
      `
      const [left] = await tx`select count(*)::int as count from public.reviews`
      if (countOf(left) !== 0) {
        throw new Error(`Expected 0 reviews after delete, found ${countOf(left)}. Rolled back.`)
      }
      return { reviews: countOf(removed), reviewReports: reportsDeleted }
    })

    console.log(
      `Deleted ${deleted.reviews} reviews and ${deleted.reviewReports} review reports on ${host}. Shops, photo reports, and busyness check-ins were left in place.`,
    )
  } finally {
    await sql.close()
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const host = (() => {
      try {
        return resolveProductionPostgresUrl(process.env).host
      } catch {
        return 'the production database'
      }
    })()
    console.error(connectionError(error, host))
    process.exit(1)
  })
}
