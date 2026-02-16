import React, { useCallback, useRef } from 'react'
import { useStore } from '../store'
import type { SourceImage } from '../types'

export default function ImageUpload() {
  const { state, dispatch } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImage = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const imgAspect = img.naturalWidth / img.naturalHeight
        const sixFeet = 72 // inches
        const physWidth = img.naturalHeight > img.naturalWidth ? sixFeet * imgAspect : sixFeet
        const physHeight = img.naturalHeight > img.naturalWidth ? sixFeet : sixFeet / imgAspect

        // Center on current viewport
        const containerEl = document.querySelector('[data-editor-canvas]')
        const canvasW = containerEl?.clientWidth ?? 800
        const canvasH = containerEl?.clientHeight ?? 500
        const centerPhysX = (canvasW / 2 - state.canvasOffsetX) / state.canvasScale
        const centerPhysY = (canvasH / 2 - state.canvasOffsetY) / state.canvasScale

        const sourceImage: SourceImage = {
          element: img,
          fileName: file.name,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          physicalX: centerPhysX - physWidth / 2,
          physicalY: centerPhysY - physHeight / 2,
          physicalWidth: physWidth,
          physicalHeight: physHeight,
        }
        dispatch({ type: 'SET_SOURCE_IMAGE', image: sourceImage })
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [state.canvasOffsetX, state.canvasOffsetY, state.canvasScale, dispatch])

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
    // Reset so the same file can be re-selected after deletion
    e.target.value = ''
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
        <div className="flex items-center gap-2 flex-nowrap min-w-0">
          <div className="text-xs text-gray-300 min-w-0 max-w-[280px] truncate" title={state.sourceImage.fileName}>
            {(() => {
              const name = state.sourceImage.fileName
              if (name.length <= 32) return name
              const lastDot = name.lastIndexOf('.')
              const ext = lastDot >= 0 ? name.slice(lastDot) : ''
              const base = lastDot >= 0 ? name.slice(0, lastDot) : name
              const maxBase = 32 - ext.length - 1
              return base.length > maxBase ? base.slice(0, maxBase) + '…' + ext : name
            })()}
          </div>
          <span className="text-xs text-gray-500 shrink-0">
            ({state.sourceImage.naturalWidth} x {state.sourceImage.naturalHeight} px)
          </span>
          <button
            onClick={() => dispatch({ type: 'ROTATE_SOURCE_IMAGE' })}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1 shrink-0"
            title="Rotate image 90° clockwise"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rotate
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 whitespace-nowrap"
          >
            Replace Image
          </button>
          <button
            onClick={() => dispatch({ type: 'CLEAR_SOURCE_IMAGE' })}
            className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
