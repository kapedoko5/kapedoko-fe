export const MENU_PRICE_PHP_MAX = 99999

export const DEFAULT_CAFE_PRICE_MARKS = {
  budgetMaxPhp: 99,
  midMaxPhp: 184,
} as const

export type CafePriceMarks = {
  budgetMaxPhp: number
  midMaxPhp: number
}

export type CafePriceTier = 'budget' | 'mid' | 'specialty'

export function parseCafePriceMarks(row: unknown): CafePriceMarks {
  const rec = row && typeof row === 'object' ? row as Record<string, unknown> : {}
  const budget = Number(rec.budget_max_php ?? rec.budgetMaxPhp)
  const mid = Number(rec.mid_max_php ?? rec.midMaxPhp)
  if (!Number.isInteger(budget) || !Number.isInteger(mid) || cafePriceMarksError({ budgetMaxPhp: budget, midMaxPhp: mid })) {
    return { ...DEFAULT_CAFE_PRICE_MARKS }
  }
  return { budgetMaxPhp: budget, midMaxPhp: mid }
}

export function cafePriceMarksError(input: CafePriceMarks): string | null {
  if (!Number.isInteger(input.budgetMaxPhp) || input.budgetMaxPhp < 1 || input.budgetMaxPhp > 99998) {
    return '₱ has to be a peso amount from 1 to 99,998.'
  }
  if (!Number.isInteger(input.midMaxPhp) || input.midMaxPhp < 2 || input.midMaxPhp > MENU_PRICE_PHP_MAX) {
    return '₱₱ has to be a peso amount from 2 to 99,999.'
  }
  if (input.budgetMaxPhp >= input.midMaxPhp) {
    return '₱₱ has to sit above ₱.'
  }
  return null
}

export function cafePriceTier(
  php: number | null | undefined,
  marks: CafePriceMarks = DEFAULT_CAFE_PRICE_MARKS,
): CafePriceTier | null {
  if (php == null || !Number.isFinite(php) || php < 1) return null
  if (php <= marks.budgetMaxPhp) return 'budget'
  if (php <= marks.midMaxPhp) return 'mid'
  return 'specialty'
}

export function cafePricePesoMarks(
  php: number | null | undefined,
  marks: CafePriceMarks = DEFAULT_CAFE_PRICE_MARKS,
): string {
  const tier = cafePriceTier(php, marks)
  if (tier === 'budget') return '₱'
  if (tier === 'mid') return '₱₱'
  if (tier === 'specialty') return '₱₱₱'
  return ''
}

export function cafePriceTierLabel(
  php: number | null | undefined,
  marks: CafePriceMarks = DEFAULT_CAFE_PRICE_MARKS,
): string | null {
  const tier = cafePriceTier(php, marks)
  if (tier === 'budget') return `Budget range, ₱1 to ₱${marks.budgetMaxPhp}`
  if (tier === 'mid') return `Typical range, ₱${marks.budgetMaxPhp + 1} to ₱${marks.midMaxPhp}`
  if (tier === 'specialty') return `Specialty range, ₱${marks.midMaxPhp + 1} and up`
  return null
}

export function cafePriceMarksPreview(marks: CafePriceMarks): {
  budget: string
  mid: string
  specialty: string
} {
  return {
    budget: `₱1–₱${marks.budgetMaxPhp}`,
    mid: `₱${marks.budgetMaxPhp + 1}–₱${marks.midMaxPhp}`,
    specialty: `₱${marks.midMaxPhp + 1}+`,
  }
}

export function shouldStampBudgetFriendly(
  php: number | null | undefined,
  marks: CafePriceMarks = DEFAULT_CAFE_PRICE_MARKS,
): boolean {
  return php != null && Number.isFinite(php) && php >= 1 && php <= marks.budgetMaxPhp
}

export function missingCafePriceMarksSqlCopy(message: string): string | null {
  if (!/cafe_price_marks|update_cafe_price_marks|p_budget_max_php|p_mid_max_php/i.test(message)) {
    return null
  }
  return 'Apply db/20261126_cafe_price_marks.sql in the SQL editor, then try again.'
}
