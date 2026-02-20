import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useStore } from '../store'
import type { Monitor } from '../types'
import { getMonitorDisplayName } from '../utils'

const MONITOR_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
]

/** Snap threshold in screen pixels — how close an edge must be to "stick" */
const SNAP_SCREEN_PX = 30

/** Strip dimensions in pixels (depends on rotation) */
function getStripWidth(mon: Monitor): number {
  return (mon.rotation ?? 0) === 90 ? mon.preset.resolutionY : mon.preset.resolutionX
}
function getStripHeight(mon: Monitor): number {
  return (mon.rotation ?? 0) === 90 ? mon.preset.resolutionX : mon.preset.resolutionY
}

/**
 * Compute a snapped position for a dragged monitor.
 * Checks all edge pairs (left/right/top/bottom) against all other monitors.
 */
function computeSnap(
  dragId: string,
  rawX: number,
  rawY: number,
  arrangement: import('../types').WindowsMonitorPosition[],
  monMap: Map<string, import('../types').Monitor>,
  scale: number
): { x: number; y: number } {
  const dragMon = monMap.get(dragId)
  if (!dragMon) return { x: rawX, y: rawY }

  const dw = getStripWidth(dragMon)
  const dh = getStripHeight(dragMon)
  const threshold = SNAP_SCREEN_PX / scale

  let bestDx = Infinity
  let bestDy = Infinity
  let snapX = rawX
  let snapY = rawY

  for (const wp of arrangement) {
    if (wp.monitorId === dragId) continue
    const mon = monMap.get(wp.monitorId)
    if (!mon) continue

    const ow = getStripWidth(mon)
    const oh = getStripHeight(mon)

    // Horizontal snapping — compare left/right edges
    const hChecks = [
      { dragEdge: rawX, otherEdge: wp.pixelX, offset: 0 },
      { dragEdge: rawX, otherEdge: wp.pixelX + ow, offset: 0 },
      { dragEdge: rawX + dw, otherEdge: wp.pixelX, offset: -dw },
      { dragEdge: rawX + dw, otherEdge: wp.pixelX + ow, offset: -dw },
    ]
    for (const { dragEdge, otherEdge, offset } of hChecks) {
      const dist = Math.abs(dragEdge - otherEdge)
      if (dist < bestDx) {
        bestDx = dist
        snapX = otherEdge + offset
      }
    }

    // Vertical snapping — compare top/bottom edges
    const vChecks = [
      { dragEdge: rawY, otherEdge: wp.pixelY, offset: 0 },
      { dragEdge: rawY, otherEdge: wp.pixelY + oh, offset: 0 },
      { dragEdge: rawY + dh, otherEdge: wp.pixelY, offset: -dh },
      { dragEdge: rawY + dh, otherEdge: wp.pixelY + oh, offset: -dh },
    ]
    for (const { dragEdge, otherEdge, offset } of vChecks) {
      const dist = Math.abs(dragEdge - otherEdge)
      if (dist < bestDy) {
        bestDy = dist
        snapY = otherEdge + offset
      }
    }
  }

  return {
    x: bestDx <= threshold ? snapX : rawX,
    y: bestDy <= threshold ? snapY : rawY,
  }
}

/**
 * Resolve overlaps by pushing the dragged monitor to the nearest
 * non-overlapping position. Iterates to handle cascading overlaps.
 */
function resolveOverlaps(
  x: number,
  y: number,
  w: number,
  h: number,
  others: Array<{ x: number; y: number; w: number; h: number }>,
  maxIter = 5
): { x: number; y: number } {
  for (let iter = 0; iter < maxIter; iter++) {
    let found = false
    for (const o of others) {
      if (x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y) {
        found = true
        const pushes = [
          { nx: o.x - w, ny: y, dist: Math.abs(x - (o.x - w)) },
          { nx: o.x + o.w, ny: y, dist: Math.abs(x - (o.x + o.w)) },
          { nx: x, ny: o.y - h, dist: Math.abs(y - (o.y - h)) },
          { nx: x, ny: o.y + o.h, dist: Math.abs(y - (o.y + o.h)) },
        ]
        const best = pushes.reduce((a, b) => (a.dist < b.dist ? a : b))
        x = best.nx
        y = best.ny
        break // re-check all monitors after adjustment
      }
    }
    if (!found) break
  }
  return { x, y }
}

export default function WindowsArrangementCanvas() {
  const { state, dispatch } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [frozenLayout, setFrozenLayout] = useState<{ displayScale: number; offsetX: number; offsetY: number } | null>(null)

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Build a map of monitor id -> Monitor for quick lookup
  const monitorMap = useMemo(() => {
    const map = new Map<string, Monitor>()
    for (const m of state.monitors) map.set(m.id, m)
    return map
  }, [state.monitors])

  // Compute display scale: fit all monitors within the canvas with padding
  const computed = useMemo(() => {
    if (state.windowsArrangement.length === 0) {
      return { displayScale: 0.1, offsetX: 0, offsetY: 0 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const wp of state.windowsArrangement) {
      const mon = monitorMap.get(wp.monitorId)
      if (!mon) continue
      minX = Math.min(minX, wp.pixelX)
      minY = Math.min(minY, wp.pixelY)
      maxX = Math.max(maxX, wp.pixelX + getStripWidth(mon))
      maxY = Math.max(maxY, wp.pixelY + getStripHeight(mon))
    }
    const contentW = maxX - minX
    const contentH = maxY - minY
    if (contentW === 0 || contentH === 0) return { displayScale: 0.1, offsetX: 0, offsetY: 0 }

    const pad = 80
    const availW = dimensions.width - pad * 2
    const availH = dimensions.height - pad * 2
    const scale = Math.min(availW / contentW, availH / contentH, 0.3)
    const ox = pad + (availW - contentW * scale) / 2 - minX * scale
    const oy = pad + (availH - contentH * scale) / 2 - minY * scale
    return { displayScale: scale, offsetX: ox, offsetY: oy }
  }, [state.windowsArrangement, monitorMap, dimensions])

  // Lock scale/offset during drag so auto-fit doesn't fight the cursor
  const displayScale = frozenLayout?.displayScale ?? computed.displayScale
  const offsetX = frozenLayout?.offsetX ?? computed.offsetX
  const offsetY = frozenLayout?.offsetY ?? computed.offsetY

  // Convert pixel position to display position
  const toDisplayX = useCallback((px: number) => px * displayScale + offsetX, [displayScale, offsetX])
  const toDisplayY = useCallback((px: number) => px * displayScale + offsetY, [displayScale, offsetY])
  const toPixelX = useCallback((dx: number) => (dx - offsetX) / displayScale, [displayScale, offsetX])
  const toPixelY = useCallback((dy: number) => (dy - offsetY) / displayScale, [displayScale, offsetY])

  // Find monitor index in physical layout order for consistent coloring
  const getMonitorIndex = useCallback((id: string) => {
    return state.monitors.findIndex(m => m.id === id)
  }, [state.monitors])

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, dimensions.width, dimensions.height)

    // Draw subtle grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    const gridStep = 100 * displayScale
    if (gridStep > 3) {
      const startX = offsetX % gridStep
      for (let x = startX; x < dimensions.width; x += gridStep) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, dimensions.height)
        ctx.stroke()
      }
      const startY = offsetY % gridStep
      for (let y = startY; y < dimensions.height; y += gridStep) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(dimensions.width, y)
        ctx.stroke()
      }
    }

    // Draw monitors
    for (const wp of state.windowsArrangement) {
      const mon = monitorMap.get(wp.monitorId)
      if (!mon) continue
      const idx = getMonitorIndex(wp.monitorId)
      const color = MONITOR_COLORS[idx % MONITOR_COLORS.length]

      const x = toDisplayX(wp.pixelX)
      const y = toDisplayY(wp.pixelY)
      const w = getStripWidth(mon) * displayScale
      const h = getStripHeight(mon) * displayScale

      // Fill
      ctx.fillStyle = color
      ctx.globalAlpha = 0.15
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 3)
      ctx.fill()
      ctx.globalAlpha = 1

      // Border
      ctx.strokeStyle = color
      ctx.lineWidth = dragging === wp.monitorId ? 2.5 : 1.5
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 3)
      ctx.stroke()

      // Label
      if (w > 50 && h > 30) {
        const labelW = Math.min(w - 8, 200)
        const showRes = w > 100 && h > 50
        const labelH = showRes ? 40 : 24
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.beginPath()
        ctx.roundRect(x + 4, y + 4, labelW, labelH, 3)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(getMonitorDisplayName(mon), x + 8, y + 17, labelW - 8)

        if (showRes) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '9px system-ui, sans-serif'
          const resW = getStripWidth(mon)
          const resH = getStripHeight(mon)
          ctx.fillText(`${resW} x ${resH} px`, x + 8, y + 31, labelW - 8)
        }
      }
    }
  }, [state.windowsArrangement, monitorMap, dimensions, displayScale, offsetX, offsetY, dragging, getMonitorIndex, toDisplayX, toDisplayY])

  // Mouse handlers for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!state.useWindowsArrangement) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Find which monitor was clicked (reverse order for top-most first)
    for (let i = state.windowsArrangement.length - 1; i >= 0; i--) {
      const wp = state.windowsArrangement[i]
      const mon = monitorMap.get(wp.monitorId)
      if (!mon) continue
      const x = toDisplayX(wp.pixelX)
      const y = toDisplayY(wp.pixelY)
      const w = getStripWidth(mon) * displayScale
      const h = getStripHeight(mon) * displayScale

      if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
        setDragging(wp.monitorId)
        setDragOffset({ x: mx - x, y: my - y })
        // Freeze the scale so auto-fit doesn't jitter while dragging
        setFrozenLayout({ displayScale, offsetX, offsetY })
        return
      }
    }
  }, [state.windowsArrangement, state.useWindowsArrangement, monitorMap, displayScale, offsetX, offsetY, toDisplayX, toDisplayY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const rawPixelX = Math.round(toPixelX(mx - dragOffset.x))
    const rawPixelY = Math.round(toPixelY(my - dragOffset.y))

    // Snap to edges of other monitors
    const snapped = computeSnap(
      dragging, rawPixelX, rawPixelY,
      state.windowsArrangement, monitorMap, displayScale
    )

    // Prevent overlap
    const dragMon = monitorMap.get(dragging)
    if (!dragMon) return
    const otherRects = state.windowsArrangement
      .filter(wp => wp.monitorId !== dragging)
      .map(wp => {
        const mon = monitorMap.get(wp.monitorId)
        if (!mon) return null
        return { x: wp.pixelX, y: wp.pixelY, w: getStripWidth(mon), h: getStripHeight(mon) }
      })
      .filter((r): r is { x: number; y: number; w: number; h: number } => r !== null)

    const resolved = resolveOverlaps(
      snapped.x, snapped.y,
      getStripWidth(dragMon), getStripHeight(dragMon),
      otherRects
    )

    dispatch({ type: 'MOVE_WINDOWS_MONITOR', monitorId: dragging, pixelX: resolved.x, pixelY: resolved.y })
  }, [dragging, dragOffset, toPixelX, toPixelY, dispatch, state.windowsArrangement, monitorMap, displayScale])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setFrozenLayout(null) // Unfreeze — let auto-fit recalculate
  }, [])

  // Compute validation warnings
  const warnings = useMemo(() => {
    const warns: string[] = []
    if (!state.useWindowsArrangement || state.monitors.length < 2) return warns

    // Check if arrangement order (left-to-right, top-to-bottom) matches physical layout
    const physicalOrder = [...state.monitors].sort((a, b) => a.physicalX - b.physicalX || a.physicalY - b.physicalY).map(m => m.id)
    const windowsOrder = [...state.windowsArrangement].sort((a, b) => a.pixelX - b.pixelX || a.pixelY - b.pixelY).map(wp => wp.monitorId)

    if (physicalOrder.join(',') !== windowsOrder.join(',')) {
      warns.push('Your display order doesn\'t match your physical layout. This is fine but make sure it\'s intentional.')
    }

    // Check for large offset differences (vertical and horizontal)
    const physicalSorted = [...state.monitors].sort((a, b) => a.physicalX - b.physicalX)
    const windowsSorted = [...state.windowsArrangement].sort((a, b) => a.pixelX - b.pixelX || a.pixelY - b.pixelY)

    let verticalMismatch = false
    let horizontalMismatch = false

    for (let i = 0; i < Math.min(physicalSorted.length, windowsSorted.length); i++) {
      const phys = physicalSorted[i]
      const win = windowsSorted[i]
      if (phys.id !== win.monitorId) continue

      const physMinY = Math.min(...physicalSorted.map(m => m.physicalY))
      const winMinY = Math.min(...windowsSorted.map(wp => wp.pixelY))
      const physRelPxY = (phys.physicalY - physMinY) * phys.ppi
      const winRelY = win.pixelY - winMinY
      if (Math.abs(physRelPxY - winRelY) > 200) verticalMismatch = true

      const physMinX = Math.min(...physicalSorted.map(m => m.physicalX))
      const winMinX = Math.min(...windowsSorted.map(wp => wp.pixelX))
      const physRelPxX = (phys.physicalX - physMinX) * phys.ppi
      const winRelX = win.pixelX - winMinX
      if (Math.abs(physRelPxX - winRelX) > 200) horizontalMismatch = true

      if (verticalMismatch && horizontalMismatch) break
    }

    if (verticalMismatch || horizontalMismatch) {
      const axis = verticalMismatch && horizontalMismatch
        ? 'vertical and horizontal alignment differ'
        : verticalMismatch
          ? 'vertical alignment differs'
          : 'horizontal alignment differs'
      warns.push(`Your virtual layout's ${axis} from your physical layout.`)
    }

    return warns
  }, [state.useWindowsArrangement, state.monitors, state.windowsArrangement])

  if (state.monitors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="text-center">
          <div className="text-lg font-medium mb-1">No monitors added</div>
          <div className="text-sm">Add monitors in the Physical Layout tab first</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 min-h-[4.5rem] sm:min-h-0 sm:h-11 flex items-center gap-4 shrink-0 flex-wrap py-2 sm:py-0">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!state.useWindowsArrangement}
            onChange={(e) => dispatch({ type: 'SET_USE_WINDOWS_ARRANGEMENT', value: !e.target.checked })}
            className="accent-blue-500"
          />
          <span className="text-xs text-gray-300">
            My virtual layout is top-aligned (default for most OSes)
          </span>
        </label>

        {state.useWindowsArrangement && (
          <>
            <div className="w-px h-5 bg-gray-700" />
            <button
              onClick={() => dispatch({ type: 'SYNC_WINDOWS_ARRANGEMENT' })}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700 transition-colors"
            >
              Reset to default
            </button>
          </>
        )}

      </div>

      {/* Explanation when customizing (purpose of OS arrangement and empty area) — in flow so it’s always visible */}
      {state.useWindowsArrangement && (
        <div className="shrink-0 px-4 py-2.5 bg-amber-950/70 border-b border-amber-700/50">
          <p className="text-xs text-amber-200">
            <strong>Tip:</strong> Match this to your OS display arrangement. Arrangement on this page affects the output image.
            {' '}For more information on how virtual layout works, see{' '}
            <button onClick={() => dispatch({ type: 'SET_SHOW_HOW_IT_WORKS', value: true })} className="text-amber-300 underline underline-offset-2 hover:text-amber-100 transition-colors">How It Works</button>.
          </p>
        </div>
      )}

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden min-h-0"
        style={{ cursor: state.useWindowsArrangement ? (dragging ? 'grabbing' : 'default') : 'default' }}
      >
        {/* Conditional warnings only (e.g. “differs significantly”) — overlaid on canvas */}
        {warnings.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-10 px-4 py-2 space-y-1 bg-yellow-900/80 backdrop-blur-sm border-b border-yellow-700/30 pointer-events-none">
            {warnings.map((w, i) => (
              <div key={i} className="text-xs text-yellow-400 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Disabled overlay when checkbox is on */}
        {!state.useWindowsArrangement && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/50">
            <div className="bg-gray-900/90 backdrop-blur rounded-lg px-6 py-4 text-center max-w-md">
              <div className="text-sm text-gray-300 font-medium mb-1">Auto-aligned mode</div>
              <div className="text-xs text-gray-500">
                Monitors will be arranged top-aligned in the same left-to-right order as your physical layout.
                Uncheck the box above to customize.
              </div>
            </div>
          </div>
        )}

        {/* Help text when enabled */}
        {state.useWindowsArrangement && !dragging && (
          <div className="absolute bottom-3 right-3 bg-gray-900/60 backdrop-blur px-2 py-1 rounded text-[10px] text-gray-500 select-none">
            Drag monitors to match your OS display settings arrangement
          </div>
        )}
      </div>

    </div>
  )
}
