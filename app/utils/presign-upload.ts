import {
  optimizeUploadImage,
  uploadOptimizePreset,
  uploadSizeError,
  type UploadPurpose,
} from './optimize-upload-image'

export type { UploadPurpose }

export async function uploadPresignedImage(file: File, purpose: UploadPurpose): Promise<string> {
  const supabase = useSupabaseClient()
  const optimized = await optimizeUploadImage(file, purpose)
  const maxBytes = uploadOptimizePreset(purpose).maxBytes
  if (optimized.size > maxBytes) {
    throw new Error(uploadSizeError(purpose))
  }

  const form = new FormData()
  form.append('file', optimized)
  form.append('purpose', purpose)
  const { data, error } = await supabase.functions.invoke('presign-upload', { body: form })
  const payload = (data ?? null) as { objectKey?: string; error?: string } | null
  if (error || !payload?.objectKey) {
    throw new Error(payload?.error || 'Could not upload that file. Try again.')
  }
  return payload.objectKey
}
