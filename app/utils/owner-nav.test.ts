import { describe, expect, test } from 'bun:test'
import {
  formatOwnerDate,
  isOwnerDeskPath,
  isOwnerLoginPath,
  ownerBackNav,
  ownerCafeEditPath,
  ownerNavIdFromPath,
} from './owner-nav'

describe('owner nav', () => {
  test('maps nested cafe routes to the cafes section', () => {
    expect(ownerNavIdFromPath('/owner')).toBe('desk')
    expect(ownerNavIdFromPath('/owner/cafes')).toBe('cafes')
    expect(ownerNavIdFromPath('/owner/cafes/abc')).toBe('cafes')
    expect(ownerNavIdFromPath('/owner/ads')).toBe('ads')
    expect(ownerNavIdFromPath('/owner/claims')).toBe('claims')
    expect(ownerNavIdFromPath('/owner/claims/?x=1')).toBe('claims')
  })

  test('sends nested cafe editors back to the cafe shelf', () => {
    expect(ownerBackNav('/owner')).toBeNull()
    expect(ownerBackNav('/owner/cafes')).toBeNull()
    expect(ownerBackNav('/owner/cafes/11111111-1111-4111-8111-111111111111')).toEqual({
      to: '/owner/cafes',
      label: 'Cafes',
    })
  })

  test('knows desk versus login paths', () => {
    expect(isOwnerDeskPath('/owner')).toBe(true)
    expect(isOwnerDeskPath('/owner/cafes')).toBe(true)
    expect(isOwnerDeskPath('/owner/ads')).toBe(true)
    expect(isOwnerLoginPath('/owner/login')).toBe(true)
    expect(isOwnerLoginPath('/owner')).toBe(false)
    expect(isOwnerDeskPath('/admin')).toBe(false)
  })

  test('builds an edit path only for a shop id', () => {
    expect(ownerCafeEditPath('11111111-1111-4111-8111-111111111111')).toBe(
      '/owner/cafes/11111111-1111-4111-8111-111111111111',
    )
    expect(ownerCafeEditPath('not-an-id')).toBe('/owner/cafes')
  })

  test('formats a Philippine datetime or an em dash', () => {
    expect(formatOwnerDate(null)).toBe('—')
    expect(formatOwnerDate('not-a-date')).toBe('—')
    expect(formatOwnerDate('2026-03-02T04:00:00.000Z')).toMatch(/2026/)
  })
})
