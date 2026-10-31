import type { Monitor, SourceImage, WindowsMonitorPosition, FillMode } from './types'

export interface FillSettings {
  mode: FillMode
  solidColor: string
}

/**
 * Build a canvas with the image drawn at the given rotation (degrees CW).
 * For 90/270 the canvas is nH wide and nW tall.
 */
export function rotatedImageCanvas(sourceImage: SourceImage): HTMLCanvasElement {
  const img = sourceImage.element
  const nW = sourceImage.naturalWidth
  const nH = sourceImage.naturalHeight
  const rot = sourceImage.rotation ?? 0
  const [width, height] = (rot === 90 || rot === 270) ? [nH, nW] : [nW, nH]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // setTransform(a, b, c, d, e, f) maps image (x, y) -> canvas (a*x + c*y + e, b*x + d*y + f)
  if (rot === 90) {
    // 90 CW: canvas = (nH - y, x)
    ctx.setTransform(0, 1, -1, 0, nH, 0)
  } else if (rot === 180) {
    // 180: canvas = (nW - x, nH - y)
    ctx.setTransform(-1, 0, 0, -1, nW, nH)
  } else if (rot === 270) {
    // 270 CW: canvas = (y, nW - x)
    ctx.setTransform(0, -1, 1, 0, 0, nW)
  }
  ctx.drawImage(img, 0, 0)
  return canvas
}

/**
 * Get the source rect for the physical intersection, in the coordinates of the element
 * actually drawn from (the original image, or the already-rotated canvas from rotatedImageCanvas).
 */
function getSourceRect(
  sourceImage: SourceImage,
  imgLeft: number, imgTop: number, imgW: number, imgH: number,
  intLeft: number, intTop: number, intRight: number, intBottom: number
): { srcX: number; srcY: number; srcW: number; srcH: number } {
  const rot = sourceImage.rotation ?? 0
  const quarterTurn = rot === 90 || rot === 270
  const srcElW = quarterTurn ? sourceImage.naturalHeight : sourceImage.naturalWidth
  const srcElH = quarterTurn ? sourceImage.naturalWidth : sourceImage.naturalHeight
  const scaleX = srcElW / imgW
  const scaleY = srcElH / imgH
  return {
    srcX: (intLeft - imgLeft) * scaleX,
    srcY: (intTop - imgTop) * scaleY,
    srcW: (intRight - intLeft) * scaleX,
    srcH: (intBottom - intTop) * scaleY,
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
/** Blur radius (px) for blurred-edge fill. */
const FILL_BLUR_RADIUS_PX = 80

export function generateOutput(
  monitors: Monitor[],
  sourceImage: SourceImage | null,
  windowsArrangement: WindowsMonitorPosition[],
  fill?: FillSettings,
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

  const fillMode = fill?.mode ?? 'solid'
  const solidColor = fill?.solidColor ?? '#000000'

  if (fillMode === 'solid') {
    ctx.fillStyle = solidColor
    ctx.fillRect(0, 0, totalWidth, totalHeight)
  }
  // 'transparent' and 'blur': canvas stays default (transparent); we composite on top

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

  // Blur fill: draw source scaled-to-cover with heavy blur, then composite sharp strips on top
  if (fillMode === 'blur' && sourceImage && sourceElement) {
    const blurCanvas = document.createElement('canvas')
    blurCanvas.width = totalWidth
    blurCanvas.height = totalHeight
    const blurCtx = blurCanvas.getContext('2d')!
    const coverAspect = totalWidth / totalHeight
    const imgAspect = sourceElement.width / sourceElement.height
    let drawW: number, drawH: number
    if (imgAspect > coverAspect) {
      drawH = totalHeight
      drawW = drawH * imgAspect
    } else {
      drawW = totalWidth
      drawH = drawW / imgAspect
    }
    const bDrawX = (totalWidth - drawW) / 2
    const bDrawY = (totalHeight - drawH) / 2
    blurCtx.drawImage(sourceElement, bDrawX, bDrawY, drawW, drawH)
    const blurredCanvas = document.createElement('canvas')
    blurredCanvas.width = totalWidth
    blurredCanvas.height = totalHeight
    const blurredCtx = blurredCanvas.getContext('2d')!
    blurredCtx.filter = `blur(${FILL_BLUR_RADIUS_PX}px)`
    blurredCtx.drawImage(blurCanvas, 0, 0)
    ctx.globalCompositeOperation = 'destination-over'
    ctx.drawImage(blurredCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  } else if (fillMode === 'blur') {
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, totalWidth, totalHeight)
    ctx.globalCompositeOperation = 'source-over'
  }

  // Empty regions when the bounding box has areas not covered by monitors
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
