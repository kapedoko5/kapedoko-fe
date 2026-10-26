import type { ShopRow } from '~/types/shop'
import { auditQueueRows } from '~/utils/amenity-status'
import type { CafeAuditDraft } from '~/utils/audit-form'
import { auditOutletsPayload, auditWifiPayload } from '~/utils/audit-form'
import { cafePickerOptions, type AdminPickerOption } from '~/utils/admin-picker'
import { fetchApprovedPickerRows } from '~/utils/approved-shops'
import { auditedCafeRows, auditQueueCafes, type AuditedCafeListRow, type AuditQueueCafe } from '~/utils/audit-list'

export interface CafeAuditRow {
  id: string
  shop_id: string
  auditor_id: string
  audited_at: string
  timezone: string
  time_of_day_local: string | null
  seating_capacity_estimate: number | null
  long_stay_stance: string
  staff_confirmed_long_stay: boolean
  notes: string | null
  corrects_audit_id: string | null
  accepts_qr: string | null
  accepts_card: string | null
  accepts_cash: string | null
  created_at: string
}

export interface CafeAuditResultRow {
  audit_id: string
  amenity_key: string
  result: string
  wifi_download_mbps: number | null
  wifi_upload_mbps: number | null
  wifi_network_name: string | null
  wifi_password_required: boolean | null
  outlet_approx_count: number | null
  outlet_reliability: string | null
  seating_near_outlet_notes: string | null
  reliability_notes: string | null
  amenity_notes: string | null
}

export interface AmenityQueueRow {
  shop_id: string
  amenity_key: string
  availability: string
  confidence: string
  source_at: string | null
  is_stale: boolean
  needs_recheck: boolean
}

export interface AuditDeskQueueCafe extends AuditQueueCafe {
  name: string
}

export interface AuditDeskCafe extends AuditedCafeListRow {
  name: string
}

function queueLoadError(error: unknown): Error {
  const raw =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : ''
  const message = raw.trim()
  if (/schema cache|does not exist|PGRST205/i.test(message)) {
    return new Error('Could not load the audit queue. Apply the amenity SQL files in db/, then reload the schema.')
  }
  return new Error(message || 'Could not load the audit queue.')
}

export function useCafeAudits() {
  const supabase = useSupabaseClient()

  const loadApprovedOptions = async (): Promise<AdminPickerOption[]> => {
    return cafePickerOptions(await fetchApprovedPickerRows(supabase))
  }

  const submitDraft = async (draft: CafeAuditDraft, idempotencyKey: string) => {
    const { data, error } = await supabase.rpc('submit_cafe_audit', {
      p_shop_id: draft.shopId,
      p_idempotency_key: idempotencyKey,
      p_wifi: auditWifiPayload(draft.wifi),
      p_outlets: auditOutletsPayload(draft.outlets),
      p_long_stay_stance: draft.longStayStance,
      p_staff_confirmed_long_stay: draft.staffConfirmedLongStay,
      p_audited_at: draft.auditedAt,
      p_timezone: draft.timezone,
      p_time_of_day_local: draft.timeOfDayLocal || null,
      p_seating_capacity_estimate: draft.seatingCapacity.trim() ? Number(draft.seatingCapacity) : null,
      p_notes: draft.notes.trim() || null,
      p_corrects_audit_id: draft.correctsAuditId,
      p_accepts_qr: draft.payment.qr,
      p_accepts_card: draft.payment.card,
      p_accepts_cash: draft.payment.cash,
    })
    if (error) throw error
    return data as CafeAuditRow
  }

  const attachPhoto = async (auditId: string, objectKey: string, contentType: string, byteSize: number) => {
    const { error } = await supabase.rpc('attach_cafe_audit_photo', {
      p_audit_id: auditId,
      p_object_key: objectKey,
      p_content_type: contentType,
      p_byte_size: byteSize,
    })
    if (error) throw error
  }

  const voidAudit = async (auditId: string, reason: string) => {
    const { error } = await supabase.rpc('void_cafe_audit', {
      p_audit_id: auditId,
      p_reason: reason,
    })
    if (error) throw error
  }

  const loadHistory = async (shopId: string) => {
    const { data: audits, error: auditError } = await supabase
      .from('cafe_audits')
      .select('*')
      .eq('shop_id', shopId)
      .order('audited_at', { ascending: false })
    if (auditError) throw auditError
    const auditRows = (audits ?? []) as CafeAuditRow[]
    const auditIds = auditRows.map((row) => row.id)
    const [{ data: results, error: resultError }, { data: voids, error: voidError }, { data: reports, error: reportError }] = await Promise.all([
      auditIds.length
        ? supabase.from('cafe_audit_amenity_results').select('*').in('audit_id', auditIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('cafe_audit_voids').select('*').in('audit_id', auditIds.length ? auditIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('cafe_amenity_reports').select('*').eq('shop_id', shopId).order('observed_at', { ascending: false }),
    ])
    if (resultError) throw resultError
    if (voidError) throw voidError
    if (reportError) throw reportError
    return {
      audits: auditRows,
      results: (results ?? []) as CafeAuditResultRow[],
      voids: (voids ?? []) as Array<{ audit_id: string; reason: string; created_at: string }>,
      reports: reports ?? [],
    }
  }

  const loadQueue = async (): Promise<AmenityQueueRow[]> => {
    const { data, error } = await supabase
      .from('shop_amenity_resolutions_public')
      .select('shop_id,amenity_key,availability,confidence,source_at,is_stale,needs_recheck')
    if (error) throw queueLoadError(error)
    return auditQueueRows((data ?? []) as AmenityQueueRow[])
  }

  const loadDesk = async (): Promise<{
    queueCafes: AuditDeskQueueCafe[]
    audited: AuditDeskCafe[]
  }> => {
    const [{ data: resolutionRows, error: queueError }, { data: audits, error: auditError }] = await Promise.all([
      supabase
        .from('shop_amenity_resolutions_public')
        .select('shop_id,amenity_key,availability,confidence,source_at,is_stale,needs_recheck'),
      supabase.from('cafe_audits').select('*').order('audited_at', { ascending: false }),
    ])
    if (queueError) throw queueLoadError(queueError)
    if (auditError) throw queueLoadError(auditError)

    const queue = auditQueueRows((resolutionRows ?? []) as AmenityQueueRow[])
    const auditRows = (audits ?? []) as CafeAuditRow[]
    const auditIds = auditRows.map((row) => row.id)
    const [{ data: results, error: resultError }, { data: voids, error: voidError }] = await Promise.all([
      auditIds.length
        ? supabase.from('cafe_audit_amenity_results').select('*').in('audit_id', auditIds)
        : Promise.resolve({ data: [], error: null }),
      auditIds.length
        ? supabase.from('cafe_audit_voids').select('audit_id').in('audit_id', auditIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (resultError) throw resultError
    if (voidError) throw voidError

    const voidedIds = ((voids ?? []) as Array<{ audit_id: string }>).map((row) => row.audit_id)
    const queueCafes = auditQueueCafes(queue)
    const audited = auditedCafeRows(auditRows, (results ?? []) as CafeAuditResultRow[], voidedIds)
    const ids = [...new Set([...queueCafes.map((row) => row.shopId), ...audited.map((row) => row.shopId)])]
    let names: Record<string, string> = {}
    if (ids.length) {
      const { data } = await supabase.from('shops').select('id,name').in('id', ids)
      names = Object.fromEntries(((data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]))
    }
    return {
      queueCafes: queueCafes.map((row) => ({ ...row, name: names[row.shopId] || row.shopId })),
      audited: audited.map((row) => ({ ...row, name: names[row.shopId] || row.shopId })),
    }
  }

  return { loadApprovedOptions, submitDraft, attachPhoto, voidAudit, loadHistory, loadQueue, loadDesk }
}
