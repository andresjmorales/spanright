import React, { useCallback, useRef } from 'react'
import { useStore } from '../store'
import { getMonitorsBoundingBox } from '../utils'
import type { SourceImage } from '../types'

export default function ImageUpload() {
  const { state, dispatch } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImage = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Calculate initial physical size:
        // Try to cover the monitor bounding box
        const bbox = getMonitorsBoundingBox(state.monitors)
        let physWidth: number
        let physHeight: number
        const imgAspect = img.naturalWidth / img.naturalHeight

        if (bbox.width > 0 && bbox.height > 0) {
          // Scale to cover the monitor layout
          const bboxAspect = bbox.width / bbox.height
          if (imgAspect > bboxAspect) {
            // Image is wider than layout — fit by height
            physHeight = bbox.height * 1.1
            physWidth = physHeight * imgAspect
          } else {
            // Image is taller — fit by width
            physWidth = bbox.width * 1.1
            physHeight = physWidth / imgAspect
          }
        } else {
          // No monitors yet — use a reasonable default (30 inches wide)
          physWidth = 30
          physHeight = physWidth / imgAspect
        }

        // Center on the monitor layout or canvas origin
        const centerX = bbox.width > 0 ? bbox.minX + (bbox.width - physWidth) / 2 : 0
        const centerY = bbox.height > 0 ? bbox.minY + (bbox.height - physHeight) / 2 : 0

        const sourceImage: SourceImage = {
          element: img,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          physicalX: centerX,
          physicalY: centerY,
          physicalWidth: physWidth,
          physicalHeight: physHeight,
        }
        dispatch({ type: 'SET_SOURCE_IMAGE', image: sourceImage })
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [state.monitors, dispatch])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      loadImage(file)
    }
  }, [loadImage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadImage(file)
    }
  }, [loadImage])

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!state.sourceImage ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 hover:border-blue-500 rounded px-3 py-1.5 cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-gray-300">Upload Image</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400">
            {state.sourceImage.naturalWidth} x {state.sourceImage.naturalHeight} px
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Replace
          </button>
          <button
            onClick={() => dispatch({ type: 'CLEAR_SOURCE_IMAGE' })}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
