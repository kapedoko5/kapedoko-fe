export type AppTabId = 'home' | 'saved' | 'map' | 'profile'

export const APP_TAB_PATHS: Record<AppTabId, string> = {
  home: '/app',
  saved: '/app/favorites',
  map: '/app/map',
  profile: '/app/profile',
}

const FOREIGN_PREFIXES = ['/admin', '/login', '/register', '/privacy', '/confirm', '/forgot-password'] as const

export function normalizeAppPath(path: string): string {
  const trimmed = path.split(/[?#]/, 1)[0] ?? ''
  if (!trimmed) return '/'
  if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.slice(0, -1)
  return trimmed
}

export function pathFromHref(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  const hashIndex = raw.indexOf('#')
  if (hashIndex >= 0) {
    const hashPath = (raw.slice(hashIndex + 1).split(/[?#]/, 1)[0] ?? '').trim()
    if (hashPath.startsWith('/')) return normalizeAppPath(hashPath)
  }
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(withoutHash)) {
      return normalizeAppPath(new URL(withoutHash).pathname)
    }
  } catch {
    /* fall through to path parsing */
  }
  return normalizeAppPath(withoutHash.replace(/^https?:\/\/[^/]+/i, ''))
}

export function isSameAppPath(currentPath: string, targetPath: string): boolean {
  return normalizeAppPath(currentPath) === normalizeAppPath(targetPath)
}

/** Prefer the browser path when Ionic and Vue Router disagree. */
export function resolveAppPath(routePath: string, locationPath?: string | null): string {
  const fromRoute = normalizeAppPath(routePath)
  const fromLocation = locationPath ? pathFromHref(locationPath) : ''
  if (fromLocation && fromLocation !== '/' && fromLocation !== fromRoute) return fromLocation
  return fromLocation && fromLocation !== '/' ? fromLocation : fromRoute
}

/** Routes where the shell tab bar is visible (Map is a tab target but full-screen without the bar). */
export function isAppTabRoute(path: string): boolean {
  const current = normalizeAppPath(path)
  return current === APP_TAB_PATHS.home
    || current === APP_TAB_PATHS.saved
    || current === APP_TAB_PATHS.profile
}

export function isForeignSurface(path: string): boolean {
  const current = pathFromHref(path)
  return FOREIGN_PREFIXES.some((prefix) => current === prefix || current.startsWith(`${prefix}/`))
}

export function isOnboardingPath(path: string): boolean {
  const current = pathFromHref(path)
  return current === '/app/onboarding' || current.startsWith('/app/onboarding/')
}

/** Marketing landing at `/`. Not an app shell, not a splash redirect. */
export function isLandingPath(path: string): boolean {
  return pathFromHref(path) === '/'
}

/** App routes where the shell tab bar must stay hidden (everything except home, saved, profile). */
export function isAppTabBarHiddenRoute(path: string): boolean {
  const current = pathFromHref(path)
  if (isOnboardingPath(current)) return true
  if (!current.startsWith('/app')) return false
  return !isAppTabRoute(current)
}

export function isAppShellPath(path: string): boolean {
  const current = pathFromHref(path)
  return current.startsWith('/app') && !isOnboardingPath(current)
}

export type AppTabBarMode = 'show' | 'hide'

/** Tab bar for a single current path. `/` is the marketing landing and stays hidden. */
export function tabBarModeForPath(path: string): AppTabBarMode | null {
  const current = pathFromHref(path)
  if (!current) return null
  if (isLandingPath(current) || isForeignSurface(current) || isOnboardingPath(current) || isAppTabBarHiddenRoute(current)) return 'hide'
  if (isAppTabRoute(current)) return 'show'
  return 'hide'
}

/**
 * True only while a foreign surface is actually current.
 * A leftover admin/auth URL must not win after the app route is already a tab.
 */
export function isActiveForeignSurface(routePath: string, locationPath?: string | null): boolean {
  if (isForeignSurface(routePath)) return true
  if (!locationPath || !isForeignSurface(locationPath)) return false
  return tabBarModeForPath(routePath) !== 'show'
}

/**
 * Page enter wins when it is at least as new as the route change, so the bar
 * updates on the first navigation even if Ionic and Vue disagree.
 * A newer show route wins so leaving admin/onboarding updates the bar immediately,
 * even if a foreign hint or hide claim has not been cleared yet.
 */
export function resolveTabBarVisible(input: {
  pageMode: AppTabBarMode | null
  pageStamp: number
  routeMode: AppTabBarMode | null
  routeStamp: number
  foreign: boolean
}): boolean {
  const pageWins = input.pageMode != null && input.pageStamp >= input.routeStamp
  const mode = pageWins ? input.pageMode : input.routeMode
  if (input.foreign && mode !== 'show') return false
  return mode === 'show'
}

/**
 * Whether the tab bar should show for `path`. Extra hints only hide the bar
 * when one of them is a foreign surface (admin, auth). A stale app path does not.
 */
export function shouldShowAppTabs(path: string, ...peerPaths: Array<string | null | undefined>): boolean {
  const hints = [path, ...peerPaths]
    .map((value) => (value ? pathFromHref(value) : ''))
    .filter((entry) => entry && entry !== '/')
  if (hints.some(isForeignSurface)) return false
  return tabBarModeForPath(path) === 'show'
}

/**
 * Compact keeps the phone tab bar on Home / Saved / Profile only.
 * Medium and expanded keep a floating bottom bar on every app shell route.
 * Ionic can leave Vue's route at `/` while the browser is already on `/app`;
 * peer paths (the real location) still count as the shell.
 */
export function shouldShowAppNav(
  path: string,
  layout: 'compact' | 'medium' | 'expanded',
  ...peerPaths: Array<string | null | undefined>
): boolean {
  const hints = [path, ...peerPaths]
    .map((value) => (value ? pathFromHref(value) : ''))
    .filter((entry) => entry && entry !== '/')
  if (hints.some(isForeignSurface) || hints.some(isOnboardingPath)) return false
  if (layout === 'compact') return shouldShowAppTabs(path, ...peerPaths)
  return hints.some(isAppShellPath)
}

export function isVisibleIonPageClass(className: string): boolean {
  const classes = new Set(className.split(/\s+/).filter(Boolean))
  return !classes.has('ion-page-hidden') && !classes.has('ion-page-invisible')
}

export function activeAppTab(path: string): AppTabId {
  const current = normalizeAppPath(path)
  if (current === APP_TAB_PATHS.map || current.startsWith(`${APP_TAB_PATHS.map}/`)) return 'map'
  if (current === APP_TAB_PATHS.saved || current.startsWith(`${APP_TAB_PATHS.saved}/`)) return 'saved'
  if (current === APP_TAB_PATHS.profile || current.startsWith(`${APP_TAB_PATHS.profile}/`)) return 'profile'
  return 'home'
}
