import { safeRedirectPath } from '~/utils/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureLiveSession } = useAuth()
  if (await ensureLiveSession()) return

  const redirect = safeRedirectPath(to.fullPath)
  return navigateTo({ path: '/login', query: { redirect } })
})
