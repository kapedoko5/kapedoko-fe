export const COMPACT_MAX_PX = 599
export const EXPANDED_MIN_PX = 840
export const WIDE_LIST_COLUMNS_PX = 1200
export const RAIL_WIDTH_PX = 80
export const TABBAR_HEIGHT_PX = 72
export const TABBAR_FLOAT_OFFSET_PX = 16
export const SIDE_PANE_WIDTH_PX = 400
export const DETAIL_PANE_MIN_PX = 280

export function clampDetailPaneWidth(width: number, viewportWidth: number): number {
  const viewport = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0
  const max = Math.max(DETAIL_PANE_MIN_PX, Math.floor(viewport / 2))
  const value = Number.isFinite(width) ? width : SIDE_PANE_WIDTH_PX
  return Math.min(max, Math.max(DETAIL_PANE_MIN_PX, Math.round(value)))
}

export type ViewportSizeClass = 'compact' | 'medium' | 'expanded'
export type ViewportSpan = 'none' | 'horizontal' | 'vertical'
export type AppNavMode = 'hidden' | 'bar' | 'float'
export type CafeListColumns = 1 | 2 | 3

export type ViewportLayout = {
  size: ViewportSizeClass
  span: ViewportSpan
  rail: boolean
  listColumns: CafeListColumns
}

export function sizeClassForWidth(width: number): ViewportSizeClass {
  const value = Number.isFinite(width) ? Math.max(0, width) : 0
  if (value <= COMPACT_MAX_PX) return 'compact'
  if (value < EXPANDED_MIN_PX) return 'medium'
  return 'expanded'
}

export function spanForSegments(horizontalSegments = 1, verticalSegments = 1): ViewportSpan {
  if (horizontalSegments >= 2) return 'horizontal'
  if (verticalSegments >= 2) return 'vertical'
  return 'none'
}

export function listColumnsFor(width: number, size: ViewportSizeClass): CafeListColumns {
  if (size === 'compact') return 1
  if (size === 'medium') return 2
  return width >= WIDE_LIST_COLUMNS_PX ? 3 : 2
}

export function viewportLayoutFor(input: {
  width: number
  horizontalSegments?: number
  verticalSegments?: number
}): ViewportLayout {
  const width = Number.isFinite(input.width) ? Math.max(0, input.width) : 0
  const size = sizeClassForWidth(width)
  return {
    size,
    span: spanForSegments(input.horizontalSegments, input.verticalSegments),
    rail: false,
    listColumns: listColumnsFor(width, size),
  }
}

export function appNavModeFor(visible: boolean, size: ViewportSizeClass): AppNavMode {
  if (!visible) return 'hidden'
  return size === 'compact' ? 'bar' : 'float'
}

export function usesDetailPane(size: ViewportSizeClass): boolean {
  return size !== 'compact'
}

export type LayoutDatasetHost = {
  dataset: { [key: string]: string | undefined }
}

export type LayoutStyleHost = LayoutDatasetHost & {
  style: { setProperty: (name: string, value: string) => void }
}

export function applyLayoutToDocument(
  layout: ViewportLayout,
  target: LayoutDatasetHost,
) {
  target.dataset.kdLayout = layout.size
  target.dataset.kdSpan = layout.span
}

export function applyAppNavToDocument(
  mode: AppNavMode,
  target: LayoutStyleHost,
) {
  target.dataset.kdNav = mode
  target.style.setProperty('--kd-rail-width', '0px')
}

export function sidePaneGutterPx(viewportWidth: number): number {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0
  return Math.min(SIDE_PANE_WIDTH_PX, Math.round(width * 0.42))
}

export function applySidePaneToDocument(
  open: boolean,
  target: LayoutStyleHost,
  widthPx?: number,
) {
  target.dataset.kdPane = open ? 'open' : 'closed'
  const gutter = open ? Math.max(0, Math.round(widthPx ?? SIDE_PANE_WIDTH_PX)) : 0
  target.style.setProperty('--kd-pane-gutter', `${gutter}px`)
}
