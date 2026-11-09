import {
  applyLayoutToDocument,
  viewportLayoutFor,
  type ViewportLayout,
  type ViewportSizeClass,
  type ViewportSpan,
} from '~/utils/viewport-layout'

function readWidth() {
  return Math.max(window.innerWidth || 0, window.visualViewport?.width || 0)
}

function readSegments() {
  if (!window.matchMedia) return { horizontal: 1, vertical: 1 }
  return {
    horizontal: window.matchMedia('(horizontal-viewport-segments: 2)').matches ? 2 : 1,
    vertical: window.matchMedia('(vertical-viewport-segments: 2)').matches ? 2 : 1,
  }
}

function snapshot(): ViewportLayout {
  const segments = readSegments()
  return viewportLayoutFor({
    width: readWidth(),
    horizontalSegments: segments.horizontal,
    verticalSegments: segments.vertical,
  })
}

export function useViewportLayout() {
  const layout = useState<ViewportLayout>('kd-viewport-layout', () => (
    viewportLayoutFor({ width: 390 })
  ))

  const apply = () => {
    const next = snapshot()
    layout.value = next
    applyLayoutToDocument(next, document.documentElement)
  }

  if (import.meta.client) {
    apply()
    onMounted(() => {
      apply()
      window.addEventListener('resize', apply)
      window.visualViewport?.addEventListener('resize', apply)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', apply)
      window.visualViewport?.removeEventListener('resize', apply)
    })
  }

  return {
    layout,
    size: computed<ViewportSizeClass>(() => layout.value.size),
    span: computed<ViewportSpan>(() => layout.value.span),
    rail: computed(() => layout.value.rail),
    listColumns: computed(() => layout.value.listColumns),
    compact: computed(() => layout.value.size === 'compact'),
  }
}
