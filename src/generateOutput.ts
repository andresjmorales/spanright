import type { Monitor, SourceImage, WindowsMonitorPosition } from './types'

/** Build a canvas with the image drawn at the given rotation (degrees CW). */
function rotatedImageCanvas(sourceImage: SourceImage): HTMLCanvasElement {
  const img = sourceImage.element
  const nW = sourceImage.naturalWidth
  const nH = sourceImage.naturalHeight
  const rot = sourceImage.rotation ?? 0
  if (rot === 0) {
    const c = document.createElement('canvas')
    c.width = nW
    c.height = nH
    c.getContext('2d')!.drawImage(img, 0, 0)
    return c
  }
  const [width, height] = (rot === 90 || rot === 270) ? [nH, nW] : [nW, nH]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.save()
  if (rot === 90) {
    ctx.translate(nH, 0)
    ctx.rotate(90 * Math.PI / 180)
  } else if (rot === 180) {
    ctx.translate(nW, nH)
    ctx.rotate(180 * Math.PI / 180)
  } else {
    ctx.translate(0, nW)
    ctx.rotate(-90 * Math.PI / 180)
  }
  ctx.drawImage(img, 0, 0)
  ctx.restore()
  return canvas
}

/** Get source rect (in the possibly rotated image) for the physical intersection. */
function getSourceRect(
  sourceImage: SourceImage,
  imgLeft: number, imgTop: number, imgW: number, imgH: number,
  intLeft: number, intTop: number, intRight: number, intBottom: number
): { srcX: number; srcY: number; srcW: number; srcH: number } {
  const nW = sourceImage.naturalWidth
  const nH = sourceImage.naturalHeight
  const u1 = (intLeft - imgLeft) / imgW
  const v1 = (intTop - imgTop) / imgH
  const u2 = (intRight - imgLeft) / imgW
  const v2 = (intBottom - imgTop) / imgH
  const rot = sourceImage.rotation ?? 0
  if (rot === 0) {
    const scaleX = nW / imgW
    const scaleY = nH / imgH
    return {
      srcX: (intLeft - imgLeft) * scaleX,
      srcY: (intTop - imgTop) * scaleY,
      srcW: (intRight - intLeft) * scaleX,
      srcH: (intBottom - intTop) * scaleY,
    }
  }
  if (rot === 90) {
    return {
      srcX: nH - u2 * nH,
      srcY: (1 - v2) * nW,
      srcW: (u2 - u1) * nH,
      srcH: (v2 - v1) * nW,
    }
  }
  if (rot === 180) {
    return {
      srcX: (1 - u2) * nW,
      srcY: (1 - v2) * nH,
      srcW: (u2 - u1) * nW,
      srcH: (v2 - v1) * nH,
    }
  }
  // 270 CW: physical (u,v) -> image (v, 1-u)
  return {
    srcX: (1 - u2) * nH,
    srcY: (1 - v2) * nW,
    srcW: (u2 - u1) * nH,
    srcH: (v2 - v1) * nW,
  }
}

export interface OutputResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
  monitors: { monitor: Monitor; stripWidth: number; stripHeight: number; stripX: number; stripY: number }[]
  /** True when the output contains black fill (vertical offsets or different strip heights) */
  hasBlackBars: boolean
}

/**
 * Generate the final stitched wallpaper image.
 *
 * Uses two coordinate spaces:
 * - Physical layout: determines what portion of the source image each monitor sees
 * - Windows arrangement: determines where each monitor sits in the virtual desktop (pixel positions)
 *
 * Output matches the Windows virtual desktop bounding box: each monitor is drawn at its
 * (pixelX, pixelY) position. This supports side-by-side, stacked vertical, and mixed layouts.
 *
 * Steps:
 * 1. Compute bounding box of all monitors in Windows arrangement (min/max X and Y).
 * 2. Output dimensions = (maxX - minX) × (maxY - minY).
 * 3. For each monitor, draw its strip at (pixelX - minX, pixelY - minY).
 */
export function generateOutput(
  monitors: Monitor[],
  sourceImage: SourceImage | null,
  windowsArrangement: WindowsMonitorPosition[],
): OutputResult | null {
  if (monitors.length === 0) return null

  // Build lookup maps
  const monitorMap = new Map<string, Monitor>()
  for (const m of monitors) monitorMap.set(m.id, m)

  const winPosList = windowsArrangement.filter(wp => monitorMap.has(wp.monitorId))
  if (winPosList.length === 0) return null

  const stripWidth = (mon: Monitor) => (mon.rotation ?? 0) === 90 ? mon.preset.resolutionY : mon.preset.resolutionX
  const stripHeight = (mon: Monitor) => (mon.rotation ?? 0) === 90 ? mon.preset.resolutionX : mon.preset.resolutionY

  // Bounding box of the Windows virtual desktop (same as Windows Display Settings)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const wp of winPosList) {
    const mon = monitorMap.get(wp.monitorId)!
    const sw = stripWidth(mon)
    const sh = stripHeight(mon)
    minX = Math.min(minX, wp.pixelX)
    minY = Math.min(minY, wp.pixelY)
    maxX = Math.max(maxX, wp.pixelX + sw)
    maxY = Math.max(maxY, wp.pixelY + sh)
  }
  const totalWidth = maxX - minX
  const totalHeight = maxY - minY

  // Create output canvas
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = totalWidth
  outputCanvas.height = totalHeight
  const ctx = outputCanvas.getContext('2d')!

  // Fill with black
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  const monitorStrips: OutputResult['monitors'] = []

  // One-time: get source element (original or rotated canvas)
  const sourceElement =
    sourceImage && (sourceImage.rotation ?? 0) !== 0
      ? rotatedImageCanvas(sourceImage)
      : sourceImage?.element ?? null

  for (const wp of winPosList) {
    const monitor = monitorMap.get(wp.monitorId)!
    const sw = stripWidth(monitor)
    const sh = stripHeight(monitor)
    const drawX = Math.round(wp.pixelX - minX)
    const drawY = Math.round(wp.pixelY - minY)

    if (sourceImage && sourceElement) {
      const monLeft = monitor.physicalX
      const monTop = monitor.physicalY
      const monRight = monLeft + monitor.physicalWidth
      const monBottom = monTop + monitor.physicalHeight
      const imgLeft = sourceImage.physicalX
      const imgTop = sourceImage.physicalY
      const imgW = sourceImage.physicalWidth
      const imgH = sourceImage.physicalHeight

      const intLeft = Math.max(monLeft, imgLeft)
      const intTop = Math.max(monTop, imgTop)
      const intRight = Math.min(monRight, imgLeft + imgW)
      const intBottom = Math.min(monBottom, imgTop + imgH)

      if (intLeft < intRight && intTop < intBottom) {
        const { srcX, srcY, srcW, srcH } = getSourceRect(
          sourceImage, imgLeft, imgTop, imgW, imgH,
          intLeft, intTop, intRight, intBottom
        )
        const monScaleX = sw / monitor.physicalWidth
        const monScaleY = sh / monitor.physicalHeight
        const dstX = (intLeft - monLeft) * monScaleX
        const dstY = (intTop - monTop) * monScaleY
        const dstW = (intRight - intLeft) * monScaleX
        const dstH = (intBottom - intTop) * monScaleY

        ctx.drawImage(
          sourceElement,
          srcX, srcY, srcW, srcH,
          drawX + dstX, drawY + dstY, dstW, dstH
        )
      }
    }

    monitorStrips.push({ monitor, stripWidth: sw, stripHeight: sh, stripX: drawX, stripY: drawY })
  }

  // Black bars when the bounding box has empty regions (monitors don't tile the full area)
  const monitorArea = monitorStrips.reduce((sum, s) => sum + s.stripWidth * s.stripHeight, 0)
  const boundingArea = totalWidth * totalHeight
  const hasBlackBars = monitorArea < boundingArea

  return {
    canvas: outputCanvas,
    width: totalWidth,
    height: totalHeight,
    monitors: monitorStrips,
    hasBlackBars,
  }
}
