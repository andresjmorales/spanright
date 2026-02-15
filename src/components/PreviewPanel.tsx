import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store'
import { generateOutput, type OutputResult } from '../generateOutput'

export default function PreviewPanel() {
  const { state } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [output, setOutput] = useState<OutputResult | null>(null)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [jpegQuality, setJpegQuality] = useState(92)
  const [isGenerating, setIsGenerating] = useState(false)
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
      const result = generateOutput(state.monitors, state.sourceImage)
      setOutput(result)
      setIsGenerating(false)
    })

    return () => {
      if (debounceRef.current) {
        cancelAnimationFrame(debounceRef.current)
      }
    }
  }, [state.monitors, state.sourceImage])

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !output) return

    const ctx = canvas.getContext('2d')!
    const containerWidth = container.clientWidth - 32

    // Scale to fit container
    const displayScale = Math.min(1, containerWidth / output.width, 200 / output.height)
    canvas.width = Math.round(output.width * displayScale)
    canvas.height = Math.round(output.height * displayScale)

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(output.canvas, 0, 0, canvas.width, canvas.height)

    // Draw monitor strip boundaries
    let xOffset = 0
    for (const strip of output.monitors) {
      const x = Math.round(xOffset * displayScale)
      const w = Math.round(strip.stripWidth * displayScale)

      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, 0.5, w - 1, canvas.height - 1)

      // Label
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(x, 0, w, 18)
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      const label = `${strip.monitor.preset.name} (${strip.stripWidth}x${strip.stripHeight})`
      ctx.fillText(label, x + w / 2, 12, w - 4)

      xOffset += strip.stripWidth
    }
  }, [output])

  const handleDownload = useCallback(() => {
    if (!output) return
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    const quality = format === 'jpeg' ? jpegQuality / 100 : undefined

    output.canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wallpaper-${output.width}x${output.height}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, mimeType, quality)
  }, [output, format, jpegQuality])

  if (state.monitors.length === 0) {
    return (
      <div className="bg-gray-900 border-t border-gray-800 p-4 shrink-0">
        <div className="text-center text-gray-600 text-sm py-2">
          Add monitors and upload an image to see the output preview
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border-t border-gray-800 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
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
            <div className="flex items-center gap-2">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpeg">JPEG</option>
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
            <button
              onClick={handleDownload}
              disabled={!state.sourceImage}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        )}
      </div>

      {/* Preview canvas */}
      <div ref={containerRef} className="p-4 flex justify-center overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="border border-gray-800 rounded bg-black"
          style={{ imageRendering: 'auto', maxHeight: '200px' }}
        />
      </div>
    </div>
  )
}
