import type { Cafe } from '~/types/cafe'
import type { ShopReviewRow } from '~/types/shop'
import { authUserId } from '~/utils/auth'
import {
  fetchApprovedCafeById,
  fetchOwnShopReview,
  hydrateCafeDetail,
} from '~/utils/approved-shops'
import {
  draftToReviewInsert,
  isBusynessCooldown,
  isValidBusynessLevel,
  readCheckInAt,
  writeCheckInAt,
  type CafeReviewDraft,
} from '~/utils/cafe-review'
import type { BusynessLevel } from '~/types/shop'

const busynessInflight = new Set<string>()

export function useCafeReview() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const session = useSupabaseSession()
  const config = useRuntimeConfig()
  const submitting = ref(false)
  const reporting = ref(false)
  const error = ref('')

  const publicBase = () => String(config.public.r2PublicBaseUrl || '')

  const currentUserId = async (): Promise<string | null> => {
    const { data: liveSession } = await supabase.auth.getSession()
    return (
      liveSession.session?.user?.id ??
      session.value?.user?.id ??
      authUserId(user.value)
    )
  }

  const loadCafe = async (shopId: string): Promise<Cafe | null> => {
    const cafe = await fetchApprovedCafeById(supabase, publicBase(), shopId)
    if (!cafe) return null
    try {
      return await hydrateCafeDetail(supabase, cafe)
    } catch {
      return cafe
    }
  }

  const loadOwnReview = async (shopId: string): Promise<ShopReviewRow | null> => {
    const userId = await currentUserId()
    if (!userId) return null
    try {
      return await fetchOwnShopReview(supabase, shopId, userId)
    } catch {
      return null
    }
  }

  const saveReview = async (shopId: string, draft: CafeReviewDraft): Promise<ShopReviewRow> => {
    error.value = ''
    const userId = await currentUserId()
    if (!userId) throw new Error('Sign in to review this cafe.')

    submitting.value = true
    try {
      const row = draftToReviewInsert(draft, shopId, userId)
      const { data, error: upsertError } = await supabase
        .from('reviews')
        .upsert(row, { onConflict: 'shop_id,user_id' })
        .select()
        .single()

      if (upsertError || !data) {
        throw new Error(friendlyReviewError(upsertError?.message))
      }
      return data as ShopReviewRow
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save this review. Try again.'
      error.value = message
      throw err instanceof Error ? err : new Error(message)
    } finally {
      submitting.value = false
    }
  }

  const reportBusyness = async (shopId: string, level: BusynessLevel): Promise<'saved' | 'cooldown'> => {
    error.value = ''
    if (!isValidBusynessLevel(level)) {
      throw new Error('Pick how packed the cafe is right now.')
    }
    if (busynessInflight.has(shopId)) return 'cooldown'

    busynessInflight.add(shopId)
    reporting.value = true
    try {
      const userId = await currentUserId()
      if (!userId) throw new Error('Sign in to review this cafe.')
      if (isBusynessCooldown(readCheckInAt(userId, shopId))) return 'cooldown'

      const { error: insertError } = await supabase.from('shop_busyness_reports').insert({
        shop_id: shopId,
        user_id: userId,
        level,
      })

      if (!insertError) {
        writeCheckInAt(userId, shopId)
        return 'saved'
      }
      if (isCooldownError(insertError.message)) {
        writeCheckInAt(userId, shopId)
        return 'cooldown'
      }
      throw new Error(friendlyReviewError(insertError.message))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not log how busy it is. Try again.'
      if (isCooldownError(message)) {
        return 'cooldown'
      }
      error.value = message
      throw err instanceof Error ? err : new Error(message)
    } finally {
      busynessInflight.delete(shopId)
      reporting.value = false
    }
  }

  return {
    submitting,
    reporting,
    error,
    currentUserId,
    loadCafe,
    loadOwnReview,
    saveReview,
    reportBusyness,
  }
}

function isCooldownError(message?: string): boolean {
  return (message ?? '').toLowerCase().includes('busyness_cooldown')
}

function friendlyReviewError(message?: string): string {
  const text = (message ?? '').toLowerCase()
  if (isCooldownError(text)) {
    return 'We already logged how busy this cafe is. You can check in again in a bit.'
  }
  if (text.includes('sign in') || text.includes('jwt') || text.includes('row-level security') || text.includes('rls')) {
    return 'Sign in again, then submit the review.'
  }
  if (text.includes('only approved shops')) {
    return 'This cafe is not on the map yet, so it cannot be reviewed.'
  }
  if (text.includes('reviews_comment_len') || text.includes('comment')) {
    return 'Keep suggestions under 280 characters.'
  }
  if (text.includes('failed to fetch')) {
    return 'Could not reach KapeDoko. Check your connection and try again.'
  }
  return 'Could not save this review. Check your answers and try again.'
}
