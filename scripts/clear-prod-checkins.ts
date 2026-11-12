#!/usr/bin/env bun
/**
 * Delete every busyness check-in in public.shop_busyness_reports on production.
 *
 * Crowd level, hourly histogram, and 30-day check-in counts are views over
 * that table, so they clear with it. Reviews, shops, and amenity reports stay.
 *
 * Counts only:
 *   bun run checkins:clear
 *
 * Delete:
 *   bun run checkins:clear -- --confirm=delete-prod-checkins
 *
 * Uses the unprefixed POSTGRES_URL from .env (the production block).
 * It never reads STAGING_POSTGRES_URL.
 */
import {
  connectionError,
  countOf,
  openProductionSql,
  parseArgs,
  resolveProductionPostgresUrl,
} from './prod-postgres'

export const CONFIRM_PHRASE = 'delete-prod-checkins'

async function main() {
  const { confirm } = parseArgs(process.argv.slice(2), CONFIRM_PHRASE)
  const { url, host } = resolveProductionPostgresUrl(process.env)
  const sql = openProductionSql(url)

  try {
    const [checkins] = await sql`select count(*)::int as count from public.shop_busyness_reports`
    const report = {
      host,
      checkins: countOf(checkins),
      mode: confirm ? 'delete' : 'dry-run',
    }
    console.log(JSON.stringify(report, null, 2))

    if (!confirm) {
      console.log(`Dry run only. Re-run with --confirm=${CONFIRM_PHRASE} to delete these check-ins on ${host}.`)
      return
    }

    const deleted = await sql.begin(async (tx) => {
      const [removed] = await tx`
        with deleted as (
          delete from public.shop_busyness_reports
          returning 1
        )
        select count(*)::int as count from deleted
      `
      const [left] = await tx`select count(*)::int as count from public.shop_busyness_reports`
      if (countOf(left) !== 0) {
        throw new Error(`Expected 0 check-ins after delete, found ${countOf(left)}. Rolled back.`)
      }
      return countOf(removed)
    })

    console.log(
      `Deleted ${deleted} check-ins on ${host}. Reviews, shops, and amenity reports were left in place.`,
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
