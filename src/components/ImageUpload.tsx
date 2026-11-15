import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useStore, getFocusImage } from '../store'
import { useToast } from './Toast'
import type { SourceImage } from '../types'
import { getSourceImagePixelSize } from '../utils'
import { useAddImageFiles } from '../useAddImageFiles'

/** Shorten a file name to `max` characters, keeping the extension. */
function shortenFileName(name: string, max = 32): string {
  if (name.length <= max) return name
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot >= 0 ? name.slice(lastDot) : ''
  const base = lastDot >= 0 ? name.slice(0, lastDot) : name
  const maxBase = max - ext.length - 1
  return base.length > maxBase ? base.slice(0, maxBase) + '…' + ext : name
}

const IconImage = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const IconLayers = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 5-9 5-9-5 9-5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l9 5 9-5" />
  </svg>
)

export default function ImageUpload() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const addImageFiles = useAddImageFiles()
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** When set, the next file pick replaces this layer instead of adding one. */
  const replaceIdRef = useRef<string | null>(null)
  const [layersOpen, setLayersOpen] = useState(false)

  const focusImage = getFocusImage(state)
  const imageCount = state.images.length

  const pickFiles = useCallback((replaceId: string | null) => {
    replaceIdRef.current = replaceId
    const input = fileInputRef.current
    if (!input) return
    input.multiple = !replaceId
    input.click()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    addImageFiles(e.dataTransfer.files)
  }, [addImageFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      addImageFiles(files, { replaceId: replaceIdRef.current ?? undefined })
    }
    replaceIdRef.current = null
    // Reset so the same file can be re-selected after deletion
    e.target.value = ''
  }, [addImageFiles])

  const removeImage = useCallback((img: SourceImage) => {
    dispatch({ type: 'REMOVE_IMAGE', id: img.id })
    toast('Image removed')
  }, [dispatch, toast])

  return (
    <div className="flex items-center gap-2 min-w-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {imageCount === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => pickFiles(null)}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 hover:border-blue-500 rounded px-2.5 py-1 cursor-pointer transition-colors"
        >
          <IconImage className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-300">Upload Image</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-nowrap min-w-0">
          {imageCount > 1 && (
            <LayersDropdown
              open={layersOpen}
              setOpen={setLayersOpen}
              onAddImage={() => pickFiles(null)}
              onRemoveImage={removeImage}
            />
          )}
          {focusImage ? (
            <>
              <div className="text-xs text-gray-300 min-w-0 max-w-[220px] truncate" title={focusImage.fileName}>
                {shortenFileName(focusImage.fileName, imageCount > 1 ? 24 : 32)}
              </div>
              <span className="text-xs text-gray-500 shrink-0 hidden lg:inline">
                ({getSourceImagePixelSize(focusImage).width} x {getSourceImagePixelSize(focusImage).height} px)
              </span>
              <button
                onClick={() => {
                  dispatch({ type: 'ROTATE_IMAGE', id: focusImage.id })
                  const next = ((focusImage.rotation ?? 0) + 90) % 360
                  toast(`Image rotated to ${next}°`)
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 whitespace-nowrap"
                title="Rotate image 90° clockwise"
              >
                Rotate
              </button>
              <button
                onClick={() => pickFiles(focusImage.id)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 whitespace-nowrap"
                title="Replace this image, keeping its position"
              >
                Replace
              </button>
              <button
                onClick={() => removeImage(focusImage)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
              >
                Remove
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-500 whitespace-nowrap">Select an image to edit</span>
          )}
          <button
            onClick={() => pickFiles(null)}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 whitespace-nowrap border-l border-gray-700 pl-2"
            title="Add another image layer. With a monitor selected, the new image fills that monitor."
          >
            + Add Image
          </button>
        </div>
      )}
    </div>
  )
}

/** Toolbar dropdown listing image layers top-first: select, reorder, remove. */
function LayersDropdown({
  open, setOpen, onAddImage, onRemoveImage,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  onAddImage: () => void
  onRemoveImage: (img: SourceImage) => void
}) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    // Capture phase + stopPropagation: Escape closes the dropdown without also reaching the
    // editor's global Escape handler (which would deselect the image just picked here).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, setOpen])

  const layersTopFirst = state.images.map((img, index) => ({ img, index })).reverse()
  const last = state.images.length - 1
  const btn = 'w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors'

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
          open ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
        }`}
        title="Image layers"
        aria-expanded={open}
      >
        <IconLayers className="w-3.5 h-3.5" />
        {state.images.length} images
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-800">
            Top layer first. Higher layers cover lower ones where they overlap.
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {layersTopFirst.map(({ img, index }) => {
              const selected = state.selectedImageId === img.id
              const rot = img.rotation ?? 0
              return (
                <li
                  key={img.id}
                  className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${selected ? 'bg-blue-500/15' : 'hover:bg-gray-800'}`}
                  onClick={() => dispatch({ type: 'SELECT_IMAGE', id: img.id })}
                >
                  <div className="w-10 h-7 shrink-0 bg-gray-950 rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={img.element.src}
                      alt=""
                      className="max-w-full max-h-full object-contain"
                      style={rot ? { transform: `rotate(${rot}deg)` } : undefined}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs truncate ${selected ? 'text-blue-300' : 'text-gray-300'}`} title={img.fileName}>
                      {shortenFileName(img.fileName, 28)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {index === 0 ? 'Bottom · used for blur fill & saved position' : index === last ? 'Top' : `Layer ${index + 1}`}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={btn}
                      disabled={index === last}
                      onClick={() => dispatch({ type: 'REORDER_IMAGE', id: img.id, to: 'forward' })}
                      title="Bring forward"
                      aria-label="Bring forward"
                    >
                      ↑
                    </button>
                    <button
                      className={btn}
                      disabled={index === 0}
                      onClick={() => dispatch({ type: 'REORDER_IMAGE', id: img.id, to: 'backward' })}
                      title="Send backward"
                      aria-label="Send backward"
                    >
                      ↓
                    </button>
                    <button
                      className={`${btn} hover:text-red-300`}
                      onClick={() => onRemoveImage(img)}
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-gray-800 flex">
            <button
              onClick={() => { onAddImage(); setOpen(false) }}
              className="flex-1 text-left px-3 py-2 text-xs text-blue-400 hover:bg-gray-800 hover:text-blue-300 transition-colors"
            >
              + Add image
            </button>
            <button
              onClick={() => {
                dispatch({ type: 'CLEAR_ALL_IMAGES' })
                toast('All images removed')
                setOpen(false)
              }}
              className="px-3 py-2 text-xs text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
            >
              Remove all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
