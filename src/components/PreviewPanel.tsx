import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react'
import { useStore } from '../store'
import { useToast } from './Toast'
import { generateOutput, type OutputResult } from '../generateOutput'
import { getMonitorDisplayName } from '../utils'
import { IconEyedropper } from '../icons'
import type { FillMode } from '../types'

/** Solid fill preset colors for quick select. */
const FILL_PRESET_BLACK = '#000000'
const FILL_PRESET_WHITE = '#ffffff'
const FILL_PRESET_DARK_GRAY = '#1a1a1a'

const CHECKERBOARD_CELL_PX = 8

export default function PreviewPanel() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [output, setOutput] = useState<OutputResult | null>(null)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [jpegQuality, setJpegQuality] = useState(92)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [downloadFilename, setDownloadFilename] = useState('')
  const [showEmptyAreaOptions, setShowEmptyAreaOptions] = useState(false)
  const downloadPopoverRef = useRef<HTMLDivElement>(null)
  const emptyAreaPopoverRef = useRef<HTMLDivElement>(null)
  const emptyAreaTriggerRef = useRef<HTMLButtonElement>(null)
  const debounceRef = useRef<number | null>(null)

  // Debounced output generation
  useEffect(() => {
    if (state.monitors.length === 0) {
      setOutput(null)
      return
    }

    setIsGenerating(true)

    if (debounceRef.current) {
      cancelAnimationFrame(debounceRef.current)
    }

    debounceRef.current = requestAnimationFrame(() => {
      const result = generateOutput(state.monitors, state.sourceImage, state.windowsArrangement, {
        mode: state.fillMode,
        solidColor: state.fillSolidColor,
      })
      setOutput(result)
      setIsGenerating(false)
    })

    return () => {
      if (debounceRef.current) {
        cancelAnimationFrame(debounceRef.current)
      }
    }
  }, [state.monitors, state.sourceImage, state.windowsArrangement, state.fillMode, state.fillSolidColor])

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !output) return

    const ctx = canvas.getContext('2d')!
    // p-8 = 32px each side (64 total); canvas has border-2 = 4px extra per axis
    const containerWidth = container.clientWidth - 64 - 4
    const containerHeight = container.clientHeight - 64 - 4

    // Scale to fit container
    const displayScale = Math.min(1, containerWidth / output.width, containerHeight / output.height)
    canvas.width = Math.round(output.width * displayScale)
    canvas.height = Math.round(output.height * displayScale)

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
    ctx.drawImage(output.canvas, 0, 0, canvas.width, canvas.height)

    // Draw monitor strip boundaries and labels (each at its actual position)
    for (const strip of output.monitors) {
      const x = Math.round(strip.stripX * displayScale)
      const y = Math.round(strip.stripY * displayScale)
      const w = Math.round(strip.stripWidth * displayScale)
      const h = Math.round(strip.stripHeight * displayScale)

      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)

      // Label at top of this monitor
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(x, y, w, 18)
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      const label = `${getMonitorDisplayName(strip.monitor)} (${strip.stripWidth}x${strip.stripHeight})`
      ctx.fillText(label, x + w / 2, y + 12, w - 4)
    }
  }, [output, state.fillMode])

  const getDefaultFilename = useCallback(() => {
    if (!output) return 'spanright'
    const srcName = state.sourceImage?.fileName
    const baseName = srcName ? srcName.replace(/\.[^.]+$/, '') : 'wallpaper'
    return `spanright-${baseName}-${output.width}x${output.height}`
  }, [output, state.sourceImage])

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
    if (state.fillMode === 'transparent' && format === 'jpeg') {
      setFormat('png')
    }
  }, [state.fillMode, format])

  // Close empty area popover when layout no longer has empty area
  useEffect(() => {
    if (output && !output.hasBlackBars) setShowEmptyAreaOptions(false)
  }, [output?.hasBlackBars])

  const effectiveFormat = state.fillMode === 'transparent' ? 'png' : format

  const doDownload = useCallback((filename: string) => {
    if (!output) return
    const mimeType = effectiveFormat === 'png' ? 'image/png' : 'image/jpeg'
    const quality = effectiveFormat === 'jpeg' ? jpegQuality / 100 : undefined
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
  }, [output, effectiveFormat, jpegQuality, getDefaultFilename, toast])

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
          {output && (
            <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
              {output.width} x {output.height} px
            </span>
          )}
          {isGenerating && (
            <span className="text-xs text-blue-400 animate-pulse">Generating...</span>
          )}
          {!state.sourceImage && state.monitors.length > 0 && (
            <span className="text-xs text-yellow-500">Upload an image to preview output</span>
          )}
        </div>

        {output && (
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
                onClick={() => output?.hasBlackBars && setShowEmptyAreaOptions((v) => !v)}
                disabled={!output?.hasBlackBars}
                className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                title={output?.hasBlackBars ? 'Options for empty area (regions not covered by the image)' : 'No empty area in this setup'}
              >
                Empty area options
              </button>
                {showEmptyAreaOptions && (
                  <div
                    ref={emptyAreaPopoverRef}
                    className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden"
                  >
                    {/* Banner first — always on top of color/fill controls */}
                    <div className="px-3 py-2 bg-gray-800/80 border-b border-gray-700/50 space-y-1">
                      <p className="text-xs text-gray-400">
                        Empty area is normal — it fills the space around your displays and won&apos;t be visible on the monitors.
                      </p>
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
                          title="Fill mode for empty area (regions not covered by the image)"
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
                value={format}
                onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpeg" disabled={state.fillMode === 'transparent'}>
                  JPEG{state.fillMode === 'transparent' ? ' (n/a)' : ''}
                </option>
              </select>
              {format === 'jpeg' && (
                <div className="flex items-center gap-1">
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={jpegQuality}
                    onChange={(e) => setJpegQuality(parseInt(e.target.value))}
                    className="w-16 h-1 accent-blue-500"
                  />
                  <span className="text-xs text-gray-400 w-8">{jpegQuality}%</span>
                </div>
              )}
            </div>
            <div className="relative" ref={downloadPopoverRef}>
              <button
                onClick={openDownloadDialog}
                disabled={!state.sourceImage}
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
          className="border-2 border-gray-600 rounded bg-black"
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
