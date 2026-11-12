import { safeRedirectPath } from '~/utils/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureLiveSession } = useAuth()
  if (!(await ensureLiveSession())) return

  const requested = Array.isArray(to.query.redirect) ? to.query.redirect[0] : to.query.redirect
  return navigateTo(safeRedirectPath(requested))
})
