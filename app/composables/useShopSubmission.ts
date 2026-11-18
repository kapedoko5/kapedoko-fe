import type { ShopInsert, ShopRow } from '~/types/shop'
import { normalizeAddress, normalizeCafeName } from '~/utils/identity'
import { optionalPhone } from '~/utils/phone'
import { isAllowedLogo } from '~/utils/logo'
import { uploadPresignedImage } from '~/utils/presign-upload'
import { authUserId } from '~/utils/auth'
import type { WeeklyHours } from '~/types/shop'

interface SubmitShopInput {
  name: string
  address: string
  lat: number
  lng: number
  phone: string
  hours: WeeklyHours
  logoFile: File | null
}

export function useShopSubmission() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const session = useSupabaseSession()
  const submitting = ref(false)
  const error = ref('')

  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!isAllowedLogo(file)) return null

    try {
      return await uploadPresignedImage(file, 'shop-logo')
    } catch (err) {
      throw new Error(friendlyUploadError(err instanceof Error ? err.message : '', undefined))
    }
  }

  const submitShop = async (input: SubmitShopInput): Promise<ShopRow> => {
    error.value = ''
    const { data: liveSession } = await supabase.auth.getSession()
    const userId =
      liveSession.session?.user?.id ??
      session.value?.user?.id ??
      authUserId(user.value)

    if (!userId) {
      throw new Error('Sign in to add a cafe.')
    }

    submitting.value = true
    try {
      let logoObjectKey: string | null = null
      if (input.logoFile) {
        logoObjectKey = await uploadLogo(input.logoFile)
      }

      const row: ShopInsert = {
        name: normalizeCafeName(input.name),
        address: normalizeAddress(input.address),
        latitude: input.lat,
        longitude: input.lng,
        hours: input.hours,
        contact_number: optionalPhone(input.phone),
        logo_object_key: logoObjectKey,
        submitted_by: userId,
        status: 'pending',
      }

      const { data, error: insertError } = await supabase
        .from('shops')
        .insert(row)
        .select()
        .single()

      if (insertError || !data) {
        throw new Error(friendlyInsertError(insertError?.message))
      }

      return data as ShopRow
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save this cafe. Try again.'
      error.value = message
      throw err instanceof Error ? err : new Error(message)
    } finally {
      submitting.value = false
    }
  }

  return { submitShop, submitting, error, uploadLogo }
}

function friendlyUploadError(fnMessage?: string, payloadError?: string): string {
  const text = `${fnMessage ?? ''} ${payloadError ?? ''}`.toLowerCase()
  if (payloadError) return payloadError
  if (text.includes('failed to fetch')) {
    return 'Could not reach the logo upload service. Check your connection and try again.'
  }
  if (text.includes('sign in')) {
    return 'Sign in again, then submit the cafe.'
  }
  return 'Logo upload failed. Submit without a logo, or try again later.'
}

function friendlyInsertError(message?: string): string {
  const text = (message ?? '').toLowerCase()
  if (text.includes('shops_in_coverage') || text.includes('shops_in_marikina')) {
    return 'Philippines only. Pin the cafe inside the Philippines before submitting.'
  }
  if (text.includes('shops_hours_shape')) {
    return 'Check the opening hours and try again.'
  }
  if (text.includes('shops_contact_number')) {
    return 'Use a phone number like 0917 123 4567.'
  }
  if (text.includes('shops_name_len')) {
    return 'Check the cafe name and try again.'
  }
  if (text.includes('row-level security') || text.includes('rls')) {
    return 'Sign in again, then submit the cafe.'
  }
  return 'Could not save this cafe. Check the details and try again.'
}
