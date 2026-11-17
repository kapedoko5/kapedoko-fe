export type UploadPurpose =
  | 'shop-logo'
  | 'shop-photo'
  | 'shop-poster'
  | 'ad-banner'
  | 'audit-photo'
  | 'event-image'
  | 'badge-icon'
  | 'amenity-proof'

export const UPLOAD_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const UPLOAD_PICK_MAX_BYTES = 20 * 1024 * 1024
export const KEEP_ORIGINAL_RATIO = 0.95

export interface UploadOptimizePreset {
  maxEdge: number
  maxWidth?: number
  maxBytes: number
  quality: number
  keepAlpha: boolean
}

const PHOTO_PRESET: UploadOptimizePreset = {
  maxEdge: 1600,
  maxBytes: 4 * 1024 * 1024,
  quality: 0.9,
  keepAlpha: false,
}

const PRESETS: Record<UploadPurpose, UploadOptimizePreset> = {
  'amenity-proof': PHOTO_PRESET,
  'shop-photo': PHOTO_PRESET,
  'shop-poster': PHOTO_PRESET,
  'audit-photo': PHOTO_PRESET,
  'event-image': PHOTO_PRESET,
  'ad-banner': {
    maxEdge: 1920,
    maxWidth: 1920,
    maxBytes: 4 * 1024 * 1024,
    quality: 0.9,
    keepAlpha: false,
  },
  'shop-logo': {
    maxEdge: 1024,
    maxBytes: 2 * 1024 * 1024,
    quality: 0.92,
    keepAlpha: true,
  },
  'badge-icon': {
    maxEdge: 512,
    maxBytes: 2 * 1024 * 1024,
    quality: 0.92,
    keepAlpha: true,
  },
}

export function uploadOptimizePreset(purpose: UploadPurpose): UploadOptimizePreset {
  return PRESETS[purpose]
}

export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
  maxWidth?: number,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width))
  const safeHeight = Math.max(1, Math.round(height))
  const longest = Math.max(safeWidth, safeHeight)
  const widthCap = maxWidth && maxWidth > 0 ? maxWidth : maxEdge
  let scale = 1
  if (longest > maxEdge) scale = Math.min(scale, maxEdge / longest)
  if (safeWidth > widthCap) scale = Math.min(scale, widthCap / safeWidth)
  if (scale >= 1) return { width: safeWidth, height: safeHeight }
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}

export function shouldKeepOriginal(originalBytes: number, optimizedBytes: number): boolean {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0) return false
  if (!Number.isFinite(optimizedBytes) || optimizedBytes <= 0) return true
  return optimizedBytes >= originalBytes * KEEP_ORIGINAL_RATIO
}

export function encodeMimeFor(
  sourceType: string,
  hasAlpha: boolean,
  keepAlpha: boolean,
): 'image/png' | 'image/webp' | 'image/jpeg' {
  if (keepAlpha && hasAlpha) return 'image/png'
  if (sourceType === 'image/webp') return 'image/webp'
  if (sourceType === 'image/png' && keepAlpha) return 'image/png'
  return 'image/jpeg'
}

export function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function optimizedFileName(originalName: string, mime: string): string {
  const base = originalName.replace(/\.[^.]+$/, '').trim() || 'upload'
  return `${base}.${extensionForMime(mime)}`
}

export function retryOptimizeParams(maxEdge: number, quality: number): { maxEdge: number; quality: number } {
  return {
    maxEdge: Math.max(640, Math.round(maxEdge * 0.75)),
    quality: Math.max(0.72, Math.round((quality - 0.08) * 100) / 100),
  }
}

export function uploadSizeError(purpose: UploadPurpose): string {
  if (purpose === 'shop-logo') return 'Keep the logo under 2 MB.'
  if (purpose === 'badge-icon') return 'Keep the icon under 2 MB.'
  if (purpose === 'shop-poster') return 'Keep the poster under 4 MB.'
  if (purpose === 'ad-banner') return 'Keep the banner under 4 MB.'
  return 'Keep the photo under 4 MB.'
}

function canvasHasAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const sample = Math.min(canvas.width, 48)
  const height = Math.min(canvas.height, 48)
  const data = ctx.getImageData(0, 0, sample, height).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

async function blobFromCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  if (typeof canvas.toBlob !== 'function') {
    try {
      const dataUrl = canvas.toDataURL(mime, quality)
      const res = await fetch(dataUrl)
      return await res.blob()
    } catch {
      return null
    }
  }
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality)
  })
}

function fileFromBlob(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || 'image/jpeg', lastModified: Date.now() })
}

export async function optimizeUploadImage(file: File, purpose: UploadPurpose): Promise<File> {
  const preset = uploadOptimizePreset(purpose)
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  } catch {
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      return file
    }
  }

  try {
    const fitted = fitWithin(bitmap.width, bitmap.height, preset.maxEdge, preset.maxWidth)
    const canvas = document.createElement('canvas')
    canvas.width = fitted.width
    canvas.height = fitted.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, fitted.width, fitted.height)

    const hasAlpha = preset.keepAlpha && (file.type === 'image/png' || file.type === 'image/webp')
      ? canvasHasAlpha(canvas)
      : false
    let mime = encodeMimeFor(file.type, hasAlpha, preset.keepAlpha)
    let quality = preset.quality
    let maxEdge = preset.maxEdge
    let encoded = await blobFromCanvas(canvas, mime, quality)

    if (!encoded && mime !== 'image/jpeg') {
      mime = 'image/jpeg'
      encoded = await blobFromCanvas(canvas, mime, quality)
    }
    if (!encoded) return file

    let next = encoded
    if (next.size > preset.maxBytes) {
      const retry = retryOptimizeParams(maxEdge, quality)
      maxEdge = retry.maxEdge
      quality = retry.quality
      const retryFit = fitWithin(bitmap.width, bitmap.height, maxEdge, preset.maxWidth)
      canvas.width = retryFit.width
      canvas.height = retryFit.height
      ctx.drawImage(bitmap, 0, 0, retryFit.width, retryFit.height)
      const retried = await blobFromCanvas(canvas, mime === 'image/png' ? 'image/jpeg' : mime, quality)
      if (retried && retried.size < next.size) {
        next = retried
        if (mime === 'image/png') mime = 'image/jpeg'
      }
    }

    if (shouldKeepOriginal(file.size, next.size) && file.size <= preset.maxBytes) {
      return file
    }
    if (next.size > preset.maxBytes) {
      return file.size <= preset.maxBytes ? file : fileFromBlob(next, optimizedFileName(file.name, next.type || mime))
    }
    return fileFromBlob(next, optimizedFileName(file.name, next.type || mime))
  } finally {
    bitmap.close?.()
  }
}
