import {
  DEFAULT_CAFE_PRICE_MARKS,
  missingCafePriceMarksSqlCopy,
  parseCafePriceMarks,
  type CafePriceMarks,
} from '~/utils/cafe-price-marks'

export function useCafePriceMarks() {
  const supabase = useSupabaseClient()
  const marks = useState<CafePriceMarks>('kd-cafe-price-marks', () => ({ ...DEFAULT_CAFE_PRICE_MARKS }))
  const status = useState<'idle' | 'loading' | 'ready' | 'error'>('kd-cafe-price-marks-status', () => 'idle')
  const error = useState('kd-cafe-price-marks-error', () => '')

  const load = async (force = false) => {
    if (!force && (status.value === 'ready' || status.value === 'loading')) return marks.value
    status.value = 'loading'
    error.value = ''
    try {
      const { data, error: loadError } = await supabase
        .from('cafe_price_marks')
        .select('budget_max_php, mid_max_php')
        .eq('id', true)
        .maybeSingle()
      if (loadError) throw loadError
      marks.value = parseCafePriceMarks(data)
      status.value = 'ready'
    } catch (err) {
      marks.value = { ...DEFAULT_CAFE_PRICE_MARKS }
      status.value = 'ready'
      error.value = err instanceof Error ? err.message : ''
    }
    return marks.value
  }

  const save = async (next: CafePriceMarks) => {
    const { data, error: rpcError } = await supabase.rpc('update_cafe_price_marks', {
      p_budget_max_php: next.budgetMaxPhp,
      p_mid_max_php: next.midMaxPhp,
    })
    const row = Array.isArray(data) ? data[0] : data
    if (rpcError || !row) {
      throw new Error(
        missingCafePriceMarksSqlCopy(rpcError?.message || '')
        || rpcError?.message
        || 'Could not save price marks.',
      )
    }
    marks.value = parseCafePriceMarks(row)
    status.value = 'ready'
    error.value = ''
    return marks.value
  }

  onMounted(() => {
    void load()
  })

  return { marks, status, error, load, save }
}
