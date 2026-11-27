import { describe, expect, test } from 'bun:test'
import { LANDING_SAMPLE_CAFES, amenityWord, sampleMatchesFilters } from './landing-samples'

describe('landing samples', () => {
  test('every sample is labelled as a sample', () => {
    for (const sample of LANDING_SAMPLE_CAFES) expect(sample.origin.startsWith('Sample')).toBe(true)
  })

  test('six samples narrow to two with WiFi and Plugs on', () => {
    expect(LANDING_SAMPLE_CAFES).toHaveLength(6)
    const both = LANDING_SAMPLE_CAFES.filter((s) => sampleMatchesFilters(s, ['wifi', 'plugs']))
    expect(both.map((s) => s.id)).toEqual(['s1', 's4'])
  })

  test('single filters use the Home predicate', () => {
    expect(LANDING_SAMPLE_CAFES.filter((s) => sampleMatchesFilters(s, ['wifi']))).toHaveLength(4)
    expect(LANDING_SAMPLE_CAFES.filter((s) => sampleMatchesFilters(s, ['plugs']))).toHaveLength(3)
    expect(LANDING_SAMPLE_CAFES.filter((s) => sampleMatchesFilters(s, []))).toHaveLength(6)
  })

  test('amenity words', () => {
    expect(amenityWord(true)).toBe('Yes')
    expect(amenityWord(false)).toBe('No')
    expect(amenityWord(null)).toBe('Unknown')
  })
})
