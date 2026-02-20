import type { MonitorPreset, Monitor, Bezels, SavedImagePosition } from './types'
import { v4 as uuidv4 } from 'uuid'

const ASPECT_RATIO_TOLERANCE = 0.05

/**
 * Adapt a saved image position to a new aspect ratio.
 * If aspect ratios match within tolerance, returns saved position; otherwise
 * matches one dimension and centers on the other.
 */
export function adaptSavedPositionToAspectRatio(
  saved: SavedImagePosition,
  newAspectRatio: number
): { x: number; y: number; width: number; height: number } {
  const savedAR = saved.aspectRatio
  if (Math.abs(savedAR - newAspectRatio) < ASPECT_RATIO_TOLERANCE) {
    return { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
  }
  if (newAspectRatio > savedAR) {
    const newWidth = saved.width
    const newHeight = newWidth / newAspectRatio
    return {
      x: saved.x,
      y: saved.y + (saved.height - newHeight) / 2,
      width: newWidth,
      height: newHeight,
    }
  }
  const newHeight = saved.height
  const newWidth = newHeight * newAspectRatio
  return {
    x: saved.x + (saved.width - newWidth) / 2,
    y: saved.y,
    width: newWidth,
    height: newHeight,
  }
}

/**
 * Calculate PPI from resolution and diagonal size.
 * PPI = sqrt(resX² + resY²) / diagonal
 */
export function calculatePPI(resX: number, resY: number, diagonal: number): number {
  return Math.sqrt(resX * resX + resY * resY) / diagonal
}

/**
 * Calculate physical dimensions from resolution and PPI.
 */
export function calculatePhysicalDimensions(resX: number, resY: number, ppi: number): { width: number; height: number } {
  return {
    width: resX / ppi,
    height: resY / ppi,
  }
}

/**
 * Create a Monitor from a preset and position.
 * rotation 90 = portrait (dimensions swapped).
 */
export function createMonitor(
  preset: MonitorPreset,
  physicalX: number,
  physicalY: number,
  rotation: 0 | 90 = 0,
  displayName?: string,
  bezels?: Bezels,
): Monitor {
  const ppi = calculatePPI(preset.resolutionX, preset.resolutionY, preset.diagonal)
  let { width, height } = calculatePhysicalDimensions(preset.resolutionX, preset.resolutionY, ppi)
  if (rotation === 90) {
    ;[width, height] = [height, width]
  }
  return {
    id: uuidv4(),
    preset,
    displayName,
    physicalX,
    physicalY,
    physicalWidth: width,
    physicalHeight: height,
    ppi,
    rotation,
    bezels,
  }
}

/** Display name for a monitor (custom name or preset name). */
export function getMonitorDisplayName(monitor: Monitor): string {
  return (monitor.displayName?.trim() || '') || monitor.preset.name
}

/**
 * Calculate the bounding box of all monitors in physical space.
 */
export function getMonitorsBoundingBox(monitors: Monitor[]): {
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number
} {
  if (monitors.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const m of monitors) {
    minX = Math.min(minX, m.physicalX)
    minY = Math.min(minY, m.physicalY)
    maxX = Math.max(maxX, m.physicalX + m.physicalWidth)
    maxY = Math.max(maxY, m.physicalY + m.physicalHeight)
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Calculate recommended minimum image dimensions based on monitor layout.
 */
export function getRecommendedImageSize(monitors: Monitor[]): { width: number; height: number } {
  if (monitors.length === 0) return { width: 0, height: 0 }

  const bbox = getMonitorsBoundingBox(monitors)
  const maxPPI = Math.max(...monitors.map(m => m.ppi))

  return {
    width: Math.ceil(bbox.width * maxPPI),
    height: Math.ceil(bbox.height * maxPPI),
  }
}

const MM_PER_INCH = 25.4

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH
}

/** Returns per-edge bezel thickness in inches (all zero when no bezels set). */
export function getBezelInches(monitor: Monitor): { top: number; bottom: number; left: number; right: number } {
  const b = monitor.bezels
  if (!b) return { top: 0, bottom: 0, left: 0, right: 0 }
  return {
    top: mmToInches(b.top),
    bottom: mmToInches(b.bottom),
    left: mmToInches(b.left),
    right: mmToInches(b.right),
  }
}

/**
 * Inches to centimeters conversion.
 */
export function inchesToCm(inches: number): number {
  return inches * 2.54
}

/**
 * Format a dimension with the appropriate unit.
 */
export function formatDimension(inches: number, unit: 'inches' | 'cm'): string {
  if (unit === 'cm') {
    return `${inchesToCm(inches).toFixed(1)} cm`
  }
  return `${inches.toFixed(1)}"`
}
