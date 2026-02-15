import type { Monitor, SourceImage, WindowsMonitorPosition } from './types'

export interface OutputResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
  monitors: { monitor: Monitor; stripWidth: number; stripHeight: number }[]
}

/**
 * Generate the final stitched wallpaper image.
 *
 * Uses two coordinate spaces:
 * - Physical layout: determines what portion of the source image each monitor sees
 * - Windows arrangement: determines stitching order (left-to-right) and vertical pixel offsets
 *
 * Steps:
 * 1. Sort monitors by Windows arrangement x-position (left-to-right).
 * 2. For each monitor, determine what region of the source image falls behind it
 *    (using physical coordinates).
 * 3. Crop that region and scale it to the monitor's native resolution.
 * 4. Stitch all strips side by side using Windows arrangement vertical offsets.
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

  const winPosMap = new Map<string, WindowsMonitorPosition>()
  for (const wp of windowsArrangement) winPosMap.set(wp.monitorId, wp)

  // Sort by Windows arrangement x-position (left-to-right)
  const sortedWinPos = [...windowsArrangement]
    .filter(wp => monitorMap.has(wp.monitorId))
    .sort((a, b) => a.pixelX - b.pixelX)

  if (sortedWinPos.length === 0) return null

  // Calculate vertical offsets relative to the topmost monitor
  const minWinY = Math.min(...sortedWinPos.map(wp => wp.pixelY))

  // Calculate total output dimensions
  const totalWidth = sortedWinPos.reduce((sum, wp) => {
    const mon = monitorMap.get(wp.monitorId)!
    return sum + mon.preset.resolutionX
  }, 0)

  const maxHeight = Math.max(...sortedWinPos.map(wp => {
    const mon = monitorMap.get(wp.monitorId)!
    return (wp.pixelY - minWinY) + mon.preset.resolutionY
  }))

  // Create output canvas
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = totalWidth
  outputCanvas.height = maxHeight
  const ctx = outputCanvas.getContext('2d')!

  // Fill with black
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, totalWidth, maxHeight)

  let xOffset = 0
  const monitorStrips: OutputResult['monitors'] = []

  for (const wp of sortedWinPos) {
    const monitor = monitorMap.get(wp.monitorId)!
    const stripWidth = monitor.preset.resolutionX
    const stripHeight = monitor.preset.resolutionY

    // Vertical offset from Windows arrangement
    const yPixelOffset = Math.round(wp.pixelY - minWinY)

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
        const monScaleX = stripWidth / monitor.physicalWidth
        const monScaleY = stripHeight / monitor.physicalHeight

        const dstX = (intLeft - monLeft) * monScaleX
        const dstY = (intTop - monTop) * monScaleY
        const dstW = (intRight - intLeft) * monScaleX
        const dstH = (intBottom - intTop) * monScaleY

        ctx.drawImage(
          sourceImage.element,
          srcX, srcY, srcW, srcH,
          xOffset + dstX, yPixelOffset + dstY, dstW, dstH
        )
      }
    }

    monitorStrips.push({ monitor, stripWidth, stripHeight })
    xOffset += stripWidth
  }

  return {
    canvas: outputCanvas,
    width: totalWidth,
    height: maxHeight,
    monitors: monitorStrips,
  }
}
