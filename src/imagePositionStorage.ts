import type { SavedImagePosition } from './types'

export const IMAGE_POSITIONS_STORAGE_KEY = 'spanright-image-positions'

export function getImagePositionBookmark(layoutKey: string): SavedImagePosition | null {
  try {
    const raw = localStorage.getItem(IMAGE_POSITIONS_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, SavedImagePosition>) : {}
    return map[layoutKey] ?? null
  } catch {
    return null
  }
}

export function setImagePositionBookmark(layoutKey: string, position: SavedImagePosition): void {
  try {
    const raw = localStorage.getItem(IMAGE_POSITIONS_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, SavedImagePosition>) : {}
    map[layoutKey] = position
    localStorage.setItem(IMAGE_POSITIONS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore
  }
}

export function deleteImagePositionBookmark(layoutKey: string): void {
  try {
    const raw = localStorage.getItem(IMAGE_POSITIONS_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, SavedImagePosition>) : {}
    delete map[layoutKey]
    localStorage.setItem(IMAGE_POSITIONS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore
  }
}

const COMMON_ASPECT_LABELS: [number, string][] = [
  [16 / 9, '16:9'],
  [16 / 10, '16:10'],
  [21 / 9, '21:9'],
  [4 / 3, '4:3'],
  [1, '1:1'],
  [3 / 2, '3:2'],
]

const ASPECT_LABEL_TOLERANCE = 0.03

/** Format aspect ratio for UI (e.g. "16:9", "1:1", or "1.78"). */
export function formatAspectRatioLabel(aspectRatio: number): string {
  for (const [ar, label] of COMMON_ASPECT_LABELS) {
    if (Math.abs(ar - aspectRatio) / Math.max(ar, aspectRatio) < ASPECT_LABEL_TOLERANCE) {
      return label
    }
  }
  return aspectRatio.toFixed(2)
}
