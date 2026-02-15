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
    // Place at a default position, slightly offset for each new monitor
    const offset = state.monitors.length * 2
    dispatch({ type: 'ADD_MONITOR', preset, x: 5 + offset, y: 5 })
  }

  function addCustom() {
    let resW: number, resH: number
    if (useCustomRes) {
      resW = parseInt(customResW) || 1920
      resH = parseInt(customResH) || 1080
    } else {
      const res = filteredResolutions[customResIdx]
      if (!res) return
      resW = res.w
      resH = res.h
    }
    const preset: MonitorPreset = {
      name: `Custom ${customDiagonal}" ${resW}x${resH}`,
      diagonal: parseFloat(customDiagonal) || 27,
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

  return (
    <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Monitor Presets
        </h2>
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
          <PresetGroup title="Laptops" presets={laptops} onAdd={addPreset} unit={state.unit} canvasScale={state.canvasScale} />
        )}
        {standard.length > 0 && (
          <PresetGroup title="Standard Monitors" presets={standard} onAdd={addPreset} unit={state.unit} canvasScale={state.canvasScale} />
        )}
        {ultrawides.length > 0 && (
          <PresetGroup title="Ultrawides" presets={ultrawides} onAdd={addPreset} unit={state.unit} canvasScale={state.canvasScale} />
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
                min="5"
                max="100"
                step="0.1"
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
            <div className="flex gap-2">
              <button
                onClick={addCustom}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded transition-colors"
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

  // Match the canvas zoom scale so the ghost is the same size as on the editor
  const w = Math.round(physW * canvasScale)
  const h = Math.round(physH * canvasScale)

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

  // Only draw labels if the rectangle is large enough to read them
  ctx.globalAlpha = 1
  if (w > 60 && h > 30) {
    const labelW = Math.min(w - 8, 200)
    const showDetails = w > 100 && h > 44
    const labelH = showDetails ? 44 : 28
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.beginPath()
    ctx.roundRect(4, 4, labelW, labelH, 3)
    ctx.fill()

    // Monitor name
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.fillText(preset.name, 8, 16, labelW - 8)

    // Resolution subtitle
    if (showDetails) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '9px system-ui, sans-serif'
      ctx.fillText(`${preset.resolutionX}x${preset.resolutionY}  ·  ${Math.round(ppi)} PPI`, 8, 30, labelW - 8)
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
}: {
  title: string
  presets: MonitorPreset[]
  onAdd: (p: MonitorPreset) => void
  unit: 'inches' | 'cm'
  canvasScale: number
}) {
  const handleDragStart = (e: React.DragEvent, preset: MonitorPreset, index: number) => {
    e.dataTransfer.setData('application/monitor-preset', JSON.stringify(preset))
    e.dataTransfer.effectAllowed = 'copy'

    const { canvas, offsetX, offsetY } = buildDragImage(preset, index, canvasScale)
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
              onDragStart={(e) => handleDragStart(e, preset, i)}
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
