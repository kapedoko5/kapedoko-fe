import type { VibeTagNameRow } from '~/types/admin'
import { parseVibeDayPick, pruneVibeIds, serializeVibeDayPick, VIBE_DAY_KEY } from '~/utils/vibe-day'

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * "What's your vibe?" state, shared by the tab bar button, the modal and Home.
 * Picks live in localStorage for the local day, then expire.
 */
export function useVibeFilter() {
  const supabase = useSupabaseClient()
  const open = useState('vibe-modal-open', () => false)
  const tagIds = useState<string[]>('vibe-day-ids', () => [])
  const catalog = useState<VibeTagNameRow[]>('vibe-catalog', () => [])
  const status = useState<CatalogStatus>('vibe-catalog-status', () => 'idle')
  const hydrated = useState('vibe-hydrated', () => false)

  const persist = (ids: string[]) => {
    if (!import.meta.client) return
    try {
      if (ids.length) localStorage.setItem(VIBE_DAY_KEY, serializeVibeDayPick(ids))
      else localStorage.removeItem(VIBE_DAY_KEY)
    } catch {
      /* storage blocked: the pick still works for this session */
    }
  }

  const hydrate = () => {
    if (!import.meta.client || hydrated.value) return
    hydrated.value = true
    try {
      tagIds.value = parseVibeDayPick(localStorage.getItem(VIBE_DAY_KEY))
    } catch {
      tagIds.value = []
    }
  }

  const loadCatalog = async () => {
    if (status.value === 'loading' || status.value === 'ready') return
    status.value = 'loading'
    const { data, error } = await supabase
      .from('vibe_tag_names')
      .select('*')
      .eq('enabled', true)
      .order('label', { ascending: true })
    if (error) {
      status.value = 'error'
      return
    }
    catalog.value = (data ?? []) as VibeTagNameRow[]
    const pruned = pruneVibeIds(tagIds.value, catalog.value.map((tag) => tag.id))
    if (pruned.length !== tagIds.value.length) {
      tagIds.value = pruned
      persist(pruned)
    }
    status.value = 'ready'
  }

  const apply = (ids: string[]) => {
    tagIds.value = [...new Set(ids)]
    persist(tagIds.value)
  }

  const clear = () => apply([])

  const openModal = () => {
    hydrate()
    void loadCatalog()
    open.value = true
  }

  const closeModal = () => {
    open.value = false
  }

  const picked = computed(() => catalog.value.filter((tag) => tagIds.value.includes(tag.id)))

  return { open, tagIds, catalog, status, picked, hydrate, loadCatalog, apply, clear, openModal, closeModal }
}
