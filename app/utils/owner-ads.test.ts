import { describe, expect, test } from 'bun:test'
import {
  SHOP_GALLERY_MAX,
  featuredPhotoCountError,
  featuredPhotoFileError,
  missingOwnerMediaSqlCopy,
  ownerAdsEmptyCopy,
  ownerPosterCafeError,
  ownerPosterReplaceCopy,
  ownerPosterReplaceNames,
  ownerPosterShopIds,
  posterFileError,
} from './owner-ads'

describe('owner poster targeting', () => {
  const owned = ['a', 'b', 'c']

  test('a single owned cafe always posts there', () => {
    expect(ownerPosterShopIds({
      ownedIds: ['a'],
      scope: 'several',
      oneId: '',
      severalIds: [],
    })).toEqual(['a'])
  })

  test('one-cafe scope uses the chosen id when it is owned', () => {
    expect(ownerPosterShopIds({
      ownedIds: owned,
      scope: 'one',
      oneId: 'b',
      severalIds: ['a', 'c'],
    })).toEqual(['b'])
    expect(ownerPosterShopIds({
      ownedIds: owned,
      scope: 'one',
      oneId: 'other',
      severalIds: ['a'],
    })).toEqual([])
  })

  test('several-cafe scope keeps owned ids only, once', () => {
    expect(ownerPosterShopIds({
      ownedIds: owned,
      scope: 'several',
      oneId: 'a',
      severalIds: ['c', 'a', 'c', 'nope'],
    })).toEqual(['c', 'a'])
  })

  test('asks for a cafe when none are selected', () => {
    expect(ownerPosterCafeError([])).toMatch(/at least one cafe/)
    expect(ownerPosterCafeError(['a'])).toBeNull()
  })
})

describe('owner poster replace copy', () => {
  test('names the cafes that already hang a poster', () => {
    const names = ownerPosterReplaceNames(
      ['a', 'b', 'c'],
      new Set(['b', 'c']),
      (id) => id === 'b' ? "Cy's Cafe" : 'Harbor',
    )
    expect(names).toEqual(["Cy's Cafe", 'Harbor'])
    expect(ownerPosterReplaceCopy(names)).toMatch(/Cy's Cafe and Harbor/)
    expect(ownerPosterReplaceCopy(["Cy's Cafe"])).toMatch(/Cy's Cafe/)
    expect(ownerPosterReplaceCopy([])).toBeNull()
  })
})

describe('owner media files', () => {
  test('accepts a poster under 4 MB', () => {
    expect(posterFileError({ type: 'image/jpeg', size: 1200 } as File)).toBeNull()
    expect(posterFileError(null)).toBe('Upload a poster image.')
    expect(posterFileError({ type: 'application/pdf', size: 1200 } as File)).toMatch(/JPG/)
    expect(posterFileError({ type: 'image/png', size: 5 * 1024 * 1024 } as File)).toMatch(/4 MB/)
  })

  test('caps featured photos at eight', () => {
    expect(featuredPhotoCountError(8)).toBeNull()
    expect(featuredPhotoCountError(9)).toMatch(String(SHOP_GALLERY_MAX))
    expect(featuredPhotoFileError({ type: 'image/webp', size: 800 } as File)).toBeNull()
    expect(featuredPhotoFileError(null)).toMatch(/Choose a photo/)
  })
})

describe('owner media copy', () => {
  test('points at the SQL file when the RPC is missing', () => {
    expect(missingOwnerMediaSqlCopy('Could not find the function public.publish_owner_poster')).toMatch(/20261114_owner_cafe_media/)
    expect(missingOwnerMediaSqlCopy('Network error')).toBeNull()
    expect(ownerAdsEmptyCopy()).toMatch(/Upload one above/)
  })
})
