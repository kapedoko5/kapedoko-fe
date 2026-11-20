import { describe, expect, test } from 'bun:test'
import {
  defaultPlacementFeatures,
  parsePlacementFeatures,
  placementFeaturesPayload,
  placementFeaturesSummary,
} from './placement-features'

describe('placement feature defaults', () => {
  test('partner and sponsored share Home off and full photos on', () => {
    expect(defaultPlacementFeatures('partner')).toMatchObject({
      featured_photos: true,
      ad_poster: false,
      analytics: false,
      theme: false,
      home_carousel: false,
    })
    expect(defaultPlacementFeatures('sponsored')).toMatchObject({
      featured_photos: true,
      ad_poster: true,
      analytics: true,
      theme: true,
      home_carousel: false,
    })
  })

  test('parses stored features and falls back to show_on_home', () => {
    expect(parsePlacementFeatures({
      kind: 'partner',
      features: { home_carousel: true, featured_photos: false, ad_poster: true, analytics: false },
    }).home_carousel).toBe(true)
    expect(parsePlacementFeatures({
      kind: 'sponsored',
      show_on_home: true,
    }).home_carousel).toBe(true)
    expect(parsePlacementFeatures({
      kind: 'sponsored',
      show_on_home: true,
    }).ad_poster).toBe(true)
    expect(placementFeaturesPayload({
      featured_photos: true,
      ad_poster: true,
      analytics: true,
      theme: true,
      home_carousel: false,
    })).toEqual({
      featured_photos: true,
      ad_poster: true,
      analytics: true,
      theme: true,
      home_carousel: false,
    })
    expect(placementFeaturesSummary(defaultPlacementFeatures('partner'))).toMatch(/Full featured photos/)
    expect(parsePlacementFeatures({
      kind: 'partner',
      features: {},
      show_on_home: true,
    }).home_carousel).toBe(true)
  })
})
