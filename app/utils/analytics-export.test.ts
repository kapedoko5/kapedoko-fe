import { describe, expect, test } from 'bun:test'
import { analyticsCsvFilename, buildCsv, csvEscape, dailyRowsToCsv } from './analytics-export'

describe('csv escaping', () => {
  test('quotes commas, quotes and newlines', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('Cafe, Bean')).toBe('"Cafe, Bean"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('a\nb')).toBe('"a\nb"')
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(12)).toBe('12')
    expect(csvEscape(Number.NaN)).toBe('')
  })

  test('defuses spreadsheet formulas', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvEscape('@cmd')).toBe("'@cmd")
    expect(csvEscape('-1+1')).toBe("'-1+1")
    expect(csvEscape('=1,2')).toBe('"\'=1,2"')
  })

  test('builds CRLF rows', () => {
    expect(buildCsv(['A', 'B'], [['x', 1], ['y,z', null]])).toBe('A,B\r\nx,1\r\n"y,z",\r\n')
  })

  test('exports daily rows with names and labels', () => {
    const csv = dailyRowsToCsv(
      [
        { shop_id: 'b', kind: 'detail_view', surface: 'map', day: '2026-11-02', hits: 3 },
        { shop_id: 'a', kind: 'card_click', surface: 'home', day: '2026-11-01', hits: 2 },
      ],
      [{ id: 'a', name: 'Alpha, "A"' }],
    )
    expect(csv).toBe(
      'Day,Cafe,Where,What,Count\r\n'
      + '2026-11-01,"Alpha, ""A""",Home,Card click,2\r\n'
      + '2026-11-02,Unknown cafe,Map,Cafe page,3\r\n',
    )
  })

  test('makes a safe filename', () => {
    expect(analyticsCsvFilename('Cy Cafe / Main!', 30, '2026-11-27')).toBe('kapedoko-analytics-cy-cafe-main-30d-2026-11-27.csv')
    expect(analyticsCsvFilename('', 7, '2026-11-27')).toBe('kapedoko-analytics-cafes-7d-2026-11-27.csv')
  })
})
