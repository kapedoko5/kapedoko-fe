import { formatTrafficRatio } from './shop-traffic'

export const BENCHMARK_MIN_GROUP = 5

export const BENCHMARK_SCOPES = ['network', 'vibe', 'city'] as const
export type BenchmarkScope = (typeof BENCHMARK_SCOPES)[number]

export type BenchmarkMetric = {
  /** Cafes in the group that have enough traffic for this metric. */
  cafes: number
  own: number
  median: number
  /** 0..1, share of the other cafes in the group this cafe is ahead of. */
  percentile: number
}

export type BenchmarkRow = {
  scope: BenchmarkScope
  label: string
  ctr: BenchmarkMetric | null
  actionRate: BenchmarkMetric | null
}

const GROUP_NOUN: Record<BenchmarkScope, string> = {
  network: 'all cafes',
  vibe: 'cafes with a similar vibe',
  city: 'cafes nearby',
}

export function benchmarkGroupNoun(scope: BenchmarkScope): string {
  return GROUP_NOUN[scope]
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function metric(
  cafes: unknown,
  own: unknown,
  median: unknown,
  percentile: unknown,
): BenchmarkMetric | null {
  const count = num(cafes)
  const ownValue = num(own)
  const medianValue = num(median)
  const pct = num(percentile)
  // Never trust the server alone with the privacy floor.
  if (count == null || count < BENCHMARK_MIN_GROUP) return null
  if (ownValue == null || medianValue == null || pct == null) return null
  return { cafes: count, own: ownValue, median: medianValue, percentile: Math.min(1, Math.max(0, pct)) }
}

/** Parse shop_traffic_benchmark rows. Groups under the minimum size are dropped. */
export function parseBenchmark(rows: unknown): BenchmarkRow[] {
  if (!Array.isArray(rows)) return []
  const out: BenchmarkRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const scope = item.scope
    if (typeof scope !== 'string' || !(BENCHMARK_SCOPES as readonly string[]).includes(scope)) continue
    const ctr = metric(item.ctr_cafes, item.own_ctr, item.ctr_median, item.ctr_percentile)
    const actionRate = metric(
      item.action_cafes,
      item.own_action_rate,
      item.action_rate_median,
      item.action_rate_percentile,
    )
    if (!ctr && !actionRate) continue
    out.push({
      scope: scope as BenchmarkScope,
      label: typeof item.label === 'string' && item.label ? item.label : benchmarkGroupNoun(scope as BenchmarkScope),
      ctr,
      actionRate,
    })
  }
  return out
}

export function benchmarkHasData(rows: BenchmarkRow[]): boolean {
  return rows.length > 0
}

/** "Ahead of 72% of cafes nearby" */
export function benchmarkPercentileCopy(percentile: number, scope: BenchmarkScope): string {
  const pct = Math.round(Math.min(1, Math.max(0, percentile)) * 100)
  return `Ahead of ${pct}% of ${benchmarkGroupNoun(scope)}`
}

export function formatBenchmarkValue(value: number): string {
  return formatTrafficRatio(value)
}
