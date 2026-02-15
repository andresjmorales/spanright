import type { MonitorPreset, Monitor } from './types'
import { v4 as uuidv4 } from 'uuid'

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
 */
export function createMonitor(preset: MonitorPreset, physicalX: number, physicalY: number): Monitor {
  const ppi = calculatePPI(preset.resolutionX, preset.resolutionY, preset.diagonal)
  const { width, height } = calculatePhysicalDimensions(preset.resolutionX, preset.resolutionY, ppi)

  return {
    id: uuidv4(),
    preset,
    physicalX,
    physicalY,
    physicalWidth: width,
    physicalHeight: height,
    ppi,
  }
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
