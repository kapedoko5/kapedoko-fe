import { snapshotAuthCallback } from '~/utils/auth-confirm'

export default defineNuxtPlugin({
  enforce: 'pre',
  setup() {
    try {
      snapshotAuthCallback(window.location.href, window.sessionStorage)
    } catch {
      // Private mode can block sessionStorage.
    }
  },
})
