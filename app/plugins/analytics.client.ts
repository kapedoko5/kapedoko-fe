import { hydrateAnalyticsConsent } from '~/composables/useAnalytics'

export default defineNuxtPlugin({
  name: 'kapedoko-analytics',
  setup() {
    void hydrateAnalyticsConsent()
  },
})
