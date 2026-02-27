import { useState, useMemo } from 'react'
import { MONITOR_PRESETS, COMMON_ASPECT_RATIOS, COMMON_RESOLUTIONS } from '../presets'
import type { MonitorPreset } from '../types'
import { useStore } from '../store'
import { useToast } from './Toast'
import { calculatePPI, calculatePhysicalDimensions, formatDimension } from '../utils'

const PRESET_GROUP_CONTENT_ID_PREFIX = 'preset-group-'

export default function MonitorPresetsSidebar() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [showCustom, setShowCustom] = useState(false)
  const [customDiagonal, setCustomDiagonal] = useState('27')
  const [customAspect, setCustomAspect] = useState<[number, number]>([16, 9])
  const [customResIdx, setCustomResIdx] = useState(0)
  const [useCustomRes, setUseCustomRes] = useState(false)
  const [customResW, setCustomResW] = useState('2560')
  const [customResH, setCustomResH] = useState('1440')
  const [searchFilter, setSearchFilter] = useState('')
  const [lockAspect, setLockAspect] = useState(true)

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

    // If we're in custom resolution mode, keep using custom fields and, when locked, reconcile to the new aspect.
    if (useCustomRes) {
      if (lockAspect) {
        const width = parseInt(customResW, 10)
        const height = parseInt(customResH, 10)
        if (!Number.isNaN(width) && width > 0) {
          const newH = Math.round(width * b / a)
          setCustomResH(String(newH))
        } else if (!Number.isNaN(height) && height > 0) {
          const newW = Math.round(height * a / b)
          setCustomResW(String(newW))
        }
      }
      return
    }

    // Preset resolution mode: reset to first matching preset for this aspect (or a reasonable default).
    setCustomResIdx(0)
    setUseCustomRes(false)
    const targetRatio = a / b
    const match = COMMON_RESOLUTIONS.find(r => Math.abs(r.w / r.h - targetRatio) / targetRatio < 0.02)
    if (match) {
      setCustomResW(String(match.w))
      setCustomResH(String(match.h))
    } else {
      // No preset resolution for this ratio, auto-switch to custom entry
      setUseCustomRes(true)
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
    toast.success(`Added ${preset.name}`)
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
    const MIN_CUSTOM_RES_W = 512
    const MIN_CUSTOM_RES_H = 384
    const MAX_CUSTOM_RES_W = 15360
    const MAX_CUSTOM_RES_H = 8640

    if (useCustomRes) {
      const trimmedW = customResW.trim()
      const trimmedH = customResH.trim()
      const w = parseInt(trimmedW, 10)
      const h = parseInt(trimmedH, 10)

      if (!trimmedW || !trimmedH || Number.isNaN(w) || Number.isNaN(h)) {
        warnings.push('Enter both width and height for the custom resolution.')
        return warnings
      }

      const resW = w
      const resH = h

      if (resW < MIN_CUSTOM_RES_W || resH < MIN_CUSTOM_RES_H) {
        warnings.push(`Resolution must be at least ${MIN_CUSTOM_RES_W}x${MIN_CUSTOM_RES_H}.`)
      } else if (resW > MAX_CUSTOM_RES_W || resH > MAX_CUSTOM_RES_H) {
        warnings.push(`Resolution cannot exceed ${MAX_CUSTOM_RES_W}x${MAX_CUSTOM_RES_H}.`)
      } else {
        const ratio = Math.max(resW, resH) / Math.min(resW, resH)
        if (ratio > MAX_ASPECT_RATIO) {
          warnings.push(`Aspect ratio cannot exceed ${MAX_ASPECT_RATIO}:1 (e.g. ${MAX_ASPECT_RATIO}:1 or 1:${MAX_ASPECT_RATIO}).`)
        }
      }
    } else {
      const { resW, resH } = getCustomRes()
      if (resW > 0 && resH > 0) {
        if (resW < MIN_CUSTOM_RES_W || resH < MIN_CUSTOM_RES_H) {
          warnings.push(`Resolution must be at least ${MIN_CUSTOM_RES_W}x${MIN_CUSTOM_RES_H}.`)
        } else if (resW > MAX_CUSTOM_RES_W || resH > MAX_CUSTOM_RES_H) {
          warnings.push(`Resolution cannot exceed ${MAX_CUSTOM_RES_W}x${MAX_CUSTOM_RES_H}.`)
        } else {
          const ratio = Math.max(resW, resH) / Math.min(resW, resH)
          if (ratio > MAX_ASPECT_RATIO) {
            warnings.push(`Aspect ratio cannot exceed ${MAX_ASPECT_RATIO}:1 (e.g. ${MAX_ASPECT_RATIO}:1 or 1:${MAX_ASPECT_RATIO}).`)
          }
        }
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

  const collapsed = state.presetsSidebarCollapsed
  const groupExpanded = state.presetsGroupExpanded

  function toggleGroup(id: 'laptops' | 'standard' | 'ultrawides') {
    dispatch({
      type: 'SET_PRESETS_GROUP_EXPANDED',
      groupId: id,
      expanded: !groupExpanded[id],
    })
  }

  // When eyedropper is active we show the collapsed UI (so canvas has room); collapsed state lives in store so it persists across tab switch.
  if (collapsed || state.eyedropperActive) {
    return (
      <button
        onClick={() => !state.eyedropperActive && dispatch({ type: 'SET_PRESETS_SIDEBAR_COLLAPSED', collapsed: false })}
        disabled={state.eyedropperActive}
        className="absolute top-8 left-8 z-30 flex items-center gap-1.5 bg-gray-800/90 hover:bg-gray-700 border border-gray-600/50 hover:border-gray-500 backdrop-blur-sm text-gray-300 hover:text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-800/90 disabled:hover:border-gray-600/50"
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
              onClick={() => dispatch({ type: 'SET_PRESETS_SIDEBAR_COLLAPSED', collapsed: true })}
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
              <PresetGroup
                groupId="laptops"
                title="Laptops"
                expanded={groupExpanded.laptops}
                onToggle={() => toggleGroup('laptops')}
                presets={laptops}
                onAdd={addPreset}
                unit={state.unit}
                canvasScale={state.canvasScale}
                nextColorIndex={state.monitors.length}
              />
            )}
            {standard.length > 0 && (
              <PresetGroup
                groupId="standard"
                title="Standard Monitors"
                expanded={groupExpanded.standard}
                onToggle={() => toggleGroup('standard')}
                presets={standard}
                onAdd={addPreset}
                unit={state.unit}
                canvasScale={state.canvasScale}
                nextColorIndex={state.monitors.length}
              />
            )}
            {ultrawides.length > 0 && (
              <PresetGroup
                groupId="ultrawides"
                title="Ultrawides"
                expanded={groupExpanded.ultrawides}
                onToggle={() => toggleGroup('ultrawides')}
                presets={ultrawides}
                onAdd={addPreset}
                unit={state.unit}
                canvasScale={state.canvasScale}
                nextColorIndex={state.monitors.length}
              />
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
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
                disabled={useCustomRes && !lockAspect}
                className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 ${
                  useCustomRes && !lockAspect
                    ? 'border-gray-800 text-gray-600 cursor-not-allowed opacity-70'
                    : 'border-gray-700 text-gray-200'
                }`}
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
                    className="w-full h-8 bg-gray-800 border border-gray-700 rounded px-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    {filteredResolutions.map((r, i) => (
                      <option key={i} value={i}>{r.label}</option>
                    ))}
                  </select>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="h-3.5 w-3.5" aria-hidden="true" />
                    <button
                      onClick={() => {
                        const selected = filteredResolutions[customResIdx]
                        if (selected) {
                          setCustomResW(String(selected.w))
                          setCustomResH(String(selected.h))
                        }
                        setUseCustomRes(true)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                    >
                      Enter custom resolution
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="number"
                      value={customResW}
                      onChange={e => {
                        const value = e.target.value
                        setCustomResW(value)
                        if (lockAspect) {
                          const w = parseInt(value, 10)
                          if (!Number.isNaN(w) && w > 0) {
                            const [a, b] = customAspect
                            const h = Math.round(w * b / a)
                            setCustomResH(String(h))
                          }
                        }
                      }}
                      min="512"
                      max="15360"
                      placeholder="Width"
                      className="flex-1 h-8 bg-gray-800 border border-gray-700 rounded px-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">x</span>
                    <input
                      type="number"
                      value={customResH}
                      onChange={e => {
                        const value = e.target.value
                        setCustomResH(value)
                        if (lockAspect) {
                          const h = parseInt(value, 10)
                          if (!Number.isNaN(h) && h > 0) {
                            const [a, b] = customAspect
                            const w = Math.round(h * a / b)
                            setCustomResW(String(w))
                          }
                        }
                      }}
                      min="384"
                      max="8640"
                      placeholder="Height"
                      className="flex-1 h-8 bg-gray-800 border border-gray-700 rounded px-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={lockAspect}
                        onChange={e => {
                          const next = e.target.checked
                          setLockAspect(next)
                          if (next) {
                            const w = parseInt(customResW, 10)
                            const h = parseInt(customResH, 10)
                            const [a, b] = customAspect
                            if (!Number.isNaN(w) && w > 0) {
                              const newH = Math.round(w * b / a)
                              setCustomResH(String(newH))
                            } else if (!Number.isNaN(h) && h > 0) {
                              const newW = Math.round(h * a / b)
                              setCustomResW(String(newW))
                            }
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
                      />
                      <span>Maintain aspect ratio</span>
                    </label>
                    {filteredResolutions.length > 0 && (
                      <button
                        onClick={() => { setUseCustomRes(false); setCustomResIdx(0) }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Use preset resolution
                      </button>
                    )}
                  </div>
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

type PresetGroupId = 'laptops' | 'standard' | 'ultrawides'

function PresetGroup({
  groupId,
  title,
  expanded,
  onToggle,
  presets,
  onAdd,
  unit,
  canvasScale,
  nextColorIndex,
}: {
  groupId: PresetGroupId
  title: string
  expanded: boolean
  onToggle: () => void
  presets: MonitorPreset[]
  onAdd: (p: MonitorPreset) => void
  unit: 'inches' | 'cm'
  canvasScale: number
  nextColorIndex: number
}) {
  const contentId = `${PRESET_GROUP_CONTENT_ID_PREFIX}${groupId}`

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
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-800/40 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      >
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </span>
      </button>

      <div id={contentId} hidden={!expanded} className="space-y-1 mt-1">
        {expanded && presets.map((preset, i) => {
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
