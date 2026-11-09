import type { LatLng } from '~/types/cafe'
import type { ActiveEventRow, EventLifecycle, EventRow, KapeEvent } from '~/types/event'
import { addressError } from './identity'
import { cafePlaceLine } from './maps'
import { isValidLatitude, isValidLongitude } from './admin-shop'
import { distanceMeters } from './geo'
import { isValidPhone, normalizePhone } from './phone'
import { publicObjectUrl } from './shop-mapper'

export const EVENT_NEARBY_RADIUS_M = 5_000
export const EVENT_GALLERY_MAX = 8
export const EVENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const EVENT_DESCRIPTION_MAX = 2000

const EVENT_ID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const EVENT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MANILA_TZ = 'Asia/Manila'

export function isEventId(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length === 36 && EVENT_ID_RE.test(trimmed)
}

export function eventIdFromRoute(path: string, param?: unknown): string {
  const fromParam = typeof param === 'string'
    ? param
    : Array.isArray(param)
      ? String(param[0] || '')
      : ''
  if (isEventId(fromParam)) return fromParam.trim()
  const match = `${fromParam} ${path}`.match(/\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  return match?.[1] && isEventId(match[1]) ? match[1] : ''
}

export function isEventDisplayActive(
  event: Pick<EventRow, 'enabled' | 'cancelled_at' | 'display_starts_at' | 'display_ends_at'> | Pick<ActiveEventRow, 'display_starts_at' | 'display_ends_at'>,
  now = new Date(),
): boolean {
  const enabled = 'enabled' in event ? event.enabled !== false : true
  const cancelled = 'cancelled_at' in event ? Boolean(event.cancelled_at) : false
  if (!enabled || cancelled) return false
  const start = new Date(event.display_starts_at).getTime()
  const end = new Date(event.display_ends_at).getTime()
  const at = now.getTime()
  return Number.isFinite(start) && Number.isFinite(end) && start <= at && end > at
}

export function eventLifecycle(
  event: Pick<EventRow, 'enabled' | 'cancelled_at' | 'display_starts_at' | 'display_ends_at'>,
  now = new Date(),
): EventLifecycle {
  if (event.cancelled_at || event.enabled === false) return 'ended'
  if (isEventDisplayActive(event, now)) return 'live'
  if (new Date(event.display_starts_at).getTime() > now.getTime()) return 'scheduled'
  return 'ended'
}

export function eventWindowError(startsAt: string, endsAt: string, label: string, now?: Date): string | null {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return `Choose a ${label} start and end time.`
  }
  if (end <= start) return `Choose a ${label} end after the start.`
  if (now && end <= now) return `Choose a ${label} end in the future.`
  return null
}

export function eventImageFileError(file: File | null, required = false): string | null {
  if (!file) return required ? 'Upload a poster image.' : null
  if (!EVENT_IMAGE_TYPES.has(file.type)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size > EVENT_IMAGE_MAX_BYTES) return 'Keep the image under 4 MB.'
  return null
}

export function organizerNameError(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) return 'Enter the organizer name.'
  if (name.length < 2) return 'Use at least 2 characters.'
  if (name.length > 80) return 'Keep the organizer name under 80 characters.'
  return null
}

export function eventNameError(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) return 'Enter the event name.'
  if (name.length < 2) return 'Use at least 2 characters.'
  if (name.length > 80) return 'Keep the name under 80 characters.'
  return null
}

export function eventDescriptionError(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  if (text.length > EVENT_DESCRIPTION_MAX) return 'Keep the description under 2,000 characters.'
  return null
}

export interface AdminEventInput {
  name: string
  organizerName: string
  organizerContactName: string
  organizerContactNumber: string
  description: string
  address: string
  lat: number | null
  lng: number | null
  eventStartsAt: string
  eventEndsAt: string
  displayStartsAt: string
  displayEndsAt: string
  posterFile: File | null
  posterObjectKey: string | null
  galleryCount: number
}

export function adminEventErrors(input: AdminEventInput): Record<string, string | null> {
  const contactName = input.organizerContactName.trim()
  const phone = normalizePhone(input.organizerContactNumber)
  return {
    name: eventNameError(input.name),
    organizerName: organizerNameError(input.organizerName),
    organizerContactName: !contactName || contactName.length <= 80
      ? null
      : 'Keep the contact name under 80 characters.',
    organizerContactNumber: !phone || isValidPhone(phone)
      ? null
      : 'Use a phone number like 0917 123 4567.',
    description: eventDescriptionError(input.description),
    address: addressError(input.address),
    pin: isValidLatitude(input.lat) && isValidLongitude(input.lng) ? null : 'Pin the event on the map.',
    eventWindow: eventWindowError(input.eventStartsAt, input.eventEndsAt, 'event'),
    displayWindow: eventWindowError(input.displayStartsAt, input.displayEndsAt, 'display', new Date()),
    poster: eventImageFileError(input.posterFile, !input.posterObjectKey),
    gallery: input.galleryCount <= EVENT_GALLERY_MAX ? null : `Keep extra photos to ${EVENT_GALLERY_MAX}.`,
  }
}

export function adminEventHasErrors(input: AdminEventInput): boolean {
  return Object.values(adminEventErrors(input)).some(Boolean)
}

export function formatEventWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return ''

  const dayFmt = new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    hour: 'numeric',
    minute: '2-digit',
  })
  const startDay = dayFmt.format(start)
  const endDay = dayFmt.format(end)
  const startTime = timeFmt.format(start)
  const endTime = timeFmt.format(end)
  if (startDay === endDay) return `${startDay}, ${startTime} – ${endTime}`
  return `${startDay}, ${startTime} – ${endDay}, ${endTime}`
}

export function mapActiveEvent(row: ActiveEventRow, publicBase: string): KapeEvent | null {
  const poster = publicObjectUrl(row.poster_object_key, publicBase)
  if (!poster) return null
  const lat = Number(row.latitude)
  const lng = Number(row.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const gallery = (row.gallery_object_keys ?? [])
    .map((key) => publicObjectUrl(key, publicBase))
    .filter((url): url is string => Boolean(url))
  return {
    id: row.id,
    name: row.name,
    organizerName: row.organizer_name,
    organizerContactName: row.organizer_contact_name,
    organizerContactNumber: row.organizer_contact_number,
    description: row.description,
    address: row.address,
    lat,
    lng,
    eventStartsAt: row.event_starts_at,
    eventEndsAt: row.event_ends_at,
    displayStartsAt: row.display_starts_at,
    displayEndsAt: row.display_ends_at,
    poster,
    gallery,
    whenLabel: formatEventWhen(row.event_starts_at, row.event_ends_at),
    placeLine: cafePlaceLine(row.address, row.name),
  }
}

export function eventsWithinMeters(events: KapeEvent[], origin: LatLng | null, meters = EVENT_NEARBY_RADIUS_M): KapeEvent[] {
  if (!origin) return []
  return events
    .map((event) => ({ event, distance: distanceMeters(origin, event) }))
    .filter((entry) => entry.distance <= meters)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.event)
}
