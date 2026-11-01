import type { SavedConfig } from './types'

/** Validation limits for layouts coming from outside the app (imported JSON, shared links). */
export const LAYOUT_MIN_DIAGONAL = 5
export const LAYOUT_MAX_DIAGONAL = 120
export const LAYOUT_MAX_ASPECT_RATIO = 10

export type LayoutMonitorEntry = SavedConfig['monitors'][number]

/**
 * Validate and normalize one monitor entry ({ preset, physicalX, physicalY, rotation?, displayName?, bezels? }).
 * `label` prefixes error messages (e.g. `Layout "Desk", monitor 2`).
 */
export function validateLayoutMonitor(
  raw: unknown,
  label: string,
  fallbackName: string,
): { valid: true; monitor: LayoutMonitorEntry } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: `${label}: invalid entry.` }
  }
  const mon = raw as Record<string, unknown>
  const preset = mon.preset as Record<string, unknown> | undefined
  if (!preset || typeof preset !== 'object') {
    return { valid: false, error: `${label}: preset is required.` }
  }
  const diagonal = Number(preset.diagonal)
  const ar = preset.aspectRatio
  const resX = Number(preset.resolutionX)
  const resY = Number(preset.resolutionY)
  if (!Number.isFinite(diagonal) || diagonal < LAYOUT_MIN_DIAGONAL || diagonal > LAYOUT_MAX_DIAGONAL) {
    return { valid: false, error: `${label}: diagonal must be ${LAYOUT_MIN_DIAGONAL}–${LAYOUT_MAX_DIAGONAL}".` }
  }
  if (!Array.isArray(ar) || ar.length !== 2 || !Number.isFinite(ar[0]) || !Number.isFinite(ar[1]) || (ar[0] as number) <= 0 || (ar[1] as number) <= 0) {
    return { valid: false, error: `${label}: aspectRatio must be [number, number].` }
  }
  const ratio = Math.max((ar[0] as number) / (ar[1] as number), (ar[1] as number) / (ar[0] as number))
  if (ratio > LAYOUT_MAX_ASPECT_RATIO) {
    return { valid: false, error: `${label}: aspect ratio cannot exceed ${LAYOUT_MAX_ASPECT_RATIO}:1.` }
  }
  if (!Number.isFinite(resX) || !Number.isFinite(resY) || resX < 1 || resY < 1) {
    return { valid: false, error: `${label}: resolution must be positive numbers.` }
  }
  const physicalX = Number(mon.physicalX)
  const physicalY = Number(mon.physicalY)
  if (mon.physicalX == null || mon.physicalY == null || !Number.isFinite(physicalX) || !Number.isFinite(physicalY)) {
    return { valid: false, error: `${label}: physicalX and physicalY are required.` }
  }
  let bezels: LayoutMonitorEntry['bezels']
  if (mon.bezels != null && typeof mon.bezels === 'object') {
    const b = mon.bezels as Record<string, unknown>
    const t = Number(b.top), bot = Number(b.bottom), l = Number(b.left), r = Number(b.right)
    if ([t, bot, l, r].every(v => Number.isFinite(v) && v >= 0)) {
      bezels = { top: t, bottom: bot, left: l, right: r }
    }
  }
  return {
    valid: true,
    monitor: {
      preset: {
        name: typeof preset.name === 'string' ? preset.name : fallbackName,
        diagonal,
        aspectRatio: [ar[0] as number, ar[1] as number],
        resolutionX: resX,
        resolutionY: resY,
      },
      physicalX,
      physicalY,
      rotation: mon.rotation === 90 ? 90 : 0,
      displayName: typeof mon.displayName === 'string' ? mon.displayName : undefined,
      bezels,
    },
  }
}
