import { describe, expect, test } from 'bun:test'
import {
  adminNameReviewCopy,
  nameReviewAcceptTitle,
  ownerNameReviewCopy,
  shopEditorName,
  shopPendingName,
} from './shop-name-review'

describe('shop name review', () => {
  test('uses the pending name in the owner editor', () => {
    expect(shopPendingName({ pending_name: '  Harbor Roast  ' })).toBe('Harbor Roast')
    expect(shopPendingName({ pending_name: '   ' })).toBeNull()
    expect(shopEditorName({ name: 'Harbor', pending_name: 'Harbor Roast' })).toBe('Harbor Roast')
    expect(shopEditorName({ name: 'Harbor', pending_name: null })).toBe('Harbor')
  })

  test('explains a waiting name on owner and admin desks', () => {
    const shop = { name: 'Harbor', pending_name: 'Harbor Roast' }
    expect(ownerNameReviewCopy(shop)).toMatch(/waiting on review/)
    expect(ownerNameReviewCopy(shop)).toMatch(/Harbor Roast/)
    expect(adminNameReviewCopy(shop)).toMatch(/Harbor Roast/)
    expect(ownerNameReviewCopy({ name: 'Harbor', pending_name: null })).toBeNull()
    expect(nameReviewAcceptTitle('Harbor', 'Harbor Roast')).toMatch(/Harbor Roast/)
  })
})
