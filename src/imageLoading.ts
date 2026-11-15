import { v4 as uuidv4 } from 'uuid'
import type { Monitor, SavedImagePosition, SourceImage } from './types'
import { adaptSavedPositionToAspectRatio, getCoverRect } from './utils'

/** Default physical size of a freshly placed image: its longer side is six feet. */
const DEFAULT_IMAGE_LONG_SIDE_IN = 72

export type ImagePlacementSource = 'layout' | 'bookmark' | 'monitor' | 'replace' | 'default'

export interface ImagePlacement {
  x: number
  y: number
  width: number
  height: number
  source: ImagePlacementSource
}

/** Read an image file into a decoded HTMLImageElement. */
export function readImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Could not decode ${file.name}`))
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Decide where a newly added image goes, in physical inches.
 *
 * - Replacing an existing layer keeps that layer's footprint (adapted to the new aspect ratio).
 * - The first image on the canvas prefers the layout's saved image position, then the bookmark,
 *   then the default size centered on `center`.
 * - Additional images cover `targetMonitor` when given (dropped onto / selected monitor), else
 *   the default size centered on `center`.
 */
export function computeImagePlacement(opts: {
  aspect: number
  isFirstImage: boolean
  center: { x: number; y: number }
  replacing?: SourceImage | null
  targetMonitor?: Monitor | null
  layoutPosition?: SavedImagePosition | null
  bookmarkPosition?: SavedImagePosition | null
}): ImagePlacement {
  const { aspect, isFirstImage, center, replacing, targetMonitor, layoutPosition, bookmarkPosition } = opts

  if (replacing) {
    const prev: SavedImagePosition = {
      x: replacing.physicalX,
      y: replacing.physicalY,
      width: replacing.physicalWidth,
      height: replacing.physicalHeight,
      aspectRatio: replacing.physicalWidth / replacing.physicalHeight,
    }
    return { ...adaptSavedPositionToAspectRatio(prev, aspect), source: 'replace' }
  }
  if (isFirstImage && layoutPosition) {
    return { ...adaptSavedPositionToAspectRatio(layoutPosition, aspect), source: 'layout' }
  }
  if (isFirstImage && bookmarkPosition) {
    return { ...adaptSavedPositionToAspectRatio(bookmarkPosition, aspect), source: 'bookmark' }
  }
  if (!isFirstImage && targetMonitor) {
    const rect = getCoverRect(aspect, {
      x: targetMonitor.physicalX,
      y: targetMonitor.physicalY,
      width: targetMonitor.physicalWidth,
      height: targetMonitor.physicalHeight,
    })
    return { ...rect, source: 'monitor' }
  }
  const width = aspect < 1 ? DEFAULT_IMAGE_LONG_SIDE_IN * aspect : DEFAULT_IMAGE_LONG_SIDE_IN
  const height = aspect < 1 ? DEFAULT_IMAGE_LONG_SIDE_IN : DEFAULT_IMAGE_LONG_SIDE_IN / aspect
  return { x: center.x - width / 2, y: center.y - height / 2, width, height, source: 'default' }
}

/** Build a SourceImage layer from a decoded element and a placement. */
export function createSourceImage(el: HTMLImageElement, fileName: string, placement: ImagePlacement): SourceImage {
  return {
    id: uuidv4(),
    element: el,
    fileName,
    naturalWidth: el.naturalWidth,
    naturalHeight: el.naturalHeight,
    physicalX: placement.x,
    physicalY: placement.y,
    physicalWidth: placement.width,
    physicalHeight: placement.height,
  }
}

/** Topmost monitor whose display area contains the physical point, if any. */
export function monitorAtPoint(monitors: Monitor[], x: number, y: number): Monitor | null {
  for (let i = monitors.length - 1; i >= 0; i--) {
    const m = monitors[i]
    if (x >= m.physicalX && x <= m.physicalX + m.physicalWidth && y >= m.physicalY && y <= m.physicalY + m.physicalHeight) {
      return m
    }
  }
  return null
}

/** Toast text for a just-added image. */
export function placementToastMessage(source: ImagePlacementSource, fileName: string, monitorName?: string): string {
  switch (source) {
    case 'layout': return 'Image positioned from saved layout'
    case 'bookmark': return 'Image positioned from bookmark'
    case 'monitor': return monitorName ? `Image added to fill ${monitorName}` : `Image added: ${fileName}`
    case 'replace': return `Image replaced: ${fileName}`
    default: return `Image loaded: ${fileName}`
  }
}
