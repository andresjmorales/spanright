import type { Monitor, SourceImage, WindowsMonitorPosition, FillOptions } from './types'

/**
 * Build a canvas with the image drawn at the given rotation (degrees CW).
 * TODO (source image rotation): 90° and 270° can produce wrong/missing crop for some monitors
 * in the output preview; physical↔pixel mapping or getSourceRect may need revisiting.
 */
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
    // 90 CW: canvas (dx,dy) = image (dy, nH - dx). setTransform(a,b,c,d,e,f): (x,y)->(a*x+c*y+e, b*x+d*y+f)
    ctx.setTransform(0, 1, -1, 0, 0, nH)
    ctx.drawImage(img, 0, 0)
  } else if (rot === 180) {
    ctx.translate(nW, nH)
    ctx.rotate(180 * Math.PI / 180)
    ctx.drawImage(img, 0, 0)
  } else if (rot === 270) {
    // 270 CW: canvas (dx,dy) = image (nW - dy, dx)
    ctx.setTransform(0, 1, -1, 0, nW, 0)
    ctx.drawImage(img, 0, 0)
  }
  ctx.restore()
  return canvas
}

/** Get source rect (in the possibly rotated image) for the physical intersection. See TODO on rotatedImageCanvas for 90/270° caveats. */
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
  // 270 CW: rotated.x = original.y, rotated.y = nW - original.x; so srcX = nH*u1, srcY = nW*v1
  return {
    srcX: u1 * nH,
    srcY: v1 * nW,
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
  fillOptions?: FillOptions,
): OutputResult | null {
  if (monitors.length === 0) return null

  const fill = fillOptions ?? { mode: 'solid', color: '#000000' }

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

  // One-time: get source element (original or rotated canvas)
  const sourceElement =
    sourceImage && (sourceImage.rotation ?? 0) !== 0
      ? rotatedImageCanvas(sourceImage)
      : sourceImage?.element ?? null

  // --- Fill background based on mode ---
  if (fill.mode === 'blur' && sourceImage && sourceElement) {
    // Blurred edge extension: draw source image stretched to fill entire output with heavy blur,
    // then draw sharp per-monitor crops on top.
    const imgLeft = sourceImage.physicalX
    const imgTop = sourceImage.physicalY
    const imgW = sourceImage.physicalWidth
    const imgH = sourceImage.physicalHeight

    // Map the full output bounding box (in physical space) to the source image.
    // We need to figure out what physical area the output covers.
    // The output covers the bounding box of all monitors in the Windows arrangement.
    // We need to map this back to physical space to know what part of the source image to draw.
    // However, the output is in pixel space (Windows arrangement). We'll approximate by
    // drawing the source image scaled to fill the output canvas with edge clamping, then blurring.

    // Use an offscreen canvas to create the blurred background
    const blurCanvas = document.createElement('canvas')
    // Use a smaller size for performance, then scale up
    const blurScale = Math.min(1, 2000 / Math.max(totalWidth, totalHeight))
    const bw = Math.round(totalWidth * blurScale)
    const bh = Math.round(totalHeight * blurScale)
    blurCanvas.width = bw
    blurCanvas.height = bh
    const bctx = blurCanvas.getContext('2d')!

    // To create edge extension, we need to figure out where the source image sits
    // relative to the output canvas. We'll use the first monitor's mapping as reference
    // to compute a rough physical-to-pixel transform for the output.
    // Average PPI across monitors for a rough transform
    let avgPpiX = 0, avgPpiY = 0
    for (const wp of winPosList) {
      const mon = monitorMap.get(wp.monitorId)!
      avgPpiX += stripWidth(mon) / mon.physicalWidth
      avgPpiY += stripHeight(mon) / mon.physicalHeight
    }
    avgPpiX /= winPosList.length
    avgPpiY /= winPosList.length

    // Map source image physical bounds to output pixel coordinates
    // Output pixel (0,0) corresponds to (minX, minY) in Windows pixels
    // Physical pos -> Windows pixel: roughly (physX - someOffset) * avgPpi
    // We use the first monitor as anchor to compute the offset
    const anchor = winPosList[0]
    const anchorMon = monitorMap.get(anchor.monitorId)!
    const physToPixX = stripWidth(anchorMon) / anchorMon.physicalWidth
    const physToPixY = stripHeight(anchorMon) / anchorMon.physicalHeight
    const physOriginX = anchorMon.physicalX - anchor.pixelX / physToPixX
    const physOriginY = anchorMon.physicalY - anchor.pixelY / physToPixY

    const imgPixelX = (imgLeft - physOriginX) * physToPixX - minX
    const imgPixelY = (imgTop - physOriginY) * physToPixY - minY
    const imgPixelW = imgW * physToPixX
    const imgPixelH = imgH * physToPixY

    // Draw source image with edge extension by using drawImage with clamped coordinates
    // First, fill the blur canvas with the source image, stretching edges outward
    // We'll draw the image 3x3 grid style: center is the actual image, edges repeat edge pixels

    // Scale coordinates to blur canvas
    const sx = imgPixelX * blurScale
    const sy = imgPixelY * blurScale
    const sw = imgPixelW * blurScale
    const sh = imgPixelH * blurScale

    const srcW = sourceElement instanceof HTMLCanvasElement ? sourceElement.width : sourceElement.naturalWidth
    const srcH = sourceElement instanceof HTMLCanvasElement ? sourceElement.height : sourceElement.naturalHeight

    // Draw edge extensions using 1px edge strips stretched outward
    const edgeExtend = Math.max(bw, bh)

    // Top-left corner
    bctx.drawImage(sourceElement, 0, 0, 1, 1, sx - edgeExtend, sy - edgeExtend, edgeExtend, edgeExtend)
    // Top edge
    bctx.drawImage(sourceElement, 0, 0, srcW, 1, sx, sy - edgeExtend, sw, edgeExtend)
    // Top-right corner
    bctx.drawImage(sourceElement, srcW - 1, 0, 1, 1, sx + sw, sy - edgeExtend, edgeExtend, edgeExtend)
    // Left edge
    bctx.drawImage(sourceElement, 0, 0, 1, srcH, sx - edgeExtend, sy, edgeExtend, sh)
    // Center (actual image)
    bctx.drawImage(sourceElement, 0, 0, srcW, srcH, sx, sy, sw, sh)
    // Right edge
    bctx.drawImage(sourceElement, srcW - 1, 0, 1, srcH, sx + sw, sy, edgeExtend, sh)
    // Bottom-left corner
    bctx.drawImage(sourceElement, 0, srcH - 1, 1, 1, sx - edgeExtend, sy + sh, edgeExtend, edgeExtend)
    // Bottom edge
    bctx.drawImage(sourceElement, 0, srcH - 1, srcW, 1, sx, sy + sh, sw, edgeExtend)
    // Bottom-right corner
    bctx.drawImage(sourceElement, srcW - 1, srcH - 1, 1, 1, sx + sw, sy + sh, edgeExtend, edgeExtend)

    // Apply heavy blur
    const blurRadius = Math.round(80 * blurScale)
    const blurred = document.createElement('canvas')
    blurred.width = bw
    blurred.height = bh
    const bctx2 = blurred.getContext('2d')!
    bctx2.filter = `blur(${blurRadius}px)`
    bctx2.drawImage(blurCanvas, 0, 0)
    bctx2.filter = 'none'

    // Draw blurred background onto output canvas
    ctx.drawImage(blurred, 0, 0, bw, bh, 0, 0, totalWidth, totalHeight)
  } else if (fill.mode === 'transparent') {
    // Leave canvas transparent (default state)
    ctx.clearRect(0, 0, totalWidth, totalHeight)
  } else {
    // Solid color fill (default)
    ctx.fillStyle = fill.color
    ctx.fillRect(0, 0, totalWidth, totalHeight)
  }

  const monitorStrips: OutputResult['monitors'] = []

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
