import { SQL } from 'bun'

export interface ProdPostgresEnv {
  POSTGRES_URL?: string
  STAGING_POSTGRES_URL?: string
}

export function parseArgs(argv: string[], confirmPhrase: string) {
  let confirm = false
  for (const arg of argv) {
    if (arg === `--confirm=${confirmPhrase}`) confirm = true
    else if (arg === '--dry-run') confirm = false
    else if (arg.startsWith('-')) throw new Error(`Unknown flag ${arg}.`)
  }
  return { confirm }
}

export function resolveProductionPostgresUrl(env: ProdPostgresEnv) {
  const url = env.POSTGRES_URL?.trim() ?? ''
  const staging = env.STAGING_POSTGRES_URL?.trim() ?? ''
  if (!url) {
    throw new Error('Set POSTGRES_URL to the production database. This script does not read STAGING_POSTGRES_URL.')
  }
  if (staging && url === staging) {
    throw new Error('POSTGRES_URL matches STAGING_POSTGRES_URL. Refusing to run.')
  }
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('POSTGRES_URL is not a valid database URL.')
  }
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    throw new Error(`POSTGRES_URL points at ${host || 'an empty host'}. This script only clears production.`)
  }
  return { url, host }
}

export function countOf(row: { count: number | string } | undefined) {
  return Number(row?.count ?? 0)
}

export function openProductionSql(url: string) {
  return new SQL(url, { max: 1, prepare: false, idleTimeout: 0, connectionTimeout: 20 })
}

export function connectionError(error: unknown, host: string) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('too many authentication failures') || message.includes('ECIRCUITBREAKER')) {
    return `The pooler at ${host} is temporarily blocking new connections after repeated authentication failures. Wait a few minutes, then retry with the current database password in POSTGRES_URL.`
  }
  if (message.includes('password authentication failed')) {
    return `The database at ${host} rejected the password in POSTGRES_URL. In the Supabase dashboard, open Project Settings → Database, reset the database password, and put the new connection string in POSTGRES_URL.`
  }
  return message
}
