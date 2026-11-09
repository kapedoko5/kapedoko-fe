import { describe, expect, test } from 'bun:test'
import {
  adminCafeErrors,
  adminCafeHasErrors,
  cafeDeskActionLabel,
  cafeDeskActions,
  cafeDeskConfirmAction,
  cafeDeskConfirmMessage,
  cafeDeskConfirmTitle,
  cafeDeskDoneCopy,
  deleteCafeAction,
  deleteCafeBusyLabel,
  deleteCafeDoneCopy,
  deleteCafeMessage,
  deleteCafeTitle,
  isValidLatitude,
  isValidLongitude,
  missingDeleteAdminShopCopy,
  parseDeletedAdminShop,
  shopStatusWord,
  uniqueDeletableAdminObjectKeys,
} from './admin-shop'
import { bannerAspectError, bannerFileError, campaignWindowError, featuredAdCopy, isAdCampaignActive, sortActiveAds } from './admin-ads'
import { edgeFunctionErrorMessage, roleChangeError, suspendError } from './admin-users'
import { placementKindFromTier, placementLifecycle, placementWindowError } from './admin-placements'
import { adminNavIdFromPath, toLocalInput } from './admin-nav'
import { allDayEveryDay } from './hours'

import { adminLogoPayload } from './admin-logos'
import { publicObjectUrl } from './shop-mapper'

describe('admin cafe validation', () => {
  const hours = allDayEveryDay()

  test('accepts a complete cafe anywhere on the globe', () => {
    const input = {
      name: 'Mountain Brew',
      address: '1 Session Road, Baguio',
      lat: 16.4023,
      lng: 120.596,
      phone: '0917 123 4567',
      hours,
      logoFile: null,
    }
    expect(adminCafeErrors(input)).toEqual({
      name: null,
      address: null,
      pin: null,
      phone: null,
      hours: null,
      logo: null,
    })
    expect(adminCafeHasErrors(input)).toBe(false)
    expect(isValidLatitude(16.4023)).toBe(true)
    expect(isValidLongitude(123.8854)).toBe(true)
  })

  test('names listing statuses including hidden', () => {
    expect(shopStatusWord('approved')).toBe('Approved')
    expect(shopStatusWord('pending')).toBe('Pending')
    expect(shopStatusWord('hidden')).toBe('Hidden')
    expect(shopStatusWord('rejected')).toBe('Rejected')
  })

  test('lists contextual desk actions for each listing status', () => {
    expect(cafeDeskActions('approved')).toEqual(['edit', 'unpublish', 'delete'])
    expect(cafeDeskActions('hidden')).toEqual(['edit', 'publish', 'delete'])
    expect(cafeDeskActions('pending')).toEqual(['edit', 'approve', 'reject', 'delete'])
    expect(cafeDeskActions('rejected')).toEqual(['edit', 'delete'])
    expect(cafeDeskActionLabel('unpublish')).toBe('Unpublish')
    expect(cafeDeskConfirmTitle('publish', 'Yardstick Coffee')).toBe('Publish Yardstick Coffee?')
    expect(cafeDeskConfirmMessage('unpublish')).toMatch(/leaves Home and Map/)
    expect(cafeDeskConfirmAction('reject')).toBe('Reject cafe')
    expect(cafeDeskDoneCopy('approve', 'Yardstick Coffee')).toBe('Yardstick Coffee is on Home and Map.')
  })

  test('warns that deleting a cafe cannot be undone', () => {
    expect(deleteCafeTitle('Yardstick Coffee')).toBe('Delete Yardstick Coffee?')
    expect(deleteCafeMessage()).toMatch(/cannot be undone/)
    expect(deleteCafeAction()).toBe('Delete cafe')
    expect(deleteCafeBusyLabel()).toBe('Deleting…')
    expect(deleteCafeDoneCopy('Yardstick Coffee')).toBe('Yardstick Coffee was deleted.')
  })

  test('keeps only unused cafe storage keys from a delete payload', () => {
    expect(uniqueDeletableAdminObjectKeys([
      'shop-logos/admin/mark.webp',
      '/ad-banners/admin/banner.jpg',
      'audit-photos/auditor/visit.png',
      'shop-logos/admin/mark.webp',
      '../secret',
      'https://evil.example/x',
      '  ',
    ])).toEqual([
      'shop-logos/admin/mark.webp',
      'ad-banners/admin/banner.jpg',
      'audit-photos/auditor/visit.png',
    ])
    expect(parseDeletedAdminShop({
      id: 'shop-1',
      name: 'Yardstick Coffee',
      object_keys: ['shop-logos/admin/mark.webp', 'nope'],
    })).toEqual({
      id: 'shop-1',
      name: 'Yardstick Coffee',
      objectKeys: ['shop-logos/admin/mark.webp'],
    })
    expect(missingDeleteAdminShopCopy('Could not find the function public.delete_admin_shop')).toMatch(/20261026_delete_admin_shop/)
    expect(missingDeleteAdminShopCopy('Cafe was not found')).toBeNull()
  })

  test('rejects missing pin and short names without requiring Metro Manila', () => {
    const errors = adminCafeErrors({
      name: 'A',
      address: 'Short',
      lat: null,
      lng: 121,
      phone: 'abc',
      hours: null,
      logoFile: null,
    })
    expect(errors.name).toMatch(/2/)
    expect(errors.address).toBeTruthy()
    expect(errors.pin).toMatch(/Pin/)
    expect(errors.phone).toMatch(/phone/)
    expect(errors.hours).toMatch(/hours/)
  })
})

describe('ad campaigns', () => {
  const now = new Date('2026-09-29T04:00:00.000Z')

  test('requires a future end after start', () => {
    expect(campaignWindowError('2026-09-29T05:00:00.000Z', '2026-09-29T04:00:00.000Z', now)).toMatch(/end date/)
    expect(campaignWindowError('2026-09-20T00:00:00.000Z', '2026-09-28T00:00:00.000Z', now)).toMatch(/future/)
    expect(campaignWindowError('2026-09-29T05:00:00.000Z', '2026-10-29T05:00:00.000Z', now)).toBeNull()
  })

  test('treats cancelled or disabled campaigns as inactive', () => {
    expect(isAdCampaignActive({
      enabled: true,
      cancelled_at: null,
      starts_at: '2026-09-01T00:00:00.000Z',
      ends_at: '2026-10-01T00:00:00.000Z',
    }, now)).toBe(true)
    expect(isAdCampaignActive({
      enabled: false,
      cancelled_at: null,
      starts_at: '2026-09-01T00:00:00.000Z',
      ends_at: '2026-10-01T00:00:00.000Z',
    }, now)).toBe(false)
    expect(isAdCampaignActive({
      enabled: true,
      cancelled_at: '2026-09-28T00:00:00.000Z',
      starts_at: '2026-09-01T00:00:00.000Z',
      ends_at: '2026-10-01T00:00:00.000Z',
    }, now)).toBe(false)
  })

  test('sorts live ads by priority then recency', () => {
    const sorted = sortActiveAds([
      { id: 'a', priority: 0, starts_at: '2026-09-28T00:00:00.000Z' },
      { id: 'b', priority: 2, starts_at: '2026-09-01T00:00:00.000Z' },
      { id: 'c', priority: 2, starts_at: '2026-09-20T00:00:00.000Z' },
    ])
    expect(sorted.map((row) => row.id)).toEqual(['c', 'b', 'a'])
  })

  test('validates banner files and wide aspect', () => {
    expect(bannerFileError(null)).toMatch(/banner/)
    expect(bannerFileError(null, false)).toBeNull()
    expect(bannerAspectError(1200, 400)).toBeNull()
    expect(bannerAspectError(400, 400)).toMatch(/640/)
    expect(bannerAspectError(1600, 1600)).toMatch(/wide/)
  })

  test('shows an internal ad label under the cafe name when it is set', () => {
    expect(featuredAdCopy('% Arabica', 'Summer blend')).toEqual({
      name: '% Arabica',
      place: 'Summer blend',
    })
    expect(featuredAdCopy('% Arabica', '  ')).toEqual({ name: '% Arabica', place: '' })
    expect(featuredAdCopy('% Arabica', '% Arabica')).toEqual({ name: '% Arabica', place: '' })
    expect(featuredAdCopy('% Arabica', null)).toEqual({ name: '% Arabica', place: '' })
  })
})

describe('roles and placements', () => {
  test('blocks self role changes and last-admin demotion', () => {
    expect(roleChangeError({
      actorId: 'admin-1',
      targetId: 'admin-1',
      nextRole: 'user',
      adminCount: 3,
      targetRole: 'admin',
    })).toMatch(/your own/)
    expect(roleChangeError({
      actorId: 'admin-1',
      targetId: 'admin-2',
      nextRole: 'user',
      adminCount: 1,
      targetRole: 'admin',
    })).toMatch(/last admin/)
    expect(roleChangeError({
      actorId: 'admin-1',
      targetId: 'admin-2',
      nextRole: 'cafe-owner',
      adminCount: 1,
      targetRole: 'admin',
    })).toMatch(/last admin/)
    expect(roleChangeError({
      actorId: 'admin-1',
      targetId: 'user-2',
      nextRole: 'cafe-owner',
      adminCount: 1,
      targetRole: 'user',
    })).toBeNull()
    expect(suspendError({ actorId: 'admin-1', targetId: 'admin-1', banned: false })).toMatch(/your own/)
    expect(edgeFunctionErrorMessage(
      new Error('Edge Function returned a non-2xx status code'),
      { error: 'Admin only' },
    )).toBe('Admin only')
  })

  test('classifies placement windows', () => {
    const now = new Date('2026-09-29T04:00:00.000Z')
    expect(placementLifecycle({
      starts_at: '2026-10-01T00:00:00.000Z',
      ends_at: '2026-11-01T00:00:00.000Z',
    }, now)).toBe('scheduled')
    expect(placementLifecycle({
      starts_at: '2026-09-01T00:00:00.000Z',
      ends_at: '2026-10-01T00:00:00.000Z',
    }, now)).toBe('current')
    expect(placementLifecycle({
      starts_at: '2026-08-01T00:00:00.000Z',
      ends_at: '2026-09-01T00:00:00.000Z',
    }, now)).toBe('ended')
    expect(placementWindowError('2026-09-01T00:00', '2026-08-01T00:00')).toMatch(/end date/)
    expect(placementKindFromTier('promoted')).toBe('sponsored')
  })

  test('maps admin routes and local datetime inputs', () => {
    expect(adminNavIdFromPath('/admin/cafes/new')).toBe('cafes')
    expect(adminNavIdFromPath('/admin')).toBe('dashboard')
    expect(toLocalInput(new Date('2026-09-29T08:05:00'))).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  test('builds public object URLs and rejects the R2 API host', () => {
    expect(publicObjectUrl('ad-banners/a/b.webp', 'https://pub-test.r2.dev')).toBe('https://pub-test.r2.dev/ad-banners/a/b.webp')
    expect(publicObjectUrl('ad-banners/a/b.webp', 'https://abc.r2.cloudflarestorage.com')).toBeNull()
  })

  test('create and update payloads keep a selected existing logo key without uploading', () => {
    const reused = adminLogoPayload({
      logoFile: null,
      logoObjectKey: 'shop-logos/yardstick.webp',
    })
    expect(reused).toEqual({
      shouldUpload: false,
      logoObjectKey: 'shop-logos/yardstick.webp',
    })

    const createInput = {
      name: 'Yardstick BGC',
      logoFile: null as File | null,
      logoObjectKey: reused.logoObjectKey,
    }
    const updateInput = {
      name: 'Yardstick Poblacion',
      logoFile: null as File | null,
      logoObjectKey: reused.logoObjectKey,
    }
    expect(adminLogoPayload(createInput)).toEqual(reused)
    expect(adminLogoPayload(updateInput)).toEqual(reused)
  })
})
