import { confirmCallbackPath } from '~/utils/auth-confirm'

export default defineNuxtRouteMiddleware((to) => {
  const next = confirmCallbackPath(to.path, to.query as Record<string, unknown>, to.hash)
  if (!next) return
  return navigateTo({ path: next, query: to.query, hash: to.hash })
})
