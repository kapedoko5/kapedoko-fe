import { confirmCallbackPath } from '~/utils/auth-confirm'

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const path = url.pathname
  if (path.startsWith('/_') || path.startsWith('/assets') || path.startsWith('/favicon')) return

  const next = confirmCallbackPath(path, url.searchParams)
  if (!next) return
  return sendRedirect(event, `${next}${url.search}`, 302)
})
