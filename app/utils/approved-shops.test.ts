import { describe, expect, test } from 'bun:test'
import type { ShopRow } from '../types/shop'
import type { ShopAmenityResolutionRow } from './amenity-status'
import type { ShopPaymentRow } from './cafe-payment'
import {
  chunkIds,
  fetchAdminShopRows,
  fetchAmenityRowsForShopIds,
  fetchApprovedCafePage,
  fetchApprovedCafes,
  fetchApprovedPickerRows,
  fetchPages,
  groupAmenityRows,
  POSTGREST_PAGE_SIZE,
  SHOP_ID_CHUNK,
  SHOP_ID_GET_CHUNK,
  SIDECAR_RPC,
  sidecarsFromPayload,
} from './approved-shops'

describe('approved shop catalog fetch', () => {
  test('splits shop ids into POST-sized rpc batches', () => {
    const ids = Array.from({ length: 170 }, (_, index) => String(index))
    const chunks = chunkIds(ids)
    expect(chunks).toHaveLength(Math.ceil(170 / SHOP_ID_CHUNK))
    expect(chunks[0]).toHaveLength(SHOP_ID_CHUNK)
    expect(chunks.at(-1)).toHaveLength(170 % SHOP_ID_CHUNK || SHOP_ID_CHUNK)
  })

  test('pages until a short PostgREST window', async () => {
    const starts: number[] = []
    const rows = await fetchPages(async (from) => {
      starts.push(from)
      if (from === 0) return { data: Array.from({ length: POSTGREST_PAGE_SIZE }, (_, index) => index), error: null }
      return { data: [POSTGREST_PAGE_SIZE], error: null }
    })
    expect(starts).toEqual([0, POSTGREST_PAGE_SIZE])
    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE + 1)
  })

  test('loads every approved picker cafe past the PostgREST 1000-row cap', async () => {
    const shops = Array.from({ length: 1498 }, (_, index) => shopRow(index + 1))
    const starts: number[] = []
    const rows = await fetchApprovedPickerRows({
      from() {
        return {
          select() { return this },
          eq() { return this },
          order() { return this },
          range(from: number, to: number) {
            starts.push(from)
            return Promise.resolve({ data: shops.slice(from, to + 1), error: null })
          },
        }
      },
    })
    expect(starts).toEqual([0, POSTGREST_PAGE_SIZE])
    expect(rows).toHaveLength(1498)
    expect(rows.at(-1)?.name).toBe('Cafe 1498')
  })

  test('loads every admin shop past the PostgREST 1000-row cap', async () => {
    const shops = Array.from({ length: 1498 }, (_, index) => shopRow(index + 1))
    const starts: number[] = []
    const rows = await fetchAdminShopRows({
      from() {
        return {
          select() { return this },
          order() { return this },
          range(from: number, to: number) {
            starts.push(from)
            return Promise.resolve({ data: shops.slice(from, to + 1), error: null })
          },
        }
      },
    })
    expect(starts).toEqual([0, POSTGREST_PAGE_SIZE])
    expect(rows).toHaveLength(1498)
  })

  test('groups amenity rows onto the cafe they belong to', () => {
    const grouped = groupAmenityRows([
      amenityRow(shopId(1), 'wifi', 'available'),
      amenityRow(shopId(1), 'outlets', 'unavailable'),
      amenityRow(shopId(2), 'wifi', 'unknown'),
    ])
    expect(grouped.get(shopId(1))?.map((row) => row.amenity_key)).toEqual(['wifi', 'outlets'])
    expect(grouped.get(shopId(2))).toHaveLength(1)
  })

  test('rpc payload keeps team-verified wifi and outlets', () => {
    const sidecars = sidecarsFromPayload({
      amenities: [
        amenityRow(shopId(89), 'wifi', 'available'),
        amenityRow(shopId(89), 'outlets', 'available'),
      ],
      payments: [paymentRow(shopId(89))],
    })
    expect(sidecars.amenityById.get(shopId(89))).toEqual([
      expect.objectContaining({ availability: 'available', confidence: 'team_verified' }),
      expect.objectContaining({ availability: 'available', confidence: 'team_verified' }),
    ])
    expect(sidecars.paymentById.get(shopId(89))).toMatchObject({
      qr: 'available',
      card: 'available',
      cash: 'available',
    })
  })

  test('large catalog uses the rpc, not one giant in() filter', async () => {
    const shops = Array.from({ length: 90 }, (_, index) => shopRow(index))
    const rpcChunks: number[] = []
    const sidecarInChunks: number[] = []
    const cafes = await fetchApprovedCafes(mockCatalog(shops, { rpcChunks, sidecarInChunks }), '')
    const audited = cafes.find((cafe) => cafe.id === shopId(89))

    expect(rpcChunks).toEqual([SHOP_ID_CHUNK, 10])
    expect(sidecarInChunks).toEqual([])
    expect(audited?.work.wifiStatus).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
    })
    expect(audited?.work.outletsStatus).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
    })
    expect(audited?.payment).toMatchObject({ qr: 'available', card: 'available', cash: 'available' })
  })

  test('falls back to GET in() of 8 when the rpc is missing', async () => {
    const shops = Array.from({ length: 90 }, (_, index) => shopRow(index))
    const sidecarInChunks: number[] = []
    const rows = await fetchAmenityRowsForShopIds(
      mockCatalog(shops, { sidecarInChunks, rpcError: true }),
      shops.map((shop) => shop.id),
    )
    expect(sidecarInChunks.length).toBeGreaterThan(0)
    expect(sidecarInChunks.every((size) => size <= SHOP_ID_GET_CHUNK)).toBe(true)
    expect(sidecarInChunks).toContain(SHOP_ID_GET_CHUNK)
    expect(sidecarInChunks).toContain(90 % SHOP_ID_GET_CHUNK)
    expect(rows.find((row) => row.shop_id === shopId(89) && row.amenity_key === 'wifi')).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
    })
  })

  test('retries a rejected in() down to one id', async () => {
    const shops = Array.from({ length: 16 }, (_, index) => shopRow(index)).concat(shopRow(89))
    const sidecarInChunks: number[] = []
    const rows = await fetchAmenityRowsForShopIds(
      mockCatalog(shops, { sidecarInChunks, rpcError: true, inErrorOver: 1 }),
      shops.map((shop) => shop.id),
    )
    expect(sidecarInChunks.some((size) => size > 1)).toBe(true)
    expect(sidecarInChunks).toContain(1)
    expect(rows.find((row) => row.shop_id === shopId(89) && row.amenity_key === 'wifi')).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
    })
  })

  test('keeps the catalog and review-stat fallback when amenities never load', async () => {
    const shops = Array.from({ length: 90 }, (_, index) => shopRow(index))
    const cafes = await fetchApprovedCafes(
      mockCatalog(shops, { rpcError: true, amenityError: true }),
      '',
    )
    expect(cafes).toHaveLength(shops.length)
    expect(cafes.find((cafe) => cafe.id === shopId(89))?.work.wifiStatus).toMatchObject({
      availability: 'unknown',
      confidence: 'unknown',
    })
  })

  test('a feed page loads sidecars for that page only', async () => {
    const shops = Array.from({ length: 30 }, (_, index) => shopRow(index))
    const rpcChunks: number[] = []
    const first = await fetchApprovedCafePage(mockCatalog(shops, { rpcChunks }), '', { limit: 12 })
    expect(first.cafes).toHaveLength(12)
    expect(first.cafes[0]?.name).toBe('Cafe 000')
    expect(first.hasMore).toBe(true)
    expect(rpcChunks).toEqual([12])

    const secondChunks: number[] = []
    const second = await fetchApprovedCafePage(mockCatalog(shops, { rpcChunks: secondChunks }), '', {
      offset: 12,
      limit: 12,
    })
    expect(second.cafes[0]?.name).toBe('Cafe 012')
    expect(second.hasMore).toBe(true)
    expect(secondChunks).toEqual([12])

    const last = await fetchApprovedCafePage(mockCatalog(shops, { rpcChunks: [] }), '', {
      offset: 24,
      limit: 12,
    })
    expect(last.cafes).toHaveLength(6)
    expect(last.hasMore).toBe(false)
  })

  test('home catalog attaches markings on the first fetch', async () => {
    const shops = [shopRow(89), ...Array.from({ length: 11 }, (_, index) => shopRow(index))]
    const rpcChunks: number[] = []
    const cafes = await fetchApprovedCafes(mockCatalog(shops, { rpcChunks }), '')
    expect(rpcChunks[0]).toBe(shops.length)
    expect(cafes[0]?.work.wifiStatus).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
    })
    expect(cafes[0]?.work.outletsStatus).toMatchObject({
      availability: 'available',
      confidence: 'team_verified',
    })
    expect(cafes[0]?.payment).toMatchObject({ qr: 'available' })
  })
})

function shopId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function shopRow(n: number): ShopRow {
  return {
    id: shopId(n),
    name: `Cafe ${String(n).padStart(3, '0')}`,
    description: null,
    address: 'Marikina',
    latitude: 14.65,
    longitude: 121.1,
    categories: [],
    hours: null,
    cover_photo_url: null,
    logo_object_key: null,
    contact_number: null,
    status: 'approved',
    submitted_by: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
  }
}

function amenityRow(
  id: string,
  amenityKey: 'wifi' | 'outlets' | 'long_stay_wifi',
  availability: 'available' | 'unavailable' | 'unknown',
): ShopAmenityResolutionRow {
  const verified = availability !== 'unknown'
  return {
    shop_id: id,
    amenity_key: amenityKey,
    availability,
    confidence: verified ? 'team_verified' : 'unknown',
    source_at: verified ? '2026-10-02T00:00:00.000Z' : null,
    decided_count: 0,
    yes_count: 0,
    no_count: 0,
    is_stale: false,
    needs_recheck: false,
    wifi_speed: null,
    wifi_time_limit: null,
    outlet_reliability: null,
  }
}

function paymentRow(id: string): ShopPaymentRow {
  return {
    shop_id: id,
    accepts_qr: 'available',
    accepts_card: 'available',
    accepts_cash: 'available',
    source_at: '2026-10-02T00:00:00.000Z',
  }
}

function mockCatalog(
  shops: ShopRow[],
  options: {
    rpcChunks?: number[]
    sidecarInChunks?: number[]
    rpcError?: boolean
    amenityError?: boolean
    inErrorOver?: number
  } = {},
) {
  const amenityRows = shops.flatMap((shop) => {
    const availability = shop.id === shopId(89) ? 'available' : 'unknown'
    return [
      amenityRow(shop.id, 'wifi', availability),
      amenityRow(shop.id, 'outlets', availability),
      amenityRow(shop.id, 'long_stay_wifi', 'unknown'),
    ]
  })
  const paymentRows = shops
    .filter((shop) => shop.id === shopId(89))
    .map((shop) => paymentRow(shop.id))

  return {
    async rpc(fn: string, args: { p_shop_ids?: string[] }) {
      if (fn !== SIDECAR_RPC || options.rpcError) {
        return { data: null, error: { message: 'rpc missing' } }
      }
      const ids = args.p_shop_ids ?? []
      options.rpcChunks?.push(ids.length)
      return {
        data: {
          amenities: amenityRows.filter((row) => ids.includes(row.shop_id)),
          payments: paymentRows.filter((row) => ids.includes(row.shop_id)),
          stats: [],
          tiers: [],
        },
        error: null,
      }
    },
    from(table: string) {
      const query = {
        ids: [] as string[],
        from: 0,
        to: POSTGREST_PAGE_SIZE - 1,
        limit: null as number | null,
      }
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      Object.assign(builder, {
        select: chain,
        eq: (column: string, value: string) => {
          if (column === 'shop_id' || column === 'id') query.ids = [value]
          return builder
        },
        gte: chain,
        lte: chain,
        or: chain,
        order: chain,
        in: (_column: string, ids: string[]) => {
          query.ids = ids
          if (table !== 'shops') options.sidecarInChunks?.push(ids.length)
          return builder
        },
        limit: (value: number) => {
          query.limit = value
          return builder
        },
        range: (from: number, to: number) => {
          query.from = from
          query.to = to
          return builder
        },
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown, reject: (reason: unknown) => unknown) => {
          const amenityDown = options.amenityError && table === 'shop_amenity_resolutions_public'
          const tooManyIds = table !== 'shops'
            && options.inErrorOver != null
            && query.ids.length > options.inErrorOver
          if (amenityDown || tooManyIds) {
            return Promise.resolve({ data: null, error: { message: 'request failed' } }).then(resolve, reject)
          }
          return Promise.resolve(loadTable(table, shops, amenityRows, paymentRows, query)).then(resolve, reject)
        },
      })
      return builder
    },
  }
}

function loadTable(
  table: string,
  shops: ShopRow[],
  amenityRows: ShopAmenityResolutionRow[],
  paymentRows: ShopPaymentRow[],
  query: { ids: string[]; from: number; to: number; limit: number | null },
): { data: unknown; error: unknown } {
  if (table === 'shops') {
    const rows = query.ids.length ? shops.filter((shop) => query.ids.includes(shop.id)) : shops
    if (query.limit != null) return { data: rows.slice(0, query.limit), error: null }
    return { data: rows.slice(query.from, query.to + 1), error: null }
  }
  if (table === 'shop_amenity_resolutions_public') {
    const rows = query.ids.length
      ? amenityRows.filter((row) => query.ids.includes(row.shop_id))
      : amenityRows
    return { data: rows.slice(query.from, query.to + 1), error: null }
  }
  if (table === 'shop_payment_public') {
    const rows = query.ids.length
      ? paymentRows.filter((row) => query.ids.includes(row.shop_id))
      : paymentRows
    return { data: rows.slice(query.from, query.to + 1), error: null }
  }
  return { data: [], error: null }
}
