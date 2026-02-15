import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useStore } from '../store'
import type { Monitor } from '../types'
import InfoDialog from './InfoDialog'

const MONITOR_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
]

export default function WindowsArrangementCanvas() {
  const { state, dispatch } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showInfoDialog, setShowInfoDialog] = useState(false)

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
  const { displayScale, offsetX, offsetY } = useMemo(() => {
    if (state.windowsArrangement.length === 0) {
      return { displayScale: 0.1, offsetX: 0, offsetY: 0 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const wp of state.windowsArrangement) {
      const mon = monitorMap.get(wp.monitorId)
      if (!mon) continue
      minX = Math.min(minX, wp.pixelX)
      minY = Math.min(minY, wp.pixelY)
      maxX = Math.max(maxX, wp.pixelX + mon.preset.resolutionX)
      maxY = Math.max(maxY, wp.pixelY + mon.preset.resolutionY)
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
      const w = mon.preset.resolutionX * displayScale
      const h = mon.preset.resolutionY * displayScale

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
        ctx.fillText(mon.preset.name, x + 8, y + 17, labelW - 8)

        if (showRes) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '9px system-ui, sans-serif'
          ctx.fillText(`${mon.preset.resolutionX} x ${mon.preset.resolutionY} px`, x + 8, y + 31, labelW - 8)
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
      const w = mon.preset.resolutionX * displayScale
      const h = mon.preset.resolutionY * displayScale

      if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
        setDragging(wp.monitorId)
        setDragOffset({ x: mx - x, y: my - y })
        return
      }
    }
  }, [state.windowsArrangement, state.useWindowsArrangement, monitorMap, displayScale, toDisplayX, toDisplayY])

  // Compute total pixel dimensions of all monitors for drag clamping
  const totalMonitorBounds = useMemo(() => {
    let totalW = 0, totalH = 0
    for (const m of state.monitors) {
      totalW += m.preset.resolutionX
      totalH = Math.max(totalH, m.preset.resolutionY)
    }
    return { totalW, totalH }
  }, [state.monitors])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let newPixelX = Math.round(toPixelX(mx - dragOffset.x))
    let newPixelY = Math.round(toPixelY(my - dragOffset.y))

    // Clamp: don't let any monitor drift beyond 2x the total arrangement width/height
    // from the bounding box of the other monitors
    const others = state.windowsArrangement.filter(wp => wp.monitorId !== dragging)
    if (others.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const wp of others) {
        const mon = monitorMap.get(wp.monitorId)
        if (!mon) continue
        minX = Math.min(minX, wp.pixelX)
        minY = Math.min(minY, wp.pixelY)
        maxX = Math.max(maxX, wp.pixelX + mon.preset.resolutionX)
        maxY = Math.max(maxY, wp.pixelY + mon.preset.resolutionY)
      }
      const limitW = totalMonitorBounds.totalW
      const limitH = totalMonitorBounds.totalH
      newPixelX = Math.max(minX - limitW, Math.min(maxX + limitW, newPixelX))
      newPixelY = Math.max(minY - limitH, Math.min(maxY + limitH, newPixelY))
    }

    dispatch({ type: 'MOVE_WINDOWS_MONITOR', monitorId: dragging, pixelX: newPixelX, pixelY: newPixelY })
  }, [dragging, dragOffset, toPixelX, toPixelY, dispatch, state.windowsArrangement, monitorMap, totalMonitorBounds])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // Compute validation warnings
  const warnings = useMemo(() => {
    const warns: string[] = []
    if (!state.useWindowsArrangement || state.monitors.length < 2) return warns

    // Check if left-to-right order matches physical layout
    const physicalOrder = [...state.monitors].sort((a, b) => a.physicalX - b.physicalX).map(m => m.id)
    const windowsOrder = [...state.windowsArrangement].sort((a, b) => a.pixelX - b.pixelX).map(wp => wp.monitorId)

    if (physicalOrder.join(',') !== windowsOrder.join(',')) {
      warns.push('Your Windows display order doesn\'t match your physical layout. This is fine but make sure it\'s intentional.')
    }

    // Check for large vertical offset differences
    const physicalSorted = [...state.monitors].sort((a, b) => a.physicalX - b.physicalX)
    const windowsSorted = [...state.windowsArrangement].sort((a, b) => a.pixelX - b.pixelX)

    for (let i = 0; i < Math.min(physicalSorted.length, windowsSorted.length); i++) {
      const phys = physicalSorted[i]
      const win = windowsSorted[i]
      if (phys.id === win.monitorId) {
        // Compare relative vertical positioning
        const physMinY = Math.min(...physicalSorted.map(m => m.physicalY))
        const winMinY = Math.min(...windowsSorted.map(wp => wp.pixelY))
        const physRelY = phys.physicalY - physMinY
        const winRelY = win.pixelY - winMinY
        // Convert physical offset to approximate pixels for comparison
        const physRelPx = physRelY * phys.ppi
        if (Math.abs(physRelPx - winRelY) > 200) {
          warns.push('Your Windows vertical alignment differs significantly from your physical layout. The wallpaper will match your Windows arrangement, which may not look physically seamless.')
          break
        }
      }
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
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center gap-4 shrink-0 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!state.useWindowsArrangement}
            onChange={(e) => dispatch({ type: 'SET_USE_WINDOWS_ARRANGEMENT', value: !e.target.checked })}
            className="accent-blue-500"
          />
          <span className="text-xs text-gray-300">
            My Windows display arrangement matches my physical layout (top-aligned)
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

        <div className="flex-1" />

        <button
          onClick={() => setShowInfoDialog(true)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          How does this work?
        </button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 space-y-1 bg-yellow-900/20 border-b border-yellow-700/30">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-yellow-400 flex items-start gap-1.5">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: state.useWindowsArrangement ? (dragging ? 'grabbing' : 'default') : 'default' }}
      >
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
            Drag monitors to match your Windows Display Settings arrangement
          </div>
        )}
      </div>

      {/* Info dialog */}
      {showInfoDialog && <InfoDialog onClose={() => setShowInfoDialog(false)} />}
    </div>
  )
}
