import { describe, expect, test } from 'bun:test'
import {
  BENCHMARK_MIN_GROUP,
  benchmarkHasData,
  benchmarkPercentileCopy,
  parseBenchmark,
} from './traffic-benchmark'

const full = {
  scope: 'network',
  label: 'All cafes',
  ctr_cafes: 12,
  own_ctr: '0.0831',
  ctr_median: 0.06,
  ctr_percentile: 0.73,
  action_cafes: 9,
  own_action_rate: 0.5,
  action_rate_median: 0.4,
  action_rate_percentile: 0.6,
}

describe('parseBenchmark', () => {
  test('parses numeric strings and keeps both metrics', () => {
    const [row] = parseBenchmark([full])
    expect(row?.scope).toBe('network')
    expect(row?.ctr).toEqual({ cafes: 12, own: 0.0831, median: 0.06, percentile: 0.73 })
    expect(row?.actionRate?.cafes).toBe(9)
  })

  test('drops a metric under the minimum group size even if the server sent it', () => {
    const [row] = parseBenchmark([{ ...full, ctr_cafes: BENCHMARK_MIN_GROUP - 1 }])
    expect(row?.ctr).toBeNull()
    expect(row?.actionRate).not.toBeNull()
  })

  test('drops groups with nothing to show', () => {
    expect(parseBenchmark([{ ...full, ctr_cafes: 3, action_cafes: 4 }])).toEqual([])
    expect(parseBenchmark([{ scope: 'city', ctr_cafes: null }])).toEqual([])
  })

  test('ignores unknown scopes, clamps percentiles, tolerates junk', () => {
    expect(parseBenchmark([{ ...full, scope: 'galaxy' }])).toEqual([])
    expect(parseBenchmark([{ ...full, ctr_percentile: 1.4 }])[0]?.ctr?.percentile).toBe(1)
    expect(parseBenchmark(null)).toEqual([])
    expect(parseBenchmark([null, 'x'])).toEqual([])
  })

  test('card shows only when a group returned', () => {
    expect(benchmarkHasData(parseBenchmark([]))).toBe(false)
    expect(benchmarkHasData(parseBenchmark([full]))).toBe(true)
  })
})

describe('benchmarkPercentileCopy', () => {
  test('words the percentile for each group', () => {
    expect(benchmarkPercentileCopy(0.726, 'network')).toBe('Ahead of 73% of all cafes')
    expect(benchmarkPercentileCopy(0, 'city')).toBe('Ahead of 0% of cafes nearby')
    expect(benchmarkPercentileCopy(2, 'vibe')).toBe('Ahead of 100% of cafes with a similar vibe')
  })
})
