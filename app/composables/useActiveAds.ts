import type { ActiveAdCampaignRow, AdDestinationKind } from '~/types/admin'
import { adDestinationKind, sortActiveAds } from '~/utils/admin-ads'
import { publicObjectUrl } from '~/utils/shop-mapper'

export interface HomeAd {
  id: string
  shopId: string | null
  name: string
  href: string
  image: string
  label: string
  destinationKind: AdDestinationKind
  destinationUrl: string | null
}

export function useActiveAds() {
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const ads = ref<HomeAd[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const refresh = async () => {
    status.value = 'loading'
    try {
      const { data, error } = await supabase
        .from('active_ad_campaigns')
        .select('id, shop_id, banner_object_key, starts_at, ends_at, priority, label, destination_kind, destination_url')
        .order('priority', { ascending: false })

      if (error) throw error
      const rows = sortActiveAds((data ?? []) as ActiveAdCampaignRow[])
      const shopIds = [...new Set(rows.map((row) => row.shop_id).filter((id): id is string => Boolean(id)))]
      const names = new Map<string, string>()
      if (shopIds.length) {
        const { data: shops } = await supabase
          .from('shops')
          .select('id, name')
          .in('id', shopIds)
          .eq('status', 'approved')
        for (const shop of shops ?? []) {
          names.set(shop.id as string, shop.name as string)
        }
      }

      const publicBase = String(config.public.r2PublicBaseUrl || '')
      ads.value = rows.flatMap((row) => {
        const image = publicObjectUrl(row.banner_object_key, publicBase)
        if (!image) return []
        const kind = adDestinationKind(row)
        if (kind === 'cafe') {
          const name = row.shop_id ? names.get(row.shop_id) : undefined
          if (!name || !row.shop_id) return []
          return [{
            id: row.id,
            shopId: row.shop_id,
            name,
            href: `/app/cafes/${row.shop_id}`,
            image,
            label: row.label?.trim() || '',
            destinationKind: kind,
            destinationUrl: null,
          }]
        }
        const destinationUrl = row.destination_url?.trim() || ''
        if (!destinationUrl) return []
        return [{
          id: row.id,
          shopId: null,
          name: row.label?.trim() || 'Ad',
          href: destinationUrl,
          image,
          label: row.label?.trim() || '',
          destinationKind: kind,
          destinationUrl,
        }]
      })
      status.value = 'ready'
    } catch {
      ads.value = []
      status.value = 'error'
    }
  }

  onMounted(() => {
    void refresh()
  })

  return { ads, status, refresh }
}
