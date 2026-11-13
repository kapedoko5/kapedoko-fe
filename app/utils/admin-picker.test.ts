import { describe, expect, test } from 'bun:test'
import {
  ADMIN_PICKER_PAGE_SIZE,
  advancePickerWindow,
  cafePickerOptions,
  findAdminPickerOption,
  pickerWindowSize,
  searchAdminPickerOptions,
  selectedAdminPickerOptions,
} from './admin-picker'

const shops = [
  { id: 'pending', name: 'Still Reviewing', address: 'Makati', status: 'pending' as const },
  { id: 'tca', name: 'The Coffee Academics', address: 'BGC, Taguig', status: 'approved' as const },
  { id: 'yard', name: 'Yardstick', address: 'Poblacion, Makati', status: 'approved' as const },
  { id: 'yard-bgc', name: 'Yardstick BGC', address: 'BGC, Taguig', status: 'approved' as const },
]

describe('admin search picker', () => {
  test('lists approved cafes by name and keeps address for search', () => {
    expect(cafePickerOptions(shops).map((option) => option.id)).toEqual(['tca', 'yard', 'yard-bgc'])
    expect(cafePickerOptions(shops)[0]).toEqual({
      id: 'tca',
      title: 'The Coffee Academics',
      subtitle: 'BGC, Taguig',
    })
  })

  test('finds a selected option and treats a blank id as empty', () => {
    const options = cafePickerOptions(shops)
    expect(findAdminPickerOption(options, 'yard')?.title).toBe('Yardstick')
    expect(findAdminPickerOption(options, '  ')).toBeNull()
    expect(findAdminPickerOption(options, null)).toBeNull()
    expect(selectedAdminPickerOptions(options, ['yard', 'pending', 'tca']).map((option) => option.id)).toEqual([
      'tca',
      'yard',
    ])
  })

  test('ranks name prefix matches ahead of address hits', () => {
    const options = cafePickerOptions(shops)
    expect(searchAdminPickerOptions(options, 'yard').map((option) => option.id)).toEqual(['yard', 'yard-bgc'])
    expect(searchAdminPickerOptions(options, 'bgc').map((option) => option.id)).toEqual(['yard-bgc', 'tca'])
    expect(searchAdminPickerOptions(options, 'manila')).toEqual([])
    expect(searchAdminPickerOptions(options, '')).toEqual(options)
  })

  test('windows long lists and grows far enough to keep the selected cafe in view', () => {
    const options = Array.from({ length: 120 }, (_, index) => ({
      id: `cafe-${index}`,
      title: `Cafe ${String(index).padStart(3, '0')}`,
    }))
    expect(pickerWindowSize(options, null)).toBe(ADMIN_PICKER_PAGE_SIZE)
    expect(pickerWindowSize(options, 'cafe-90')).toBe(91)
    expect(advancePickerWindow(40, 120)).toBe(80)
    expect(advancePickerWindow(100, 120)).toBe(120)
  })
})
