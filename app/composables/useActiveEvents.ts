import type { ActiveEventRow } from '~/types/event'
import type { KapeEvent } from '~/types/event'
import { mapActiveEvent } from '~/utils/events'

export function useActiveEvents() {
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const events = ref<KapeEvent[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const refresh = async () => {
    status.value = 'loading'
    try {
      const { data, error } = await supabase
        .from('active_events')
        .select('id, name, organizer_name, organizer_contact_name, organizer_contact_number, description, address, latitude, longitude, event_starts_at, event_ends_at, display_starts_at, display_ends_at, poster_object_key, gallery_object_keys')
        .order('event_starts_at', { ascending: true })

      if (error) throw error
      const publicBase = String(config.public.r2PublicBaseUrl || '')
      events.value = ((data ?? []) as ActiveEventRow[])
        .map((row) => mapActiveEvent(row, publicBase))
        .filter((event): event is KapeEvent => Boolean(event))
      status.value = 'ready'
    } catch {
      events.value = []
      status.value = 'error'
    }
  }

  onMounted(() => {
    void refresh()
  })

  return { events, status, refresh }
}
