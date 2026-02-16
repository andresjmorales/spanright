import type { Monitor, SourceImage, WindowsMonitorPosition } from './types'

export interface OutputResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
  monitors: { monitor: Monitor; stripWidth: number; stripHeight: number }[]
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

  for (const wp of winPosList) {
    const monitor = monitorMap.get(wp.monitorId)!
    const sw = stripWidth(monitor)
    const sh = stripHeight(monitor)
    const drawX = Math.round(wp.pixelX - minX)
    const drawY = Math.round(wp.pixelY - minY)

    if (sourceImage) {
      // Determine what portion of the source image falls behind this monitor
      // using the PHYSICAL layout coordinates
      const monLeft = monitor.physicalX
      const monTop = monitor.physicalY
      const monRight = monLeft + monitor.physicalWidth
      const monBottom = monTop + monitor.physicalHeight

      // Image physical bounds
      const imgLeft = sourceImage.physicalX
      const imgTop = sourceImage.physicalY
      const imgRight = imgLeft + sourceImage.physicalWidth
      const imgBottom = imgTop + sourceImage.physicalHeight

      // Intersection in physical space
      const intLeft = Math.max(monLeft, imgLeft)
      const intTop = Math.max(monTop, imgTop)
      const intRight = Math.min(monRight, imgRight)
      const intBottom = Math.min(monBottom, imgBottom)

      if (intLeft < intRight && intTop < intBottom) {
        // There is overlap — calculate source image pixel coordinates
        const imgScaleX = sourceImage.naturalWidth / sourceImage.physicalWidth
        const imgScaleY = sourceImage.naturalHeight / sourceImage.physicalHeight

        const srcX = (intLeft - imgLeft) * imgScaleX
        const srcY = (intTop - imgTop) * imgScaleY
        const srcW = (intRight - intLeft) * imgScaleX
        const srcH = (intBottom - intTop) * imgScaleY

        // Calculate destination pixel coordinates within the monitor strip
        const monScaleX = sw / monitor.physicalWidth
        const monScaleY = sh / monitor.physicalHeight

        const dstX = (intLeft - monLeft) * monScaleX
        const dstY = (intTop - monTop) * monScaleY
        const dstW = (intRight - intLeft) * monScaleX
        const dstH = (intBottom - intTop) * monScaleY

        ctx.drawImage(
          sourceImage.element,
          srcX, srcY, srcW, srcH,
          drawX + dstX, drawY + dstY, dstW, dstH
        )
      }
    }

    monitorStrips.push({ monitor, stripWidth: sw, stripHeight: sh })
  }

  // Black bars when the bounding box has empty regions (gaps or non-rectangular layout)
  const hasBlackBars = winPosList.some((wp) => {
    const mon = monitorMap.get(wp.monitorId)!
    const sh = stripHeight(mon)
    const drawY = Math.round(wp.pixelY - minY)
    return drawY > 0 || drawY + sh < totalHeight
  }) || winPosList.some((wp) => {
    const mon = monitorMap.get(wp.monitorId)!
    const sw = stripWidth(mon)
    const drawX = Math.round(wp.pixelX - minX)
    return drawX > 0 || drawX + sw < totalWidth
  })

  return {
    canvas: outputCanvas,
    width: totalWidth,
    height: totalHeight,
    monitors: monitorStrips,
    hasBlackBars,
  }
}
