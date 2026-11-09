import {
  applySidePaneToDocument,
  sidePaneGutterPx,
} from '~/utils/viewport-layout'

export function useSidePaneGutter(
  open: MaybeRefOrGetter<boolean>,
  widthPx?: MaybeRefOrGetter<number | undefined>,
) {
  const { compact } = useViewportLayout()
  const id = useId()
  const owners = useState<Record<string, number>>('kd-pane-gutter-owners', () => ({}))

  const publish = () => {
    if (!import.meta.client) return
    const widths = Object.values(owners.value)
    const gutter = widths.length ? Math.max(...widths) : 0
    applySidePaneToDocument(gutter > 0, document.documentElement, gutter)
  }

  const apply = () => {
    if (!import.meta.client) return
    const isOpen = Boolean(toValue(open)) && !compact.value
    const explicit = toValue(widthPx)
    const gutter = isOpen
      ? (typeof explicit === 'number' ? explicit : sidePaneGutterPx(window.innerWidth || 0))
      : 0
    const next = { ...owners.value }
    if (gutter > 0) next[id] = gutter
    else delete next[id]
    owners.value = next
    publish()
  }

  const release = () => {
    if (!import.meta.client) return
    const next = { ...owners.value }
    delete next[id]
    owners.value = next
    publish()
  }

  watch([() => toValue(open), compact, () => toValue(widthPx)], apply, { immediate: true })

  if (import.meta.client) {
    onMounted(() => {
      apply()
      window.addEventListener('resize', apply)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('resize', apply)
      release()
    })
  }
}
