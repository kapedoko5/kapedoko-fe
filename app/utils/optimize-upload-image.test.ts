import { describe, expect, test } from 'bun:test'
import {
  encodeMimeFor,
  extensionForMime,
  fitWithin,
  optimizedFileName,
  retryOptimizeParams,
  shouldKeepOriginal,
  uploadOptimizePreset,
  uploadSizeError,
} from './optimize-upload-image'

describe('upload image optimizer', () => {
  test('never upscales and keeps aspect ratio', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(3200, 1800, 1600)).toEqual({ width: 1600, height: 900 })
    expect(fitWithin(1200, 2400, 1600)).toEqual({ width: 800, height: 1600 })
  })

  test('caps banner width without stretching height past the edge', () => {
    expect(fitWithin(4000, 1000, 1920, 1920)).toEqual({ width: 1920, height: 480 })
    expect(fitWithin(800, 200, 1920, 1920)).toEqual({ width: 800, height: 200 })
  })

  test('keeps the original when encode is not meaningfully smaller', () => {
    expect(shouldKeepOriginal(1000, 960)).toBe(true)
    expect(shouldKeepOriginal(1000, 949)).toBe(false)
    expect(shouldKeepOriginal(1000, 2000)).toBe(true)
  })

  test('keeps PNG when alpha must be preserved', () => {
    expect(encodeMimeFor('image/png', true, true)).toBe('image/png')
    expect(encodeMimeFor('image/png', false, true)).toBe('image/png')
    expect(encodeMimeFor('image/png', false, false)).toBe('image/jpeg')
    expect(encodeMimeFor('image/webp', false, false)).toBe('image/webp')
    expect(encodeMimeFor('image/jpeg', false, false)).toBe('image/jpeg')
  })

  test('uses purpose presets for photos, logos, and banners', () => {
    expect(uploadOptimizePreset('amenity-proof').maxEdge).toBe(1600)
    expect(uploadOptimizePreset('shop-photo').maxBytes).toBe(4 * 1024 * 1024)
    expect(uploadOptimizePreset('ad-banner').maxWidth).toBe(1920)
    expect(uploadOptimizePreset('shop-logo').maxEdge).toBe(1024)
    expect(uploadOptimizePreset('badge-icon').maxEdge).toBe(512)
    expect(uploadOptimizePreset('shop-logo').keepAlpha).toBe(true)
    expect(uploadOptimizePreset('amenity-proof').keepAlpha).toBe(false)
  })

  test('names the encoded file from the original stem', () => {
    expect(optimizedFileName('fast.com.png', 'image/jpeg')).toBe('fast.com.jpg')
    expect(extensionForMime('image/webp')).toBe('webp')
    expect(uploadSizeError('shop-logo')).toMatch(/2 MB/)
    expect(uploadSizeError('amenity-proof')).toMatch(/4 MB/)
  })

  test('retries with a smaller edge and quality when still over the cap', () => {
    expect(retryOptimizeParams(1600, 0.9)).toEqual({ maxEdge: 1200, quality: 0.82 })
    expect(retryOptimizeParams(800, 0.75)).toEqual({ maxEdge: 640, quality: 0.72 })
    expect(fitWithin(3200, 1800, retryOptimizeParams(1600, 0.9).maxEdge)).toEqual({
      width: 1200,
      height: 675,
    })
  })
})
