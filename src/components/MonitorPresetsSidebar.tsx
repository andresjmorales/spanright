import { useState, useMemo } from 'react'
import { MONITOR_PRESETS, COMMON_ASPECT_RATIOS, COMMON_RESOLUTIONS } from '../presets'
import type { MonitorPreset } from '../types'
import { useStore } from '../store'
import { calculatePPI, calculatePhysicalDimensions, formatDimension } from '../utils'

export default function MonitorPresetsSidebar() {
  const { state, dispatch } = useStore()
  const [showCustom, setShowCustom] = useState(false)
  const [customDiagonal, setCustomDiagonal] = useState('27')
  const [customAspect, setCustomAspect] = useState<[number, number]>([16, 9])
  const [customResIdx, setCustomResIdx] = useState(0)
  const [useCustomRes, setUseCustomRes] = useState(false)
  const [customResW, setCustomResW] = useState('2560')
  const [customResH, setCustomResH] = useState('1440')
  const [searchFilter, setSearchFilter] = useState('')

  // Filter resolutions based on selected aspect ratio (with tolerance for rounding)
  const filteredResolutions = useMemo(() => {
    const [aw, ah] = customAspect
    const targetRatio = aw / ah
    return COMMON_RESOLUTIONS.filter(r => {
      const resRatio = r.w / r.h
      return Math.abs(resRatio - targetRatio) / targetRatio < 0.05
    })
  }, [customAspect])

  // Reset resolution selection when aspect ratio changes
  function handleAspectChange(a: number, b: number) {
    setCustomAspect([a, b])
    setCustomResIdx(0)
    setUseCustomRes(false)
    // Auto-fill custom resolution fields based on first matching resolution
    const targetRatio = a / b
    const match = COMMON_RESOLUTIONS.find(r => Math.abs(r.w / r.h - targetRatio) / targetRatio < 0.02)
    if (match) {
      setCustomResW(String(match.w))
      setCustomResH(String(match.h))
    } else {
      // No preset resolution for this ratio, auto-switch to custom entry
      setUseCustomRes(true)
      // Calculate a reasonable default resolution for this aspect ratio
      const height = 1440
      const width = Math.round(height * a / b)
      setCustomResW(String(width))
      setCustomResH(String(height))
    }
  }

  function addPreset(preset: MonitorPreset) {
    // Place at the center of the visible canvas area
    const ppi = calculatePPI(preset.resolutionX, preset.resolutionY, preset.diagonal)
    const { width: physW, height: physH } = calculatePhysicalDimensions(preset.resolutionX, preset.resolutionY, ppi)

    // Get the visible canvas center in physical coordinates
    // The canvas container is the sibling element, so approximate using window size
    const containerEl = document.querySelector('[data-editor-canvas]')
    const canvasW = containerEl?.clientWidth ?? window.innerWidth
    const canvasH = containerEl?.clientHeight ?? (window.innerHeight - 150)
    const centerPhysX = (canvasW / 2 - state.canvasOffsetX) / state.canvasScale
    const centerPhysY = (canvasH / 2 - state.canvasOffsetY) / state.canvasScale

    // Offset slightly for each new monitor so they don't stack exactly
    const jitter = state.monitors.length * 1.5
    const x = centerPhysX - physW / 2 + jitter
    const y = centerPhysY - physH / 2 + jitter

    dispatch({ type: 'ADD_MONITOR', preset, x, y })
  }

  const MAX_ASPECT_RATIO = 10
  const MIN_DIAGONAL = 5
  const MAX_DIAGONAL = 120

  function getCustomRes(): { resW: number; resH: number } {
    if (useCustomRes) {
      return { resW: parseInt(customResW) || 1920, resH: parseInt(customResH) || 1080 }
    }
    const res = filteredResolutions[customResIdx]
    return res ? { resW: res.w, resH: res.h } : { resW: 1920, resH: 1080 }
  }

  const customValidationWarnings = useMemo(() => {
    const warnings: string[] = []
    const diag = parseFloat(customDiagonal)
    if (Number.isNaN(diag) || diag < MIN_DIAGONAL) {
      warnings.push(`Diagonal must be at least ${MIN_DIAGONAL}".`)
    } else if (diag > MAX_DIAGONAL) {
      warnings.push(`Diagonal cannot exceed ${MAX_DIAGONAL}".`)
    }
    const { resW, resH } = getCustomRes()
    if (resW > 0 && resH > 0) {
      const ratio = Math.max(resW, resH) / Math.min(resW, resH)
      if (ratio > MAX_ASPECT_RATIO) {
        warnings.push(`Aspect ratio cannot exceed ${MAX_ASPECT_RATIO}:1 (e.g. ${MAX_ASPECT_RATIO}:1 or 1:${MAX_ASPECT_RATIO}).`)
      }
    }
    return warnings
  }, [customDiagonal, useCustomRes, customResW, customResH, customResIdx, filteredResolutions])

  function addCustom() {
    if (customValidationWarnings.length > 0) return
    const { resW, resH } = getCustomRes()
    const res = filteredResolutions[customResIdx]
    if (!useCustomRes && !res) return
    const diagonal = parseFloat(customDiagonal) || 27
    const preset: MonitorPreset = {
      name: `Custom ${diagonal}" ${resW}x${resH}`,
      diagonal,
      aspectRatio: customAspect,
      resolutionX: resW,
      resolutionY: resH,
    }
    addPreset(preset)
    setShowCustom(false)
  }

  const filtered = MONITOR_PRESETS.filter(p =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  )

  // Group presets
  const laptops = filtered.filter(p => p.diagonal < 20)
  const standard = filtered.filter(p => p.diagonal >= 20 && p.aspectRatio[0] === 16)
  const ultrawides = filtered.filter(p => p.aspectRatio[0] >= 21)

  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-8 left-8 z-30 flex items-center gap-1.5 bg-gray-800/90 hover:bg-gray-700 border border-gray-600/50 hover:border-gray-500 backdrop-blur-sm text-gray-300 hover:text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-lg transition-all"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        Add a Monitor
      </button>
    )
  }

  return (
    <div
      className="absolute top-7 left-7 bottom-2 w-72 z-30 bg-gray-900 border border-gray-700 rounded-lg flex flex-col overflow-hidden shadow-xl"
    >
          {/* Header with title and collapse button */}
          <div className="p-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">
              Add a Monitor
            </h2>
            <button
              onClick={() => setCollapsed(true)}
              className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 -mr-1"
              title="Collapse sidebar"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Presets section */}
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Monitor Presets
            </h3>
            <input
              type="text"
              placeholder="Search presets..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {laptops.length > 0 && (
              <PresetGroup title="Laptops" presets={laptops} onAdd={addPreset} unit={state.unit} canvasScale={state.canvasScale} nextColorIndex={state.monitors.length} />
            )}
            {standard.length > 0 && (
              <PresetGroup title="Standard Monitors" presets={standard} onAdd={addPreset} unit={state.unit} canvasScale={state.canvasScale} nextColorIndex={state.monitors.length} />
            )}
            {ultrawides.length > 0 && (
              <PresetGroup title="Ultrawides" presets={ultrawides} onAdd={addPreset} unit={state.unit} canvasScale={state.canvasScale} nextColorIndex={state.monitors.length} />
            )}
          </div>

          <div className="p-3 border-t border-gray-800">
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors"
          >
            + Custom Monitor
          </button>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300">Custom Monitor</h3>
            <div>
              <label className="text-xs text-gray-500">Diagonal (inches)</label>
              <input
                type="number"
                value={customDiagonal}
                onChange={e => setCustomDiagonal(e.target.value)}
                step="0.1"
                placeholder="5–120"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Aspect Ratio</label>
              <select
                value={`${customAspect[0]}:${customAspect[1]}`}
                onChange={e => {
                  const [a, b] = e.target.value.split(':').map(Number)
                  handleAspectChange(a, b)
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {COMMON_ASPECT_RATIOS.map(([a, b]) => (
                  <option key={`${a}:${b}`} value={`${a}:${b}`}>{a}:{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Resolution</label>
              {!useCustomRes && filteredResolutions.length > 0 ? (
                <>
                  <select
                    value={customResIdx}
                    onChange={e => setCustomResIdx(parseInt(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    {filteredResolutions.map((r, i) => (
                      <option key={i} value={i}>{r.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setUseCustomRes(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                  >
                    Enter custom resolution
                  </button>
                </>
              ) : (
                <>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="number"
                      value={customResW}
                      onChange={e => setCustomResW(e.target.value)}
                      min="640"
                      max="15360"
                      placeholder="Width"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">x</span>
                    <input
                      type="number"
                      value={customResH}
                      onChange={e => setCustomResH(e.target.value)}
                      min="480"
                      max="8640"
                      placeholder="Height"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {filteredResolutions.length > 0 && (
                    <button
                      onClick={() => { setUseCustomRes(false); setCustomResIdx(0) }}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                    >
                      Use preset resolution
                    </button>
                  )}
                </>
              )}
            </div>
            {customValidationWarnings.length > 0 && (
              <div className="rounded bg-amber-950/50 border border-amber-700/50 px-2.5 py-2 space-y-1">
                {customValidationWarnings.map((msg, i) => (
                  <p key={i} className="text-xs text-amber-200">
                    {msg}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={addCustom}
                disabled={customValidationWarnings.length > 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm py-1.5 rounded transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-1.5 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MONITOR_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
]

/**
 * Build a canvas-based drag image that looks like the monitor rectangle
 * as it will appear on the editor canvas. Returns the canvas element and
 * the offset (center point) so the cursor sits in the middle.
 */
function buildDragImage(preset: MonitorPreset, index: number, canvasScale: number): { canvas: HTMLCanvasElement; offsetX: number; offsetY: number } {
  const ppi = calculatePPI(preset.resolutionX, preset.resolutionY, preset.diagonal)
  const { width: physW, height: physH } = calculatePhysicalDimensions(preset.resolutionX, preset.resolutionY, ppi)

  // Match the canvas zoom scale, but cap to avoid browser drag image limits
  const MAX_DRAG_DIM = 280
  let w = Math.round(physW * canvasScale)
  let h = Math.round(physH * canvasScale)
  if (w > MAX_DRAG_DIM || h > MAX_DRAG_DIM) {
    const downscale = MAX_DRAG_DIM / Math.max(w, h)
    w = Math.round(w * downscale)
    h = Math.round(h * downscale)
  }
  // Ensure minimum size so it's always visible
  w = Math.max(w, 40)
  h = Math.max(h, 20)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  // Position off-screen so it doesn't flash when briefly added to the DOM
  canvas.style.position = 'fixed'
  canvas.style.top = '-9999px'
  canvas.style.left = '-9999px'

  const ctx = canvas.getContext('2d')!

  const color = MONITOR_COLORS[index % MONITOR_COLORS.length]

  // Background fill (semi-transparent, like the canvas monitor)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.18
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 3)
  ctx.fill()

  // Border
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 3)
  ctx.stroke()

  // Only draw labels if the rectangle is large enough to read them (pinned to bottom)
  ctx.globalAlpha = 1
  if (w > 60 && h > 30) {
    const labelW = Math.min(w - 8, 200)
    const showDetails = w > 100 && h > 44
    const labelH = showDetails ? 44 : 28
    const labelY = h - labelH - 4
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.roundRect(4, labelY, labelW, labelH, 3)
    ctx.fill()

    // Monitor name
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 0.9
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.fillText(preset.name, 8, labelY + 14, labelW - 8)

    // Resolution subtitle
    if (showDetails) {
      ctx.globalAlpha = 0.8
      ctx.fillStyle = '#94a3b8'
      ctx.font = '9px system-ui, sans-serif'
      ctx.fillText(`${preset.resolutionX}x${preset.resolutionY}  ·  ${Math.round(ppi)} PPI`, 8, labelY + 28, labelW - 8)
    }
  }

  return { canvas, offsetX: Math.round(w / 2), offsetY: Math.round(h / 2) }
}

function PresetGroup({
  title,
  presets,
  onAdd,
  unit,
  canvasScale,
  nextColorIndex,
}: {
  title: string
  presets: MonitorPreset[]
  onAdd: (p: MonitorPreset) => void
  unit: 'inches' | 'cm'
  canvasScale: number
  nextColorIndex: number
}) {
  const handleDragStart = (e: React.DragEvent, preset: MonitorPreset) => {
    e.dataTransfer.setData('application/monitor-preset', JSON.stringify(preset))
    e.dataTransfer.effectAllowed = 'copy'

    const { canvas, offsetX, offsetY } = buildDragImage(preset, nextColorIndex, canvasScale)
    // The element must be in the DOM for setDragImage to work in all browsers
    document.body.appendChild(canvas)
    e.dataTransfer.setDragImage(canvas, offsetX, offsetY)
    // Remove after the browser has captured the image
    requestAnimationFrame(() => document.body.removeChild(canvas))
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">
        {title}
      </h3>
      <div className="space-y-1">
        {presets.map((preset, i) => {
          const ppi = calculatePPI(preset.resolutionX, preset.resolutionY, preset.diagonal)
          const { width, height } = calculatePhysicalDimensions(preset.resolutionX, preset.resolutionY, ppi)
          return (
            <button
              key={`${preset.name}-${i}`}
              draggable
              onClick={() => onAdd(preset)}
              onDragStart={(e) => handleDragStart(e, preset)}
              className="w-full text-left bg-gray-800 hover:bg-gray-750 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded p-2 transition-colors group cursor-grab active:cursor-grabbing"
            >
              <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                {preset.name}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {preset.resolutionX}x{preset.resolutionY} &middot;{' '}
                {formatDimension(width, unit)} x {formatDimension(height, unit)} &middot;{' '}
                {Math.round(ppi)} PPI
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
