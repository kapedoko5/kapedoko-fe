import type { ShopRow } from '../types/shop'
import { advanceWindow } from './infinite-list'

export interface AdminPickerOption {
  id: string
  title: string
  subtitle?: string
}

export const ADMIN_PICKER_PAGE_SIZE = 40

export function cafePickerOptions(
  shops: Pick<ShopRow, 'id' | 'name' | 'address' | 'status'>[],
): AdminPickerOption[] {
  return shops
    .filter((shop) => shop.status === 'approved')
    .map((shop) => ({
      id: shop.id,
      title: shop.name,
      subtitle: shop.address,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function findAdminPickerOption(
  options: AdminPickerOption[],
  id: string | null | undefined,
): AdminPickerOption | null {
  const value = id?.trim() ?? ''
  if (!value) return null
  return options.find((option) => option.id === value) ?? null
}

export function selectedAdminPickerOptions(
  options: AdminPickerOption[],
  ids: Iterable<string> | null | undefined,
): AdminPickerOption[] {
  const wanted = new Set([...(ids ?? [])].map((id) => id.trim()).filter(Boolean))
  if (wanted.size === 0) return []
  return options.filter((option) => wanted.has(option.id))
}

export function searchAdminPickerOptions(
  options: AdminPickerOption[],
  query: string,
): AdminPickerOption[] {
  const term = query.trim().toLowerCase()
  if (!term) return options

  return options
    .map((option) => {
      const title = option.title.toLowerCase()
      const subtitle = option.subtitle?.toLowerCase() ?? ''
      let rank = -1
      if (title === term) rank = 0
      else if (title.startsWith(term)) rank = 1
      else if (title.includes(term)) rank = 2
      else if (subtitle.includes(term)) rank = 3
      return { option, rank }
    })
    .filter((row) => row.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.option.title.localeCompare(b.option.title))
    .map((row) => row.option)
}

export function pickerWindowSize(
  options: AdminPickerOption[],
  selectedId: string | null | undefined,
  pageSize = ADMIN_PICKER_PAGE_SIZE,
): number {
  const total = options.length
  if (total === 0) return 0
  const size = Math.max(1, pageSize)
  let shown = Math.min(size, total)
  const selected = findAdminPickerOption(options, selectedId)
  if (!selected) return shown
  const index = options.findIndex((option) => option.id === selected.id)
  if (index >= shown) shown = Math.min(total, index + 1)
  return shown
}

export function advancePickerWindow(
  shown: number,
  total: number,
  pageSize = ADMIN_PICKER_PAGE_SIZE,
): number {
  return advanceWindow(shown, total, pageSize)
}
