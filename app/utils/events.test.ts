import { describe, expect, test } from 'bun:test'
import type { KapeEvent } from '~/types/event'
import {
  EVENT_NEARBY_RADIUS_M,
  adminEventErrors,
  eventIdFromRoute,
  eventLifecycle,
  eventWindowError,
  eventsWithinMeters,
  formatEventWhen,
  isEventDisplayActive,
  isEventId,
} from './events'

const origin = { lat: 14.5995, lng: 120.9842 }

const sampleEvent = (overrides: Partial<KapeEvent> = {}): KapeEvent => ({
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  name: 'Coffee Fest',
  organizerName: 'Kape Guild',
  organizerContactName: null,
  organizerContactNumber: null,
  description: null,
  address: 'Intramuros, Manila',
  lat: 14.5895,
  lng: 120.9752,
  eventStartsAt: '2026-11-12T02:00:00.000Z',
  eventEndsAt: '2026-11-12T10:00:00.000Z',
  displayStartsAt: '2026-11-09T00:00:00.000Z',
  displayEndsAt: '2026-11-12T10:00:00.000Z',
  poster: '/poster.jpg',
  gallery: [],
  whenLabel: 'Thu, Nov 12, 10:00 AM – 6:00 PM',
  placeLine: 'Intramuros, Manila',
  ...overrides,
})

describe('event ids', () => {
  test('accepts a uuid from the events route', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    expect(isEventId(id)).toBe(true)
    expect(eventIdFromRoute(`/app/events/${id}`, 'nope')).toBe(id)
    expect(eventIdFromRoute(`/#/app/events/${id}`)).toBe(id)
    expect(eventIdFromRoute(`/#/admin/events/${id}`)).toBe(id)
    expect(eventIdFromRoute('/admin/events/', id)).toBe(id)
    expect(eventIdFromRoute('/app/cafes/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe('')
  })
})

describe('display window', () => {
  test('treats in-window enabled rows as live', () => {
    const now = new Date('2026-11-10T00:00:00.000Z')
    const row = {
      enabled: true,
      cancelled_at: null,
      display_starts_at: '2026-11-09T00:00:00.000Z',
      display_ends_at: '2026-11-12T00:00:00.000Z',
    }
    expect(isEventDisplayActive(row, now)).toBe(true)
    expect(eventLifecycle(row, now)).toBe('live')
    expect(eventLifecycle({ ...row, display_starts_at: '2026-11-11T00:00:00.000Z' }, now)).toBe('scheduled')
    expect(eventLifecycle({ ...row, enabled: false }, now)).toBe('ended')
  })

  test('rejects a display end that is not after start', () => {
    expect(eventWindowError('2026-11-12T10:00', '2026-11-12T09:00', 'display')).toMatch(/end after the start/)
  })
})

describe('nearby filter', () => {
  test('keeps events inside 5 km and drops farther ones', () => {
    const nearby = sampleEvent()
    const far = sampleEvent({
      id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
      lat: 14.6760,
      lng: 121.0437,
    })
    const shown = eventsWithinMeters([nearby, far], origin, EVENT_NEARBY_RADIUS_M)
    expect(shown.map((event) => event.id)).toEqual([nearby.id])
  })

  test('hides every event without a real origin', () => {
    expect(eventsWithinMeters([sampleEvent()], null)).toEqual([])
  })
})

describe('admin event errors', () => {
  test('requires a pin, poster, and future display end', () => {
    const errors = adminEventErrors({
      name: 'Coffee Fest',
      organizerName: 'Kape Guild',
      organizerContactName: '',
      organizerContactNumber: 'abc',
      description: '',
      address: '123',
      lat: null,
      lng: null,
      eventStartsAt: '2026-11-12T10:00',
      eventEndsAt: '2026-11-12T18:00',
      displayStartsAt: '2026-11-01T10:00',
      displayEndsAt: '2026-11-02T10:00',
      posterFile: null,
      posterObjectKey: null,
      galleryCount: 0,
    })
    expect(errors.pin).toMatch(/Pin/)
    expect(errors.poster).toMatch(/poster/)
    expect(errors.organizerContactNumber).toMatch(/phone/)
    expect(errors.address).toBeTruthy()
    expect(errors.displayWindow).toMatch(/future/)
  })
})

describe('event when copy', () => {
  test('joins same-day start and end', () => {
    const label = formatEventWhen('2026-11-12T02:00:00.000Z', '2026-11-12T10:00:00.000Z')
    expect(label).toMatch(/Nov/)
    expect(label).toMatch(/–/)
  })
})
