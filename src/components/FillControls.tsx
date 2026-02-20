import { useState, useRef, useCallback, useEffect } from 'react'
import type { FillMode, SourceImage } from '../types'

const PRESETS: { color: string; label: string }[] = [
  { color: '#000000', label: 'Black' },
  { color: '#1a1a1a', label: 'Dark gray' },
  { color: '#ffffff', label: 'White' },
]

interface FillControlsProps {
  fillMode: FillMode
  fillColor: string
  sourceImage: SourceImage | null
  onFillModeChange: (mode: FillMode) => void
  onFillColorChange: (color: string) => void
}

export default function FillControls({
  fillMode,
  fillColor,
  sourceImage,
  onFillModeChange,
  onFillColorChange,
}: FillControlsProps) {
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const samplerCanvasRef = useRef<HTMLCanvasElement>(null)
  const samplerContainerRef = useRef<HTMLDivElement>(null)

  // Draw source image into sampler canvas when eyedropper is active
  useEffect(() => {
    if (!eyedropperActive || !sourceImage || !samplerCanvasRef.current || !samplerContainerRef.current) return
    const canvas = samplerCanvasRef.current
    const container = samplerContainerRef.current
    const ctx = canvas.getContext('2d')!

    const maxW = container.clientWidth
    const maxH = 150
    const scale = Math.min(maxW / sourceImage.naturalWidth, maxH / sourceImage.naturalHeight, 1)
    canvas.width = Math.round(sourceImage.naturalWidth * scale)
    canvas.height = Math.round(sourceImage.naturalHeight * scale)
    ctx.drawImage(sourceImage.element, 0, 0, canvas.width, canvas.height)
  }, [eyedropperActive, sourceImage])

  const handleSamplerClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = samplerCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height))
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('')
    onFillColorChange(hex)
    setEyedropperActive(false)
  }, [onFillColorChange])

  const handleNativeEyedropper = useCallback(async () => {
    // Use the browser's native EyeDropper API if available
    if ('EyeDropper' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dropper = new (window as any).EyeDropper()
        const result = await dropper.open()
        onFillColorChange(result.sRGBHex)
      } catch {
        // User cancelled
      }
    } else {
      // Fallback: toggle the image sampler
      setEyedropperActive(prev => !prev)
    }
  }, [onFillColorChange])

  return (
    <div className="flex flex-col gap-2">
      {/* Fill mode selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 shrink-0">Fill</span>
        <div className="flex rounded overflow-hidden border border-gray-700">
          {([
            { mode: 'solid' as FillMode, label: 'Solid Color' },
            { mode: 'blur' as FillMode, label: 'Blur Extend' },
            { mode: 'transparent' as FillMode, label: 'Transparent' },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => onFillModeChange(mode)}
              className={`px-2 py-1 text-xs transition-colors ${
                fillMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Solid color controls */}
      {fillMode === 'solid' && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Color picker */}
          <div className="relative">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => onFillColorChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className="w-6 h-6 rounded border border-gray-600 cursor-pointer"
              style={{ backgroundColor: fillColor }}
              title="Pick a color"
            />
          </div>

          {/* Hex display */}
          <input
            type="text"
            value={fillColor}
            onChange={(e) => {
              const v = e.target.value
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onFillColorChange(v)
            }}
            className="w-[4.5rem] bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            maxLength={7}
          />

          {/* Preset swatches */}
          {PRESETS.map(({ color, label }) => (
            <button
              key={color}
              onClick={() => onFillColorChange(color)}
              className={`w-5 h-5 rounded border transition-colors ${
                fillColor === color ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: color }}
              title={label}
            />
          ))}

          {/* Eyedropper button */}
          {sourceImage && (
            <button
              onClick={handleNativeEyedropper}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors border ${
                eyedropperActive
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
              title="Sample a color from the image"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21l-4-4 8.5-8.5M16.5 3.5l4 4L12 16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 7l3 3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l2-2" />
              </svg>
              <span>Sample</span>
            </button>
          )}
        </div>
      )}

      {/* Eyedropper image sampler (fallback when native API not available) */}
      {fillMode === 'solid' && eyedropperActive && sourceImage && (
        <div ref={samplerContainerRef} className="mt-1 rounded border border-blue-500/50 bg-gray-900 p-1.5">
          <p className="text-xs text-blue-400 mb-1">Click on the image to sample a color</p>
          <canvas
            ref={samplerCanvasRef}
            onClick={handleSamplerClick}
            className="cursor-crosshair rounded max-w-full"
            style={{ imageRendering: 'auto' }}
          />
        </div>
      )}

      {/* Blur mode description */}
      {fillMode === 'blur' && (
        <p className="text-xs text-gray-500">
          Extends edge pixels of the source image outward with a heavy blur to fill empty regions.
        </p>
      )}

      {/* Transparent mode note */}
      {fillMode === 'transparent' && (
        <p className="text-xs text-yellow-500/80">
          Transparent fill requires PNG format. Export will use PNG automatically.
        </p>
      )}
    </div>
  )
}
