import { isShopId } from '~/utils/approved-shops'
import {
  createTrafficCooldown,
  shopTrafficConsentAllowsCapture,
  type ShopTrafficKind,
  type ShopTrafficSurface,
} from '~/utils/shop-traffic'

const allowTraffic = createTrafficCooldown()

export function useShopTrafficCapture() {
  const supabase = useSupabaseClient()
  const { consent } = useAnalytics()

  const record = (shopId: string, kind: ShopTrafficKind, surface: ShopTrafficSurface) => {
    if (!import.meta.client) return
    if (!shopTrafficConsentAllowsCapture(consent.value)) return
    if (!isShopId(shopId)) return
    if (!allowTraffic(shopId, kind, surface)) return
    void supabase.rpc('record_shop_traffic', {
      p_shop_id: shopId,
      p_kind: kind,
      p_surface: surface,
    }).then(() => undefined, () => undefined)
  }

  return { record }
}
