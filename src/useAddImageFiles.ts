import { useCallback } from 'react'
import { useStore } from './store'
import { useToast } from './components/Toast'
import type { Monitor } from './types'
import { getMonitorDisplayName } from './utils'
import { getImagePositionBookmark } from './imagePositionStorage'
import {
  computeImagePlacement, createSourceImage, placementToastMessage, readImageFile,
} from './imageLoading'

export interface AddImageOptions {
  /** Physical point to center default-sized images on. Defaults to the center of the editor view. */
  center?: { x: number; y: number }
  /** Monitor an additional image should cover (dropped onto, or selected). */
  targetMonitor?: Monitor | null
  /** Replace this layer instead of adding a new one (first file only). */
  replaceId?: string
}

/** Physical point at the center of the visible editor canvas. */
function viewCenter(canvasOffsetX: number, canvasOffsetY: number, canvasScale: number) {
  const el = document.querySelector('[data-editor-canvas]')
  const w = el?.clientWidth ?? 800
  const h = el?.clientHeight ?? 500
  return { x: (w / 2 - canvasOffsetX) / canvasScale, y: (h / 2 - canvasOffsetY) / canvasScale }
}

/**
 * Returns a function that loads image files and adds them as layers (or replaces one layer).
 * Placement rules live in `computeImagePlacement`.
 */
export function useAddImageFiles() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const { images, monitors, selectedMonitorId, loadedLayoutImagePosition, activeLayoutName, canvasOffsetX, canvasOffsetY, canvasScale } = state

  return useCallback(async (fileList: FileList | File[], opts: AddImageOptions = {}) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'))
    if (files.length === 0) return

    const center = opts.center ?? viewCenter(canvasOffsetX, canvasOffsetY, canvasScale)
    const targetMonitor = opts.targetMonitor !== undefined
      ? opts.targetMonitor
      : monitors.find(m => m.id === selectedMonitorId) ?? null
    const replacing = opts.replaceId ? images.find(i => i.id === opts.replaceId) ?? null : null
    const bookmarkPosition = loadedLayoutImagePosition ? null : getImagePositionBookmark(activeLayoutName ?? '_default')

    let count = images.length - (replacing ? 1 : 0)
    let lastMessage = ''
    let added = 0
    for (const [i, file] of files.entries()) {
      let el: HTMLImageElement
      try {
        el = await readImageFile(file)
      } catch {
        toast.warning(`Could not load ${file.name}`)
        continue
      }
      const replaceThis = i === 0 ? replacing : null
      const placement = computeImagePlacement({
        aspect: el.naturalWidth / el.naturalHeight,
        isFirstImage: count === 0,
        center,
        replacing: replaceThis,
        targetMonitor,
        layoutPosition: loadedLayoutImagePosition,
        bookmarkPosition,
      })
      const image = createSourceImage(el, file.name, placement)
      if (replaceThis) {
        dispatch({ type: 'REPLACE_IMAGE', id: replaceThis.id, image })
      } else {
        dispatch({ type: 'ADD_IMAGE', image })
      }
      count++
      added++
      lastMessage = placementToastMessage(
        placement.source, file.name, targetMonitor ? getMonitorDisplayName(targetMonitor) : undefined,
      )
    }
    if (added === 1) toast.success(lastMessage)
    else if (added > 1) toast.success(`Added ${added} images`)
  }, [images, monitors, selectedMonitorId, loadedLayoutImagePosition, activeLayoutName, canvasOffsetX, canvasOffsetY, canvasScale, dispatch, toast])
}
