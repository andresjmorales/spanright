import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, type FormEvent } from 'react'
import { useStore } from '../store'
import { useToast } from './Toast'
import { generateOutput, computeOutputLayout, type OutputResult, type OutputLayout } from '../generateOutput'
import { getMonitorDisplayName } from '../utils'
import { IconEyedropper } from '../icons'
import type { FillMode, Monitor, SourceImage, WindowsMonitorPosition } from '../types'

/** Solid fill preset colors for quick select. */
const FILL_PRESET_BLACK = '#000000'
const FILL_PRESET_WHITE = '#ffffff'
const FILL_PRESET_DARK_GRAY = '#1a1a1a'

const CHECKERBOARD_CELL_PX = 8

/** Everything the generated output depends on. Store updates are immutable, so reference equality is exact. */
interface PreviewInputs {
  monitors: Monitor[]
  images: SourceImage[]
  windowsArrangement: WindowsMonitorPosition[]
  fillMode: FillMode
  fillSolidColor: string
}

function sameInputs(a: PreviewInputs, b: PreviewInputs): boolean {
  return a.monitors === b.monitors && a.images === b.images && a.windowsArrangement === b.windowsArrangement &&
    a.fillMode === b.fillMode && a.fillSolidColor === b.fillSolidColor
}

/**
 * Last generated preview, kept at module level because this panel unmounts whenever another tab is
 * shown. Coming back with nothing changed reuses it instantly instead of regenerating; coming back
 * after edits shows it dimmed as a placeholder while the new output renders.
 */
let lastPreview: { inputs: PreviewInputs; output: OutputResult } | null = null

export default function PreviewPanel() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputs = useMemo<PreviewInputs>(() => ({
    monitors: state.monitors,
    images: state.images,
    windowsArrangement: state.windowsArrangement,
    fillMode: state.fillMode,
    fillSolidColor: state.fillSolidColor,
  }), [state.monitors, state.images, state.windowsArrangement, state.fillMode, state.fillSolidColor])
  /** Strip layout of the output; cheap, so the placeholder can match the real shape. */
  const layout = useMemo(() => computeOutputLayout(state.monitors, state.windowsArrangement), [state.monitors, state.windowsArrangement])
  const [output, setOutput] = useState<OutputResult | null>(() =>
    lastPreview && sameInputs(lastPreview.inputs, inputs) ? lastPreview.output : null)
  /**
   * Shown until the first output of this mount is ready: the previous preview (dimmed) when it has the
   * same dimensions as the new layout, otherwise null and a skeleton of the layout is drawn instead.
   */
  const [stalePreview] = useState<OutputResult | null>(() => {
    if (!lastPreview || sameInputs(lastPreview.inputs, inputs) || !layout) return null
    const prev = lastPreview.output
    return prev.width === layout.width && prev.height === layout.height ? prev : null
  })
  const [isGenerating, setIsGenerating] = useState(() => !output && state.monitors.length > 0)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [downloadFilename, setDownloadFilename] = useState('')
  const [showEmptyAreaOptions, setShowEmptyAreaOptions] = useState(false)
  const downloadPopoverRef = useRef<HTMLDivElement>(null)
  const emptyAreaPopoverRef = useRef<HTMLDivElement>(null)
  const emptyAreaTriggerRef = useRef<HTMLButtonElement>(null)

  // Output generation. Deferred until after the next paint (rAF + timeout) so the placeholder shows
  // before the heavy work blocks the main thread; skipped entirely when the cached output still matches.
  useEffect(() => {
    if (inputs.monitors.length === 0) {
      setOutput(null)
      setIsGenerating(false)
      return
    }
    if (lastPreview && sameInputs(lastPreview.inputs, inputs)) {
      setOutput(lastPreview.output)
      setIsGenerating(false)
      return
    }

    setIsGenerating(true)
    let timer: number | undefined
    const raf = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        const result = generateOutput(inputs.monitors, inputs.images, inputs.windowsArrangement, {
          mode: inputs.fillMode,
          solidColor: inputs.fillSolidColor,
        })
        lastPreview = result ? { inputs, output: result } : null
        setOutput(result)
        setIsGenerating(false)
      }, 0)
    })

    return () => {
      cancelAnimationFrame(raf)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [inputs])

  /** What the canvas shows: fresh output, else the dimmed previous preview, else a layout skeleton. */
  const displayed: OutputResult | null = output ?? stalePreview
  const showingPlaceholder = !output
  /** Header info, available as soon as the layout is known. */
  const info = output ?? stalePreview ?? (layout ? { ...layout, hasEmptyArea: false, hasUncoveredMonitorArea: false } : null)

  // Draw preview. Layout effect so the first paint after switching tabs already has content.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const frame: OutputLayout | null = displayed ? { width: displayed.width, height: displayed.height, strips: displayed.monitors } : layout
    if (!canvas || !container || !frame) return

    const ctx = canvas.getContext('2d')!
    // p-8 = 32px each side (64 total); canvas has border-2 = 4px extra per axis
    const containerWidth = container.clientWidth - 64 - 4
    const containerHeight = container.clientHeight - 64 - 4

    // Scale to fit container
    const displayScale = Math.min(1, containerWidth / frame.width, containerHeight / frame.height)
    canvas.width = Math.round(frame.width * displayScale)
    canvas.height = Math.round(frame.height * displayScale)

    if (state.fillMode === 'transparent') {
      for (let cy = 0; cy < canvas.height; cy += CHECKERBOARD_CELL_PX) {
        for (let cx = 0; cx < canvas.width; cx += CHECKERBOARD_CELL_PX) {
          ctx.fillStyle = (Math.floor(cx / CHECKERBOARD_CELL_PX) + Math.floor(cy / CHECKERBOARD_CELL_PX)) % 2 === 0 ? '#333333' : '#444444'
          ctx.fillRect(cx, cy, CHECKERBOARD_CELL_PX, CHECKERBOARD_CELL_PX)
        }
      }
    } else {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    if (displayed) {
      ctx.drawImage(displayed.canvas, 0, 0, canvas.width, canvas.height)
    }

    // Strip rects in preview pixels. Round each edge (not the width) so neighbouring strips share
    // exactly the same boundary pixel instead of leaving a gap or overlap.
    const stripRects = frame.strips.map(strip => {
      const x = Math.round(strip.stripX * displayScale)
      const y = Math.round(strip.stripY * displayScale)
      const right = Math.round((strip.stripX + strip.stripWidth) * displayScale)
      const bottom = Math.round((strip.stripY + strip.stripHeight) * displayScale)
      return { strip, x, y, w: right - x, h: bottom - y }
    })

    // Skeleton (nothing generated yet): fill each monitor's strip so the placeholder has the real shape
    if (!displayed) {
      ctx.fillStyle = '#1f2937'
      for (const { x, y, w, h } of stripRects) ctx.fillRect(x, y, w, h)
    }

    // Labels at the top of each monitor
    for (const { strip, x, y, w } of stripRects) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(x, y, w, 18)
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      const label = `${getMonitorDisplayName(strip.monitor)} (${strip.stripWidth}x${strip.stripHeight})`
      ctx.fillText(label, x + w / 2, y + 12, w - 4)
    }

    // Strip boundaries as one path, after the labels so the lines run unbroken. Each edge sits on
    // the strip's first pixel column/row (right/bottom edges on the pixel just past the strip, i.e.
    // the neighbour's first pixel), so a shared edge between adjacent monitors is a single line.
    ctx.beginPath()
    for (const { x, y, w, h } of stripRects) {
      const l = x + 0.5
      const t = y + 0.5
      const r = Math.min(x + w, canvas.width - 1) + 0.5
      const b = Math.min(y + h, canvas.height - 1) + 0.5
      ctx.rect(l, t, r - l, b - t)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [displayed, layout, state.fillMode])

  const getDefaultFilename = useCallback(() => {
    if (!output) return 'spanright'
    const srcName = state.images[0]?.fileName
    const baseName = srcName ? srcName.replace(/\.[^.]+$/, '') : 'wallpaper'
    return `spanright-${baseName}-${output.width}x${output.height}`
  }, [output, state.images])

  const openDownloadDialog = useCallback(() => {
    setDownloadFilename(getDefaultFilename())
    setShowDownloadDialog(true)
  }, [getDefaultFilename])

  // Close download popover on outside click
  useEffect(() => {
    if (!showDownloadDialog) return
    const handler = (e: MouseEvent) => {
      if (downloadPopoverRef.current && !downloadPopoverRef.current.contains(e.target as Node)) {
        setShowDownloadDialog(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDownloadDialog])

  // Close empty area popover on outside click
  useEffect(() => {
    if (!showEmptyAreaOptions) return
    const handler = (e: MouseEvent) => {
      if (emptyAreaPopoverRef.current && !emptyAreaPopoverRef.current.contains(e.target as Node) &&
          emptyAreaTriggerRef.current && !emptyAreaTriggerRef.current.contains(e.target as Node)) {
        setShowEmptyAreaOptions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmptyAreaOptions])

  // Auto-switch to PNG when transparent fill is selected
  useEffect(() => {
    if (state.fillMode === 'transparent' && state.outputFormat === 'jpeg') {
      dispatch({ type: 'SET_OUTPUT_FORMAT', format: 'png' })
    }
  }, [state.fillMode, state.outputFormat, dispatch])

  // Close empty area popover when layout no longer has empty area
  useEffect(() => {
    if (output && !output.hasEmptyArea) setShowEmptyAreaOptions(false)
  }, [output?.hasEmptyArea])

  const effectiveFormat = state.fillMode === 'transparent' ? 'png' : state.outputFormat

  const doDownload = useCallback((filename: string) => {
    if (!output) return
    const mimeType = effectiveFormat === 'png' ? 'image/png' : 'image/jpeg'
    const quality = effectiveFormat === 'jpeg' ? state.jpegQuality / 100 : undefined
    const cleanName = filename.trim() || getDefaultFilename()

    output.canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${cleanName}.${effectiveFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Wallpaper downloaded')
    }, mimeType, quality)
    setShowDownloadDialog(false)
  }, [output, effectiveFormat, state.jpegQuality, getDefaultFilename, toast])

  if (state.monitors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-600 text-sm py-2">
          Add monitors and upload an image to see the output preview
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — two-row min-height on mobile so controls don't overflow; single-row on sm+ */}
      <div className="flex items-center justify-between px-4 min-h-[4.5rem] sm:min-h-0 sm:h-11 border-b border-gray-800 bg-gray-900 shrink-0 flex-wrap gap-2 py-2 sm:py-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Output Preview
          </h2>
          {info && (
            <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
              {info.width} x {info.height} px
            </span>
          )}
          {isGenerating && (
            <span className="text-xs text-blue-400 animate-pulse">Generating...</span>
          )}
          {state.images.length === 0 && state.monitors.length > 0 && (
            <span className="text-xs text-yellow-500">Upload an image to preview output</span>
          )}
        </div>

        {info && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch({ type: 'SET_SHOW_TROUBLESHOOTING_GUIDE', value: true })}
              className="hidden md:inline text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2 decoration-gray-600 hover:decoration-gray-400 shrink-0"
            >
              Wallpaper not looking right?
            </button>
            {/* Empty area options — always visible; disabled with tooltip when no empty area */}
            <div className="relative">
              <button
                ref={emptyAreaTriggerRef}
                type="button"
                onClick={() => info?.hasEmptyArea && setShowEmptyAreaOptions((v) => !v)}
                disabled={!info?.hasEmptyArea}
                className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                title={info?.hasEmptyArea ? 'Options for empty area (regions not covered by any image)' : 'No empty area in this setup'}
              >
                Empty area options
              </button>
                {showEmptyAreaOptions && (
                  <div
                    ref={emptyAreaPopoverRef}
                    className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:top-28 max-sm:w-auto max-sm:mt-0"
                  >
                    {/* Banner first — always on top of color/fill controls */}
                    <div className="px-3 py-2 bg-gray-800/80 border-b border-gray-700/50 space-y-1">
                      {info?.hasUncoveredMonitorArea ? (
                        <p className="text-xs text-yellow-500/90">
                          Part of a monitor isn&apos;t covered by any image, so that area will show this fill on screen.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">
                          Empty area is normal. It fills the space around your displays and won&apos;t be visible on the monitors.
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {state.fillMode === 'solid'
                          ? 'Fill: Solid color'
                          : state.fillMode === 'blur'
                            ? 'Fill: Blurred edge extension'
                            : 'Fill: Transparent (PNG only)'}
                      </p>
                    </div>
                    <div className="p-3 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Fill</label>
                        <select
                          value={state.fillMode}
                          onChange={(e) => dispatch({ type: 'SET_FILL_MODE', mode: e.target.value as FillMode })}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                          title="Fill mode for empty area (regions not covered by any image)"
                        >
                          <option value="solid">Solid color</option>
                          <option value="blur">Blurred edge extension</option>
                          <option value="transparent">Transparent (PNG only)</option>
                        </select>
                      </div>
                      {state.fillMode === 'solid' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="relative w-7 h-7 rounded border border-gray-600 cursor-pointer overflow-hidden shrink-0" title="Pick fill color">
                              <span className="block w-full h-full" style={{ backgroundColor: state.fillSolidColor }} />
                              <input
                                type="color"
                                value={state.fillSolidColor}
                                onChange={(e) => dispatch({ type: 'SET_FILL_SOLID_COLOR', color: e.target.value })}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                            </label>
                            <span className="text-xs text-gray-500">Presets:</span>
                            {[
                              { color: FILL_PRESET_BLACK, label: 'Black' },
                              { color: FILL_PRESET_WHITE, label: 'White' },
                              { color: FILL_PRESET_DARK_GRAY, label: 'Dark gray' },
                            ].map(({ color, label }) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => dispatch({ type: 'SET_FILL_SOLID_COLOR', color })}
                                className={`w-6 h-6 rounded border shrink-0 ${state.fillSolidColor === color ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-600 hover:border-gray-500'}`}
                                style={{ backgroundColor: color }}
                                title={label}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({ type: 'SET_EYEDROPPER_ACTIVE', active: !state.eyedropperActive })
                                if (!state.eyedropperActive) dispatch({ type: 'SET_ACTIVE_TAB', tab: 'physical' })
                              }}
                              className={`w-7 h-7 flex items-center justify-center rounded border shrink-0 ${
                                state.eyedropperActive ? 'border-blue-500 bg-blue-600/30 text-blue-300' : 'border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500'
                              }`}
                              title="Eyedropper: click on source image to sample color"
                            >
                              <IconEyedropper className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      {state.fillMode === 'transparent' && (
                        <p className="text-xs text-gray-500">Transparent fill requires PNG format.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            <div className="flex items-center gap-2">
              <select
                value={state.outputFormat}
                onChange={(e) => dispatch({ type: 'SET_OUTPUT_FORMAT', format: e.target.value as 'png' | 'jpeg' })}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpeg" disabled={state.fillMode === 'transparent'}>
                  JPEG{state.fillMode === 'transparent' ? ' (n/a)' : ''}
                </option>
              </select>
              {state.outputFormat === 'jpeg' && (
                <div className="flex items-center gap-1">
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={state.jpegQuality}
                    onChange={(e) => dispatch({ type: 'SET_JPEG_QUALITY', quality: parseInt(e.target.value, 10) || 92 })}
                    className="w-16 h-1 accent-blue-500"
                  />
                  <span className="text-xs text-gray-400 w-8">{state.jpegQuality}%</span>
                </div>
              )}
            </div>
            <div className="relative" ref={downloadPopoverRef}>
              <button
                onClick={openDownloadDialog}
                disabled={state.images.length === 0 || !output}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs py-1 px-2.5 rounded border border-gray-600 disabled:border-gray-700 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              {showDownloadDialog && (
                <form
                  className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3 z-50"
                  onSubmit={(e: FormEvent) => { e.preventDefault(); doDownload(downloadFilename) }}
                >
                  <div className="text-xs font-medium text-gray-400 mb-2">Save as</div>
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={downloadFilename}
                      onChange={(e) => setDownloadFilename(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-600 focus:border-blue-500 rounded px-2.5 py-1.5 text-sm text-gray-100 outline-none transition-colors"
                      placeholder="filename"
                    />
                    <span className="text-xs text-gray-500 shrink-0">.{effectiveFormat}</span>
                  </div>
                  <div className="flex justify-end gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => setShowDownloadDialog(false)}
                      className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Download
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>



      {/* Preview canvas — background matches canvas workspace (#0a0a1a) so empty area stands out */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-8 overflow-auto bg-[#12122a]">
        <canvas
          ref={canvasRef}
          className={`border-2 border-gray-600 rounded bg-black transition-[filter,opacity] duration-200 ${
            showingPlaceholder ? (displayed ? 'grayscale-[60%] blur-[2px] opacity-70' : 'animate-pulse') : ''
          }`}
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Windows arrangement info */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-900 shrink-0">
        <div className="text-xs text-gray-500">
          Output uses your virtual layout for monitor ordering and horizontal/vertical offsets, and physical layout for cropping sections of your image.
        </div>
      </div>

    </div>
  )
}
