import { onIonViewDidEnter, onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue'
import {
  isActiveForeignSurface,
  isForeignSurface,
  isVisibleIonPageClass,
  pathFromHref,
  resolveAppPath,
  resolveTabBarVisible,
  shouldShowAppNav,
  tabBarModeForPath,
  type AppTabBarMode,
} from '~/utils/app-tabs'
import { appNavModeFor, applyAppNavToDocument } from '~/utils/viewport-layout'

const tabFreePages = new Set<Element>()
let pendingTabFreeShells = 0
/** After leaving admin/onboarding, ignore leftover stacked pages until a new hide surface mounts. */
let holdTabBarShow = false

function hideIonPage(page: Element) {
  page.classList.add('ion-page-hidden')
  page.setAttribute('aria-hidden', 'true')
}

export function useAppTabsLock() {
  const locked = useState('kd-app-tabs-locked', () => false)

  const applyHtml = () => {
    if (!import.meta.client) return
    document.documentElement.classList.toggle('kd-hide-app-tabs', locked.value)
  }

  const setLocked = (value: boolean) => {
    locked.value = value
    applyHtml()
  }

  watch(locked, applyHtml, { immediate: true })

  return { locked, setLocked }
}

function unlockTabFreePages(setLocked: (value: boolean) => void) {
  holdTabBarShow = true
  const pages = [...tabFreePages]
  tabFreePages.clear()
  pendingTabFreeShells = 0
  setLocked(false)
  for (const page of pages) hideIonPage(page)
}

/**
 * Show the shell tab bar immediately when leaving a tab-free surface
 * (admin, onboarding, auth). Call from setup so the returned function can
 * run later in click / leave handlers.
 */
export function useRevealAppTabBar() {
  const { setLocked } = useAppTabsLock()
  const pageMode = useState<AppTabBarMode | null>('kd-app-tab-page', () => null)
  const pageStamp = useState('kd-app-tab-page-stamp', () => 0)
  const routeMode = useState<AppTabBarMode | null>('kd-app-tab-route', () => null)
  const routeStamp = useState('kd-app-tab-route-stamp', () => 0)
  const appliedPath = useState('kd-app-tab-applied', () => '')
  const locationPath = useState('kd-app-tab-location', () => '')

  return (path = '/app') => {
    const current = pathFromHref(path) || '/app'
    unlockTabFreePages(setLocked)
    pageStamp.value += 1
    pageMode.value = 'show'
    routeStamp.value = pageStamp.value
    routeMode.value = 'show'
    appliedPath.value = current
    locationPath.value = current
  }
}

export function useHideAppTabs(shellEl: Ref<HTMLElement | null>, surface: string) {
  const route = useRoute()
  const { setLocked } = useAppTabsLock()
  const revealAppTabBar = useRevealAppTabBar()
  let page: Element | null = null
  let observer: MutationObserver | null = null
  let pending = false

  const publish = () => {
    if (holdTabBarShow) {
      setLocked(false)
      return
    }
    setLocked(tabFreePages.size > 0 || pendingTabFreeShells > 0)
  }

  const beginPending = () => {
    holdTabBarShow = false
    if (pending) return
    pending = true
    pendingTabFreeShells += 1
    publish()
  }

  const endPending = () => {
    if (!pending) return
    pending = false
    pendingTabFreeShells = Math.max(0, pendingTabFreeShells - 1)
    publish()
  }

  const bind = (el: HTMLElement) => {
    const nextPage = el.closest('.ion-page')
    if (!nextPage) return
    page = nextPage
    page.setAttribute('data-app-surface', surface)
    const syncPage = () => {
      if (!page) return
      if (holdTabBarShow) {
        tabFreePages.delete(page)
        publish()
        return
      }
      if (isVisibleIonPageClass(page.className)) {
        tabFreePages.add(page)
        endPending()
      }
      else {
        tabFreePages.delete(page)
      }
      publish()
    }
    syncPage()
    observer?.disconnect()
    observer = new MutationObserver(syncPage)
    observer.observe(page, { attributes: true, attributeFilter: ['class'] })
  }

  const release = () => {
    observer?.disconnect()
    observer = null
    if (page) {
      tabFreePages.delete(page)
      page.removeAttribute('data-app-surface')
      page = null
    }
    endPending()
    publish()
  }

  const leaveForTabBar = (toPath: string) => {
    if (tabBarModeForPath(toPath) !== 'show') return
    if (page) {
      tabFreePages.delete(page)
      hideIonPage(page)
    }
    endPending()
    revealAppTabBar(toPath)
  }

  if (import.meta.client) beginPending()

  watch(shellEl, (el) => {
    if (el) bind(el)
  }, { flush: 'post' })

  watch(() => route.path, (path, previous) => {
    if (previous && tabBarModeForPath(path) === 'show') leaveForTabBar(path)
  })

  onMounted(() => {
    if (shellEl.value) bind(shellEl.value)
  })

  onBeforeUnmount(release)

  return { release }
}

export function useAdminPageTabLock(shellEl: Ref<HTMLElement | null>) {
  useHideAppTabs(shellEl, 'admin')
}

/**
 * Mark the page that is entering. Ionic can show the next view before Vue
 * Router or the browser URL catches up, so this claim updates the tab bar
 * on that first navigation. A later route change still wins until the next enter.
 */
export function useAppTabBar(mode: AppTabBarMode) {
  const route = useRoute()
  const pageMode = useState<AppTabBarMode | null>('kd-app-tab-page', () => null)
  const pageStamp = useState('kd-app-tab-page-stamp', () => 0)
  const revealAppTabBar = useRevealAppTabBar()

  const claim = () => {
    if (mode === 'hide' && holdTabBarShow && tabBarModeForPath(route.path) === 'show') return
    if (mode === 'hide') holdTabBarShow = false
    pageStamp.value += 1
    pageMode.value = mode
  }

  if (import.meta.client) claim()
  onIonViewWillEnter(claim)
  onIonViewDidEnter(claim)
  onIonViewWillLeave(() => {
    if (mode !== 'hide') return
    const dest = import.meta.client
      ? pathFromHref(`${window.location.pathname}${window.location.hash}`)
      : ''
    if (tabBarModeForPath(dest) === 'show') revealAppTabBar(dest)
  })

  return { reveal: revealAppTabBar }
}

export function useAppTabBarVisibility() {
  const route = useRoute()
  const { locked, setLocked } = useAppTabsLock()
  const { size } = useViewportLayout()
  const splash = useState('kd-splash-loading', () => true)
  const pageMode = useState<AppTabBarMode | null>('kd-app-tab-page', () => null)
  const pageStamp = useState('kd-app-tab-page-stamp', () => 0)
  const routeMode = useState<AppTabBarMode | null>('kd-app-tab-route', () => null)
  const routeStamp = useState('kd-app-tab-route-stamp', () => 0)
  const appliedPath = useState('kd-app-tab-applied', () => '')
  const locationPath = useState('kd-app-tab-location', () => '')

  const notePath = (path: string) => {
    const current = pathFromHref(path)
    if (!current || current === '/') return
    const mode = tabBarModeForPath(current)
    if (mode === 'hide' && isForeignSurface(current) && tabBarModeForPath(route.path) === 'show') {
      // Vue already landed on a tab page; ignore a late leftover admin URL.
      return
    }
    if (current === appliedPath.value && mode !== 'show') return
    appliedPath.value = current
    // A real path change is newer than any page already on screen, so the bar
    // follows the navigation immediately. The entering page can claim again after.
    routeStamp.value = pageStamp.value + 1
    routeMode.value = mode
    if (mode === 'show') {
      locationPath.value = current
      unlockTabFreePages(setLocked)
    }
  }

  watch(() => route.path, (path) => {
    if (import.meta.client) {
      locationPath.value = `${window.location.pathname}${window.location.hash}`
    }
    notePath(resolveAppPath(path, locationPath.value) || path)
  }, { immediate: true, flush: 'sync' })

  if (import.meta.client) {
    const onLocation = () => {
      const href = `${window.location.pathname}${window.location.hash}`
      locationPath.value = href
      notePath(href)
    }

    onMounted(() => {
      const href = `${window.location.pathname}${window.location.hash}`
      locationPath.value = href
      notePath(resolveAppPath(route.path, href))
      window.addEventListener('popstate', onLocation)
      window.addEventListener('hashchange', onLocation)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('popstate', onLocation)
      window.removeEventListener('hashchange', onLocation)
    })
  }

  const liveShellPath = computed(() => (
    resolveAppPath(
      route.path,
      import.meta.client
        ? (locationPath.value || `${window.location.pathname}${window.location.hash}`)
        : locationPath.value,
    )
  ))

  const visible = computed(() => {
    const path = liveShellPath.value
    const compactVisible = resolveTabBarVisible({
      pageMode: pageMode.value,
      pageStamp: pageStamp.value,
      routeMode: routeMode.value,
      routeStamp: routeStamp.value,
      foreign: isActiveForeignSurface(path, locationPath.value),
    })
    if (size.value === 'compact') return compactVisible
    return shouldShowAppNav(path, size.value, locationPath.value)
  })

  const syncNavDataset = () => {
    if (!import.meta.client) return
    applyAppNavToDocument(
      appNavModeFor(visible.value && !locked.value && !splash.value, size.value),
      document.documentElement,
    )
  }

  watch([visible, locked, size, splash], syncNavDataset, { immediate: true })

  return { visible }
}
