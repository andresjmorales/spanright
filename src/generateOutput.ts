import type { Monitor, SourceImage } from './types'

export interface OutputResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
  monitors: { monitor: Monitor; stripWidth: number; stripHeight: number }[]
}

/**
 * Generate the final stitched wallpaper image.
 *
 * Steps:
 * 1. Sort monitors left-to-right by physical x-position.
 * 2. For each monitor, determine what region of the source image falls behind it.
 * 3. Crop that region and scale it to the monitor's native resolution.
 * 4. Stitch all strips side by side. Output height = max vertical resolution.
 *    Shorter monitors are positioned based on their physical vertical offset.
 */
export function generateOutput(monitors: Monitor[], sourceImage: SourceImage | null): OutputResult | null {
  if (monitors.length === 0) return null

  // Sort monitors left-to-right by physical x position
  const sorted = [...monitors].sort((a, b) => a.physicalX - b.physicalX)

  // Calculate total output dimensions
  const totalWidth = sorted.reduce((sum, m) => sum + m.preset.resolutionX, 0)
  const maxHeight = Math.max(...sorted.map(m => m.preset.resolutionY))

  // Find the physical vertical range to determine relative positioning
  const minPhysicalY = Math.min(...sorted.map(m => m.physicalY))
  const maxPhysicalBottom = Math.max(...sorted.map(m => m.physicalY + m.physicalHeight))
  const totalPhysicalHeight = maxPhysicalBottom - minPhysicalY

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

  for (const monitor of sorted) {
    const stripWidth = monitor.preset.resolutionX
    const stripHeight = monitor.preset.resolutionY

    // Calculate vertical position: map physical Y offset to pixel offset
    // The monitor's relative physical position determines where it sits in the output
    const physicalYOffset = monitor.physicalY - minPhysicalY
    const yRatio = totalPhysicalHeight > 0 ? physicalYOffset / totalPhysicalHeight : 0
    const yPixelOffset = Math.round(yRatio * (maxHeight - stripHeight))

    if (sourceImage) {
      // Determine what portion of the source image falls behind this monitor
      // Monitor physical bounds
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
