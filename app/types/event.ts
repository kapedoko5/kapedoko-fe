export interface EventRow {
  id: string
  name: string
  organizer_name: string
  organizer_contact_name: string | null
  organizer_contact_number: string | null
  description: string | null
  address: string
  latitude: number
  longitude: number
  event_starts_at: string
  event_ends_at: string
  display_starts_at: string
  display_ends_at: string
  poster_object_key: string
  gallery_object_keys: string[]
  enabled: boolean
  cancelled_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ActiveEventRow {
  id: string
  name: string
  organizer_name: string
  organizer_contact_name: string | null
  organizer_contact_number: string | null
  description: string | null
  address: string
  latitude: number
  longitude: number
  event_starts_at: string
  event_ends_at: string
  display_starts_at: string
  display_ends_at: string
  poster_object_key: string
  gallery_object_keys: string[]
}

export interface KapeEvent {
  id: string
  name: string
  organizerName: string
  organizerContactName: string | null
  organizerContactNumber: string | null
  description: string | null
  address: string
  lat: number
  lng: number
  eventStartsAt: string
  eventEndsAt: string
  displayStartsAt: string
  displayEndsAt: string
  poster: string
  gallery: string[]
  whenLabel: string
  placeLine: string
}

export type EventLifecycle = 'scheduled' | 'live' | 'ended'
