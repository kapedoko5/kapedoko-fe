import { describe, expect, test } from 'bun:test'
import { ADMIN_NAV, adminBackNav, adminNavIdFromPath, staffNav } from './admin-nav'

describe('admin routes', () => {
  test('covers every portal section under /admin', () => {
    const hrefs = ADMIN_NAV.map((item) => item.href)
    expect(hrefs).toEqual([
      '/admin',
      '/admin/cafes',
      '/admin/audits',
      '/admin/requests',
      '/admin/claims',
      '/admin/partnerships',
      '/admin/ads',
      '/admin/users',
      '/admin/moderation',
    ])
    expect(ADMIN_NAV.every((item) => item.href === '/admin' || item.href.startsWith('/admin/'))).toBe(true)
  })

  test('keeps nested cafe routes on the cafes section', () => {
    expect(adminNavIdFromPath('/admin/cafes/abc-123')).toBe('cafes')
    expect(adminNavIdFromPath('/admin/cafes/import')).toBe('cafes')
    expect(adminNavIdFromPath('/admin/audits/new')).toBe('audits')
    expect(adminNavIdFromPath('/admin/cafes/abc-123/audits')).toBe('audits')
    expect(adminNavIdFromPath('/admin/requests?id=1')).toBe('requests')
    expect(adminNavIdFromPath('/admin/claims')).toBe('claims')
    expect(adminNavIdFromPath('/admin/moderation')).toBe('moderation')
    expect(adminNavIdFromPath('/admin/users')).toBe('users')
    expect(adminNavIdFromPath('/admin')).toBe('dashboard')
  })

  test('auditors only see the audits section', () => {
    expect(staffNav('auditor').map((item) => item.id)).toEqual(['audits'])
    expect(staffNav('admin').map((item) => item.id)).toContain('cafes')
  })

  test('nested cafe pages return to the cafes index', () => {
    expect(adminBackNav('/admin/cafes')).toBeNull()
    expect(adminBackNav('/admin/cafes/new')).toEqual({ to: '/admin/cafes', label: 'Cafes' })
    expect(adminBackNav('/admin/cafes/import')).toEqual({ to: '/admin/cafes', label: 'Cafes' })
    expect(adminBackNav('/admin/cafes/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toEqual({
      to: '/admin/cafes',
      label: 'Cafes',
    })
  })

  test('nested audit pages return to the audits index or cafe history', () => {
    const shop = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    expect(adminBackNav('/admin/audits')).toBeNull()
    expect(adminBackNav('/admin/audits/new')).toEqual({ to: '/admin/audits', label: 'Audits' })
    expect(adminBackNav('/admin/audits/new', { shop })).toEqual({
      to: `/admin/audits/${shop}`,
      label: 'Cafe audits',
    })
    expect(adminBackNav(`/admin/audits/new?shop=${shop}&corrects=1`, { shop })).toEqual({
      to: `/admin/audits/${shop}`,
      label: 'Cafe audits',
    })
    expect(adminBackNav('/admin/audits/new', { shop: 'not-a-shop' })).toEqual({
      to: '/admin/audits',
      label: 'Audits',
    })
    expect(adminBackNav(`/admin/audits/${shop}`)).toEqual({ to: '/admin/audits', label: 'Audits' })
  })

  test('section indexes do not grow a back control', () => {
    expect(adminBackNav('/admin')).toBeNull()
    expect(adminBackNav('/admin/requests')).toBeNull()
    expect(adminBackNav('/admin/claims')).toBeNull()
    expect(adminBackNav('/admin/users')).toBeNull()
  })
})
