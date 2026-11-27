import { isShopId } from '~/utils/approved-shops'
import {
  adEventIsValid,
  createAdCooldown,
  type AdEventKind,
  type AdPlacement,
} from '~/utils/ad-attribution'
import {
  createTrafficCooldown,
  shopTrafficConsentAllowsCapture,
  type ShopTrafficKind,
  type ShopTrafficSurface,
} from '~/utils/shop-traffic'

const allowTraffic = createTrafficCooldown()
const allowAd = createAdCooldown()

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

  /**
   * Campaign attribution next to the per-cafe event. Banners pass their
   * campaign id; featured cafes pass the cafe id and no campaign. Silent when
   * the RPC is not deployed yet.
   */
  const recordAd = (
    placement: AdPlacement,
    kind: AdEventKind,
    ids: { campaignId?: string | null, shopId?: string | null },
  ) => {
    if (!import.meta.client) return
    if (!shopTrafficConsentAllowsCapture(consent.value)) return
    const campaignId = ids.campaignId?.trim() || null
    const shopId = placement === 'featured' ? ids.shopId?.trim() || null : null
    if (!adEventIsValid({ placement, campaignId, shopId })) return
    if (!allowAd(placement, kind, campaignId, shopId)) return
    void supabase.rpc('record_ad_event', {
      p_placement: placement,
      p_kind: kind,
      p_campaign_id: campaignId,
      p_shop_id: shopId,
    }).then(() => undefined, () => undefined)
  }

  return { record, recordAd }
}
