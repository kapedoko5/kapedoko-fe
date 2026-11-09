import { describe, expect, test } from 'bun:test'
import { CONFIRM_PHRASE } from './clear-prod-reviews'
import { parseArgs, resolveProductionPostgresUrl } from './prod-postgres'

const PROD = 'postgresql://postgres:secret@db.prod.supabase.co:5432/postgres'
const STAGING = 'postgresql://postgres:secret@db.staging.supabase.co:5432/postgres'

describe('parseArgs', () => {
  test('stays a dry run unless the confirm phrase is exact', () => {
    expect(parseArgs([], CONFIRM_PHRASE)).toEqual({ confirm: false })
    expect(parseArgs(['--dry-run'], CONFIRM_PHRASE)).toEqual({ confirm: false })
    expect(() => parseArgs(['--confirm=delete-reviews'], CONFIRM_PHRASE)).toThrow('Unknown flag --confirm=delete-reviews.')
    expect(parseArgs([`--confirm=${CONFIRM_PHRASE}`], CONFIRM_PHRASE)).toEqual({ confirm: true })
  })

  test('a dry-run flag overrides confirm', () => {
    expect(parseArgs([`--confirm=${CONFIRM_PHRASE}`, '--dry-run'], CONFIRM_PHRASE)).toEqual({ confirm: false })
  })

  test('rejects unknown flags', () => {
    expect(() => parseArgs(['--force'], CONFIRM_PHRASE)).toThrow('Unknown flag --force.')
  })
})

describe('resolveProductionPostgresUrl', () => {
  test('reads the production URL and returns its host', () => {
    expect(resolveProductionPostgresUrl({
      POSTGRES_URL: PROD,
      STAGING_POSTGRES_URL: STAGING,
    })).toEqual({ url: PROD, host: 'db.prod.supabase.co' })
  })

  test('refuses a missing URL, a staging match, and localhost', () => {
    expect(() => resolveProductionPostgresUrl({})).toThrow('POSTGRES_URL')
    expect(() => resolveProductionPostgresUrl({
      POSTGRES_URL: STAGING,
      STAGING_POSTGRES_URL: STAGING,
    })).toThrow('STAGING_POSTGRES_URL')
    expect(() => resolveProductionPostgresUrl({
      POSTGRES_URL: 'postgresql://postgres:secret@localhost:5432/postgres',
    })).toThrow('localhost')
  })
})
