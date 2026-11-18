import type { AmenityVerificationStatus, ShopAmenityVerificationRow } from '~/types/shop'
import { VERIFY_REJECTION_MAX } from '~/utils/owner-verify'

export function useAmenityVerifications() {
  const supabase = useSupabaseClient()
  const rows = useState<ShopAmenityVerificationRow[]>('kd-amenity-verifications', () => [])
  const status = useState<'idle' | 'loading' | 'ready' | 'error'>('kd-amenity-verifications-status', () => 'idle')
  const error = useState('kd-amenity-verifications-error', () => '')
  const savingId = useState<string | null>('kd-amenity-verifications-saving', () => null)

  const pendingCount = computed(() => rows.value.filter((row) => row.status === 'pending').length)

  const load = async () => {
    status.value = 'loading'
    error.value = ''
    try {
      const { data, error: rpcError } = await supabase.rpc('list_amenity_verifications')
      if (rpcError) throw rpcError
      rows.value = (data ?? []) as ShopAmenityVerificationRow[]
      status.value = 'ready'
    } catch (err) {
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Could not load amenity proofs.'
    }
  }

  const byId = (id: string) => rows.value.find((row) => row.id === id) ?? null

  const moderate = async (
    id: string,
    next: Extract<AmenityVerificationStatus, 'approved' | 'rejected'>,
    reason?: string,
  ) => {
    savingId.value = id
    try {
      const clean = reason?.trim() || null
      if (next === 'rejected' && (!clean || clean.length > VERIFY_REJECTION_MAX)) {
        throw new Error('Add a reason for rejecting this proof.')
      }
      const { data, error: rpcError } = await supabase.rpc('moderate_shop_amenity_verification', {
        p_verification_id: id,
        p_status: next,
        p_rejection_reason: next === 'rejected' ? clean : null,
      })
      const saved = (Array.isArray(data) ? data[0] : data) as ShopAmenityVerificationRow | null
      if (rpcError || !saved) throw new Error(rpcError?.message || 'Could not review this proof.')
      rows.value = rows.value.map((row) => (row.id === saved.id ? { ...row, ...saved } : row))
      return saved
    } finally {
      savingId.value = null
    }
  }

  return { rows, status, error, savingId, pendingCount, load, byId, moderate }
}
