import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_CAFE_PRICE_MARKS,
  cafePriceMarksError,
  cafePriceMarksPreview,
  cafePricePesoMarks,
  cafePriceTier,
  cafePriceTierLabel,
  missingCafePriceMarksSqlCopy,
  parseCafePriceMarks,
  shouldStampBudgetFriendly,
} from './cafe-price-marks'

describe('cafe price marks', () => {
  test('defaults to Philippine cup-price tiers', () => {
    expect(DEFAULT_CAFE_PRICE_MARKS).toEqual({ budgetMaxPhp: 99, midMaxPhp: 184 })
    expect(cafePriceTier(95)).toBe('budget')
    expect(cafePriceTier(100)).toBe('mid')
    expect(cafePriceTier(184)).toBe('mid')
    expect(cafePriceTier(185)).toBe('specialty')
    expect(cafePricePesoMarks(65)).toBe('₱')
    expect(cafePricePesoMarks(150)).toBe('₱₱')
    expect(cafePricePesoMarks(250)).toBe('₱₱₱')
    expect(cafePricePesoMarks(null)).toBe('')
    expect(cafePriceTierLabel(95)).toMatch(/₱1 to ₱99/)
    expect(cafePriceTierLabel(150)).toMatch(/₱100 to ₱184/)
    expect(cafePriceTierLabel(200)).toMatch(/₱185 and up/)
    expect(shouldStampBudgetFriendly(99)).toBe(true)
    expect(shouldStampBudgetFriendly(100)).toBe(false)
  })

  test('follows admin-set cutoffs', () => {
    const marks = { budgetMaxPhp: 150, midMaxPhp: 250 }
    expect(cafePricePesoMarks(150, marks)).toBe('₱')
    expect(cafePricePesoMarks(151, marks)).toBe('₱₱')
    expect(cafePricePesoMarks(251, marks)).toBe('₱₱₱')
    expect(shouldStampBudgetFriendly(150, marks)).toBe(true)
    expect(shouldStampBudgetFriendly(151, marks)).toBe(false)
    expect(cafePriceMarksPreview(marks)).toEqual({
      budget: '₱1–₱150',
      mid: '₱151–₱250',
      specialty: '₱251+',
    })
  })

  test('rejects inverted or empty cutoffs', () => {
    expect(cafePriceMarksError({ budgetMaxPhp: 99, midMaxPhp: 184 })).toBeNull()
    expect(cafePriceMarksError({ budgetMaxPhp: 184, midMaxPhp: 99 })).toMatch(/sit above/)
    expect(cafePriceMarksError({ budgetMaxPhp: 0, midMaxPhp: 184 })).toMatch(/₱ has to be/)
    expect(parseCafePriceMarks({ budget_max_php: 120, mid_max_php: 200 })).toEqual({
      budgetMaxPhp: 120,
      midMaxPhp: 200,
    })
    expect(parseCafePriceMarks({ budget_max_php: 200, mid_max_php: 100 })).toEqual(DEFAULT_CAFE_PRICE_MARKS)
    expect(missingCafePriceMarksSqlCopy('Could not find the function public.update_cafe_price_marks')).toMatch(/20261126/)
    expect(missingCafePriceMarksSqlCopy('relation cafe_price_marks does not exist')).toMatch(/20261126/)
    expect(missingCafePriceMarksSqlCopy('schema cache')).toBeNull()
  })
})
