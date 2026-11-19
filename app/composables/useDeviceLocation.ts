import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import type { LatLng } from '~/types/cafe'
import { METRO_MANILA_FALLBACK } from '~/utils/geo'

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'

export interface DeviceLocation extends LatLng {
  accuracy: number
}

const POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 60_000,
  enableLocationFallback: true,
}

function classifyLocationError(error: unknown): Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'> {
  const err = error as { code?: string | number; message?: string }
  const code = String(err?.code ?? '')
  const message = String(err?.message ?? '').toLowerCase()

  if (
    code === 'OS-PLUG-GLOC-0003'
    || code === 'OS-PLUG-GLOC-0008'
    || code === 'OS-PLUG-GLOC-0009'
    || code === '1'
    || err?.code === 1
    || message.includes('denied')
    || message.includes('restricted')
  ) {
    return 'denied'
  }

  return 'unavailable'
}

export function useDeviceLocation() {
  const status = ref<LocationStatus>('idle')
  const location = ref<DeviceLocation | null>(null)
  const usingFallback = ref(false)
  const center = computed<LatLng>(() => location.value ?? METRO_MANILA_FALLBACK)

  const applyFallback = (nextStatus: Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'>) => {
    status.value = nextStatus
    usingFallback.value = true
    location.value = {
      ...METRO_MANILA_FALLBACK,
      accuracy: 0,
    }
  }

  const requestLocation = async () => {
    status.value = 'requesting'

    try {
      if (Capacitor.isNativePlatform()) {
        const current = await Geolocation.checkPermissions()
        const granted =
          current.location === 'granted' || current.coarseLocation === 'granted'

        if (!granted) {
          const requested = await Geolocation.requestPermissions({
            permissions: ['location'],
          })
          const allowed =
            requested.location === 'granted'
            || requested.coarseLocation === 'granted'

          if (!allowed) {
            applyFallback('denied')
            return
          }
        }
      }

      const position = await Geolocation.getCurrentPosition(POSITION_OPTIONS)
      location.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 0,
      }
      usingFallback.value = false
      status.value = 'granted'
    } catch (error) {
      const next = classifyLocationError(error)
      applyFallback(next)
    }
  }

  return {
    status,
    location,
    usingFallback,
    center,
    requestLocation,
  }
}
