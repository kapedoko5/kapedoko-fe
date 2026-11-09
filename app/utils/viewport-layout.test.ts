import { describe, expect, test } from 'bun:test'
import {
  appNavModeFor,
  applyAppNavToDocument,
  applySidePaneToDocument,
  sidePaneGutterPx,
  clampDetailPaneWidth,
  DETAIL_PANE_MIN_PX,
  SIDE_PANE_WIDTH_PX,
  usesDetailPane,
  applyLayoutToDocument,
  listColumnsFor,
  sizeClassForWidth,
  spanForSegments,
  viewportLayoutFor,
} from './viewport-layout'

describe('viewport size classes', () => {
  test('treats phone and Fold cover widths as compact', () => {
    expect(sizeClassForWidth(320)).toBe('compact')
    expect(sizeClassForWidth(390)).toBe('compact')
    expect(sizeClassForWidth(599)).toBe('compact')
  })

  test('treats unfolded Fold portrait as medium', () => {
    expect(sizeClassForWidth(600)).toBe('medium')
    expect(sizeClassForWidth(673)).toBe('medium')
    expect(sizeClassForWidth(839)).toBe('medium')
  })

  test('treats desktop and Fold landscape as expanded', () => {
    expect(sizeClassForWidth(840)).toBe('expanded')
    expect(sizeClassForWidth(1024)).toBe('expanded')
    expect(sizeClassForWidth(1440)).toBe('expanded')
  })

  test('falls back to compact for invalid widths', () => {
    expect(sizeClassForWidth(Number.NaN)).toBe('compact')
    expect(sizeClassForWidth(-40)).toBe('compact')
  })
})

describe('viewport spanning and packing', () => {
  test('prefers horizontal dual-screen segments over tabletop', () => {
    expect(spanForSegments(2, 2)).toBe('horizontal')
    expect(spanForSegments(2, 1)).toBe('horizontal')
    expect(spanForSegments(1, 2)).toBe('vertical')
    expect(spanForSegments(1, 1)).toBe('none')
  })

  test('packs cafe lists as 1, 2, then 3 columns', () => {
    expect(listColumnsFor(390, 'compact')).toBe(1)
    expect(listColumnsFor(673, 'medium')).toBe(2)
    expect(listColumnsFor(1024, 'expanded')).toBe(2)
    expect(listColumnsFor(1200, 'expanded')).toBe(3)
  })

  test('builds a layout snapshot without device-model checks', () => {
    expect(viewportLayoutFor({ width: 673, horizontalSegments: 1 })).toEqual({
      size: 'medium',
      span: 'none',
      rail: false,
      listColumns: 2,
    })
    expect(viewportLayoutFor({ width: 1440, horizontalSegments: 2 })).toEqual({
      size: 'expanded',
      span: 'horizontal',
      rail: false,
      listColumns: 3,
    })
    expect(viewportLayoutFor({ width: 390 })).toEqual({
      size: 'compact',
      span: 'none',
      rail: false,
      listColumns: 1,
    })
  })
})

describe('app nav mode', () => {
  test('keeps a docked bottom bar on compact and a floating bar on wide', () => {
    expect(appNavModeFor(true, 'compact')).toBe('bar')
    expect(appNavModeFor(true, 'medium')).toBe('float')
    expect(appNavModeFor(true, 'expanded')).toBe('float')
    expect(appNavModeFor(false, 'expanded')).toBe('hidden')
  })

  test('opens cafe and event details in a right pane from medium up', () => {
    expect(usesDetailPane('compact')).toBe(false)
    expect(usesDetailPane('medium')).toBe(true)
    expect(usesDetailPane('expanded')).toBe(true)
  })

  test('caps a resizable detail pane at half the viewport', () => {
    expect(clampDetailPaneWidth(400, 1440)).toBe(400)
    expect(clampDetailPaneWidth(900, 1440)).toBe(720)
    expect(clampDetailPaneWidth(200, 1440)).toBe(DETAIL_PANE_MIN_PX)
    expect(clampDetailPaneWidth(400, 600)).toBe(300)
    expect(clampDetailPaneWidth(Number.NaN, 1440)).toBe(SIDE_PANE_WIDTH_PX)
  })

  test('writes layout and nav onto the document', () => {
    const vars: Record<string, string> = {}
    const node = {
      dataset: {} as Record<string, string | undefined>,
      style: {
        setProperty: (name: string, value: string) => {
          vars[name] = value
        },
      },
    }
    applyLayoutToDocument(viewportLayoutFor({ width: 673 }), node)
    applyAppNavToDocument('float', node)
    expect(node.dataset.kdLayout).toBe('medium')
    expect(node.dataset.kdSpan).toBe('none')
    expect(node.dataset.kdNav).toBe('float')
    expect(vars['--kd-rail-width']).toBe('0px')
  })

  test('opens a side pane gutter for desktop chrome', () => {
    expect(sidePaneGutterPx(1440)).toBe(400)
    expect(sidePaneGutterPx(800)).toBe(336)
    const vars: Record<string, string> = {}
    const node = {
      dataset: {} as Record<string, string | undefined>,
      style: {
        setProperty: (name: string, value: string) => {
          vars[name] = value
        },
      },
    }
    applySidePaneToDocument(true, node, 360)
    expect(node.dataset.kdPane).toBe('open')
    expect(vars['--kd-pane-gutter']).toBe('360px')
    applySidePaneToDocument(false, node)
    expect(node.dataset.kdPane).toBe('closed')
    expect(vars['--kd-pane-gutter']).toBe('0px')
  })
})
