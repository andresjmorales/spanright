import React, { useRef, useEffect, useCallback, useState, useMemo, type Dispatch } from 'react'
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useStore, CANVAS_SCALE_MIN, CANVAS_SCALE_MAX, DEFAULT_CANVAS_SCALE } from '../store'
import { formatDimension, getMonitorsBoundingBox, getMonitorDisplayName, getBezelInches, adaptSavedPositionToAspectRatio } from '../utils'
import { useToast } from './Toast'
import { IconUndo, IconRedo, IconCheck, IconKebabVertical } from '../icons'
import type { Monitor, SourceImage, Bezels } from '../types'
import { rotatedImageCanvas } from '../generateOutput'
import {
  PHYS_MIN_X,
  PHYS_MAX_X,
  PHYS_MIN_Y,
  PHYS_MAX_Y,
} from '../canvasConstants'
import {
  getImagePositionBookmark,
  setImagePositionBookmark,
  deleteImagePositionBookmark,
} from '../imagePositionStorage'
import EditorShortcutsDialog from './EditorShortcutsDialog'

const MONITOR_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#6366f1', // indigo
]

function getMonitorColor(index: number): string {
  return MONITOR_COLORS[index % MONITOR_COLORS.length]
}

const RULER_SIZE = 24
/** Max zoom percentage (derived from scale constants in store). */
const ZOOM_PCT_MAX = (CANVAS_SCALE_MAX / DEFAULT_CANVAS_SCALE) * 100
const SMART_ALIGN_THRESHOLD_PX = 8
const SMART_ALIGN_RESIZE_THRESHOLD_PX = 0.5

/** Arrow-key nudge steps (physical inches). Default = fine; Shift = 1"; Ctrl = large. */
const MONITOR_NUDGE_STEP_IN = 0.1
const MONITOR_NUDGE_STEP_COARSE_IN = 1
const MONITOR_NUDGE_STEP_LARGE_IN = 5

/** Bezel overlay appearance (physical layout canvas). */
const BEZEL_FILL = '#2a2a2e'
const BEZEL_OPACITY = 0.92
const BEZEL_STROKE = '#3a3a3e'

interface AlignGuide {
  orientation: 'horizontal' | 'vertical'
  position: number // physical inches
  source: 'monitor' | 'image'
}

interface AlignRect {
  x: number; y: number; w: number; h: number
  source: 'monitor' | 'image'
}

function computeAlignmentGuides(
  dragPhysX: number,
  dragPhysY: number,
  dragPhysW: number,
  dragPhysH: number,
  targets: AlignRect[],
  threshold: number,
): { snapDeltaX: number | null; snapDeltaY: number | null; guides: AlignGuide[] } {
  let bestAbsDx = Infinity
  let bestAbsDy = Infinity
  let snapDx: number | null = null
  let snapDy: number | null = null

  const dragLeft = dragPhysX
  const dragRight = dragPhysX + dragPhysW
  const dragCenterX = dragPhysX + dragPhysW / 2
  const dragTop = dragPhysY
  const dragBottom = dragPhysY + dragPhysH
  const dragCenterY = dragPhysY + dragPhysH / 2

  for (const t of targets) {
    const tLeft = t.x
    const tRight = t.x + t.w
    const tCenterX = t.x + t.w / 2
    const tTop = t.y
    const tBottom = t.y + t.h
    const tCenterY = t.y + t.h / 2

    const xPairs: [number, number][] = [
      [dragLeft, tLeft],
      [dragLeft, tRight],
      [dragRight, tLeft],
      [dragRight, tRight],
      [dragCenterX, tCenterX],
    ]

    for (const [dragEdge, otherEdge] of xPairs) {
      const delta = otherEdge - dragEdge
      const absDelta = Math.abs(delta)
      if (absDelta < threshold && absDelta < bestAbsDx) {
        bestAbsDx = absDelta
        snapDx = delta
      }
    }

    const yPairs: [number, number][] = [
      [dragTop, tTop],
      [dragTop, tBottom],
      [dragBottom, tTop],
      [dragBottom, tBottom],
      [dragCenterY, tCenterY],
    ]

    for (const [dragEdge, otherEdge] of yPairs) {
      const delta = otherEdge - dragEdge
      const absDelta = Math.abs(delta)
      if (absDelta < threshold && absDelta < bestAbsDy) {
        bestAbsDy = absDelta
        snapDy = delta
      }
    }
  }

  const snappedX = snapDx !== null ? dragPhysX + snapDx : dragPhysX
  const snappedY = snapDy !== null ? dragPhysY + snapDy : dragPhysY

  const guides: AlignGuide[] = []
  const EPSILON = 0.01

  const sLeft = snappedX
  const sRight = snappedX + dragPhysW
  const sCenterX = snappedX + dragPhysW / 2
  const sTop = snappedY
  const sBottom = snappedY + dragPhysH
  const sCenterY = snappedY + dragPhysH / 2

  for (const t of targets) {
    const xPositions = [t.x, t.x + t.w, t.x + t.w / 2]
    const yPositions = [t.y, t.y + t.h, t.y + t.h / 2]

    for (const pos of xPositions) {
      if (
        Math.abs(sLeft - pos) < EPSILON ||
        Math.abs(sRight - pos) < EPSILON ||
        Math.abs(sCenterX - pos) < EPSILON
      ) {
        if (!guides.some(g => g.orientation === 'vertical' && Math.abs(g.position - pos) < EPSILON)) {
          guides.push({ orientation: 'vertical', position: pos, source: t.source })
        }
      }
    }

    for (const pos of yPositions) {
      if (
        Math.abs(sTop - pos) < EPSILON ||
        Math.abs(sBottom - pos) < EPSILON ||
        Math.abs(sCenterY - pos) < EPSILON
      ) {
        if (!guides.some(g => g.orientation === 'horizontal' && Math.abs(g.position - pos) < EPSILON)) {
          guides.push({ orientation: 'horizontal', position: pos, source: t.source })
        }
      }
    }
  }

  return { snapDeltaX: snapDx, snapDeltaY: snapDy, guides }
}

function getNiceInterval(pixelsPerUnit: number, minPixelGap = 60): { major: number; minor: number } {
  if (pixelsPerUnit <= 0) return { major: 10, minor: 2 }
  const rawInterval = minPixelGap / pixelsPerUnit
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)))
  const normalized = rawInterval / magnitude
  let nice: number
  if (normalized <= 1) nice = 1
  else if (normalized <= 2) nice = 2
  else if (normalized <= 5) nice = 5
  else nice = 10
  const major = nice * magnitude
  const divisions = nice === 2 ? 4 : 5
  return { major, minor: major / divisions }
}

function RulerOverlay({
  width,
  height,
  canvasScale,
  canvasOffsetX,
  canvasOffsetY,
  unit,
}: {
  width: number
  height: number
  canvasScale: number
  canvasOffsetX: number
  canvasOffsetY: number
  unit: 'inches' | 'cm'
}) {
  const hRef = useRef<HTMLCanvasElement>(null)
  const vRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const unitFactor = unit === 'cm' ? 2.54 : 1
    const pxPerUnit = canvasScale / unitFactor
    const { major, minor } = getNiceInterval(pxPerUnit)

    function formatLabel(v: number): string {
      if (Math.abs(v) < 0.001) return '0'
      if (Number.isInteger(v)) return v.toString()
      const s = v.toFixed(1)
      return s.endsWith('.0') ? v.toFixed(0) : s
    }

    function isMajorTick(u: number): boolean {
      const rem = Math.abs(u % major)
      return rem < minor * 0.01 || Math.abs(rem - major) < minor * 0.01
    }

    // --- Horizontal ruler ---
    const hCanvas = hRef.current
    if (hCanvas) {
      const dpr = window.devicePixelRatio || 1
      hCanvas.width = width * dpr
      hCanvas.height = RULER_SIZE * dpr
      const ctx = hCanvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, width, RULER_SIZE)

      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, RULER_SIZE - 0.5)
      ctx.lineTo(width, RULER_SIZE - 0.5)
      ctx.stroke()

      const startUnit = Math.floor(((RULER_SIZE - canvasOffsetX) / canvasScale) * unitFactor / minor) * minor
      const endUnit = Math.ceil(((width - canvasOffsetX) / canvasScale) * unitFactor / minor) * minor

      for (let u = startUnit; u <= endUnit + minor * 0.5; u = +(u + minor).toFixed(10)) {
        const screenX = (u / unitFactor) * canvasScale + canvasOffsetX
        if (screenX < RULER_SIZE - 1 || screenX > width) continue

        const isMaj = isMajorTick(u)
        const tickLen = isMaj ? 12 : 5

        ctx.strokeStyle = isMaj ? '#475569' : '#334155'
        ctx.lineWidth = isMaj ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(Math.round(screenX) + 0.5, RULER_SIZE)
        ctx.lineTo(Math.round(screenX) + 0.5, RULER_SIZE - tickLen)
        ctx.stroke()

        if (isMaj && u >= -0.001) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '9px system-ui, -apple-system, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(formatLabel(u), screenX, 2)
        }
      }
    }

    // --- Vertical ruler ---
    const vCanvas = vRef.current
    if (vCanvas) {
      const dpr = window.devicePixelRatio || 1
      vCanvas.width = RULER_SIZE * dpr
      vCanvas.height = height * dpr
      const ctx = vCanvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, RULER_SIZE, height)

      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(RULER_SIZE - 0.5, 0)
      ctx.lineTo(RULER_SIZE - 0.5, height)
      ctx.stroke()

      const startUnit = Math.floor(((RULER_SIZE - canvasOffsetY) / canvasScale) * unitFactor / minor) * minor
      const endUnit = Math.ceil(((height - canvasOffsetY) / canvasScale) * unitFactor / minor) * minor

      for (let u = startUnit; u <= endUnit + minor * 0.5; u = +(u + minor).toFixed(10)) {
        const screenY = (u / unitFactor) * canvasScale + canvasOffsetY
        if (screenY < RULER_SIZE - 1 || screenY > height) continue

        const isMaj = isMajorTick(u)
        const tickLen = isMaj ? 12 : 5

        ctx.strokeStyle = isMaj ? '#475569' : '#334155'
        ctx.lineWidth = isMaj ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(RULER_SIZE, Math.round(screenY) + 0.5)
        ctx.lineTo(RULER_SIZE - tickLen, Math.round(screenY) + 0.5)
        ctx.stroke()

        if (isMaj && u >= -0.001) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '9px system-ui, -apple-system, sans-serif'
          ctx.save()
          ctx.translate(8, screenY)
          ctx.rotate(-Math.PI / 2)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(formatLabel(u), 0, 0)
          ctx.restore()
        }
      }
    }
  }, [width, height, canvasScale, canvasOffsetX, canvasOffsetY, unit])

  return (
    <>
      <canvas
        ref={hRef}
        className="absolute top-0 left-0 pointer-events-none z-10"
        style={{ width, height: RULER_SIZE }}
      />
      <canvas
        ref={vRef}
        className="absolute top-0 left-0 pointer-events-none z-10"
        style={{ width: RULER_SIZE, height }}
      />
      <div
        className="absolute top-0 left-0 z-20 flex items-center justify-center pointer-events-none border-b border-r border-[#1e293b]"
        style={{ width: RULER_SIZE, height: RULER_SIZE, background: '#0d1117' }}
      >
        <span className="text-[10px] text-gray-500 font-medium select-none">
          {unit === 'cm' ? 'cm' : 'in'}
        </span>
      </div>
    </>
  )
}

export default function EditorCanvas() {
  const { state, dispatch, canUndo, canRedo, undoLabel, redoLabel } = useStore()
  const toast = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const imageRef = useRef<Konva.Image>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false)
  const lastPointerPos = useRef<{ x: number; y: number } | null>(null)
  const [imageSelected, setImageSelected] = useState(false)
  /** Delete (X) button position in Group coords during image resize so it tracks top-right; null when not transforming */
  const [imageDeleteButtonPos, setImageDeleteButtonPos] = useState<{ x: number; y: number } | null>(null)
  const [showEditorShortcuts, setShowEditorShortcuts] = useState(false)
  const [renameMonitorId, setRenameMonitorId] = useState<string | null>(null)
  const [renameInputValue, setRenameInputValue] = useState('')
  const [activeGuides, setActiveGuides] = useState<AlignGuide[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; monitorId: string } | null>(null)
  const [imageMenuAt, setImageMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [bezelEditorMonitorId, setBezelEditorMonitorId] = useState<string | null>(null)
  const contextMenuHandledRef = useRef(false)
  const smartAlignSnappedRef = useRef({ x: false, y: false })
  const sizeImageToFitRef = useRef<() => void>(() => {})
  // Refs for values used in hot-path event handlers (avoids callback recreation)
  const canvasStateRef = useRef({ scale: 10, offsetX: 50, offsetY: 50, dimW: 800, dimH: 500 })
  // Two-finger touch gesture state (pinch-zoom and pan)
  const touchGestureRef = useRef<{
    active: boolean
    initialPinchDistance: number
    initialPinchCenter: { x: number; y: number }
    initialScale: number
    initialOffsetX: number
    initialOffsetY: number
  } | null>(null)

  // Close monitor context menu and image menu when eyedropper is activated
  useEffect(() => {
    if (state.eyedropperActive) {
      setContextMenu(null)
      setImageMenuAt(null)
    }
  }, [state.eyedropperActive])

  // Exit eyedropper when user clicks outside the canvas (tabs, toolbar, sidebar, header, etc.)
  useEffect(() => {
    if (!state.eyedropperActive) return
    const handler = (e: MouseEvent) => {
      const container = containerRef.current
      if (container && !container.contains(e.target as Node)) {
        dispatch({ type: 'SET_EYEDROPPER_ACTIVE', active: false })
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [state.eyedropperActive, dispatch])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Fit view to all monitors (defined before keyboard effect so it can be in the effect deps)
  const fitView = useCallback(() => {
    if (state.monitors.length === 0) return
    const bbox = getMonitorsBoundingBox(state.monitors)
    const padding = 40 // canvas pixels of padding
    const availW = dimensions.width - padding * 2
    const availH = dimensions.height - padding * 2
    const scaleX = availW / bbox.width
    const scaleY = availH / bbox.height
    const newScale = Math.max(CANVAS_SCALE_MIN, Math.min(CANVAS_SCALE_MAX, Math.min(scaleX, scaleY)))
    const newOffsetX = padding - bbox.minX * newScale + (availW - bbox.width * newScale) / 2
    const newOffsetY = padding - bbox.minY * newScale + (availH - bbox.height * newScale) / 2
    dispatch({ type: 'SET_CANVAS_SCALE', scale: newScale })
    dispatch({ type: 'SET_CANVAS_OFFSET', x: newOffsetX, y: newOffsetY })
    toast('Fitted to view')
  }, [state.monitors, dimensions, dispatch, toast])

  // Keyboard shortcuts (skip when typing in inputs so we don't delete monitors or nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement
      const isEditable = target && (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target as HTMLElement).isContentEditable
      )
      if (isEditable) return

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (canUndo) {
          toast(`Undo: ${undoLabel}`)
          dispatch({ type: 'UNDO' })
        }
        return
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        if (canRedo) {
          toast(`Redo: ${redoLabel}`)
          dispatch({ type: 'REDO' })
        }
        return
      }

      // Delete/Backspace: remove image when image selected, else remove selected monitor
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (imageSelected && state.sourceImage) {
          e.preventDefault()
          dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
          setImageSelected(false)
          toast('Image removed')
        } else if (state.selectedMonitorId) {
          dispatch({ type: 'REMOVE_MONITOR', id: state.selectedMonitorId })
          toast('Monitor removed')
        }
      }
      // Escape to cancel eyedropper or deselect
      if (e.key === 'Escape') {
        if (state.eyedropperActive) {
          dispatch({ type: 'SET_EYEDROPPER_ACTIVE', active: false })
        } else {
          dispatch({ type: 'SELECT_MONITOR', id: null })
          setImageSelected(false)
        }
      }
      // F key to fit view
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        fitView()
        return
      }
      // A: Align Assist
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_SMART_ALIGN' })
        toast(state.smartAlign ? 'Align Assist disabled' : 'Align Assist enabled')
        return
      }
      // S: Size image to fit
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        sizeImageToFitRef.current()
        return
      }
      // Ctrl+Alt+M: Clear all monitors (destructive, matches Ctrl+Alt+I / Ctrl+Alt+R)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'm') {
        if (state.monitors.length > 0) {
          e.preventDefault()
          dispatch({ type: 'CLEAR_ALL_MONITORS' })
          toast('All monitors cleared')
        }
        return
      }
      // Ctrl+Alt+I: Remove image (Ctrl+I is standard for Italic)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'i') {
        if (state.sourceImage) {
          e.preventDefault()
          dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
          toast('Image removed')
        }
        return
      }
      // Ctrl+Alt+R: Reset canvas (Ctrl+Shift+R is browser hard reload)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'r') {
        if (state.monitors.length > 0 || state.sourceImage) {
          e.preventDefault()
          dispatch({ type: 'CLEAR_ALL_MONITORS' })
          dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
          toast.warning('Canvas reset')
        }
        return
      }
      // Arrow keys: nudge image when selected, else nudge selected monitor
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const step = e.shiftKey ? MONITOR_NUDGE_STEP_COARSE_IN : e.ctrlKey ? MONITOR_NUDGE_STEP_LARGE_IN : MONITOR_NUDGE_STEP_IN
        if (imageSelected && state.sourceImage) {
          e.preventDefault()
          let dx = 0, dy = 0
          if (e.key === 'ArrowLeft') dx = -step
          if (e.key === 'ArrowRight') dx = step
          if (e.key === 'ArrowUp') dy = -step
          if (e.key === 'ArrowDown') dy = step
          const newX = state.snapToGrid ? Math.round((state.sourceImage.physicalX + dx) / state.gridSize) * state.gridSize : state.sourceImage.physicalX + dx
          const newY = state.snapToGrid ? Math.round((state.sourceImage.physicalY + dy) / state.gridSize) * state.gridSize : state.sourceImage.physicalY + dy
          dispatch({ type: 'MOVE_IMAGE', x: newX, y: newY })
        } else if (state.selectedMonitorId) {
          e.preventDefault()
          const mon = state.monitors.find(m => m.id === state.selectedMonitorId)
          if (mon) {
            let dx = 0, dy = 0
            if (e.key === 'ArrowLeft') dx = -step
            if (e.key === 'ArrowRight') dx = step
            if (e.key === 'ArrowUp') dy = -step
            if (e.key === 'ArrowDown') dy = step
            const newX = state.snapToGrid ? Math.round((mon.physicalX + dx) / state.gridSize) * state.gridSize : mon.physicalX + dx
            const newY = state.snapToGrid ? Math.round((mon.physicalY + dy) / state.gridSize) * state.gridSize : mon.physicalY + dy
            dispatch({ type: 'MOVE_MONITOR', id: mon.id, x: newX, y: newY })
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    imageSelected,
    state.selectedMonitorId,
    state.monitors,
    state.sourceImage,
    state.snapToGrid,
    state.gridSize,
    state.eyedropperActive,
    state.smartAlign,
    state.sourceImage,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    fitView,
    dispatch,
    toast,
  ])

  const handleSizeImageToFit = useCallback(() => {
    if (!state.sourceImage || state.monitors.length === 0) return

    const bbox = getMonitorsBoundingBox(state.monitors)
    if (bbox.width <= 0 || bbox.height <= 0) return

    const rotation = state.sourceImage.rotation ?? 0
    const imageAspect = (rotation === 90 || rotation === 270)
      ? state.sourceImage.naturalHeight / state.sourceImage.naturalWidth
      : state.sourceImage.naturalWidth / state.sourceImage.naturalHeight
    if (!Number.isFinite(imageAspect) || imageAspect <= 0) return

    const bboxAspect = bbox.width / bbox.height
    let nextWidth: number
    let nextHeight: number

    // "Cover" fit: fully cover the monitor bounds, with overflow centered.
    if (imageAspect > bboxAspect) {
      nextHeight = bbox.height
      nextWidth = nextHeight * imageAspect
    } else {
      nextWidth = bbox.width
      nextHeight = nextWidth / imageAspect
    }

    const nextX = bbox.minX + (bbox.width - nextWidth) / 2
    const nextY = bbox.minY + (bbox.height - nextHeight) / 2

    setActiveGuides([])
    dispatch({ type: 'SET_IMAGE_TRANSFORM', x: nextX, y: nextY, physicalWidth: nextWidth, physicalHeight: nextHeight })
    toast.success('Image sized to fit layout')
  }, [state.sourceImage, state.monitors, dispatch, toast])

  useEffect(() => {
    sizeImageToFitRef.current = handleSizeImageToFit
  }, [handleSizeImageToFit])

  // Attach transformer to image when selected
  useEffect(() => {
    if (imageSelected && imageRef.current && transformerRef.current) {
      transformerRef.current.nodes([imageRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    } else if (transformerRef.current) {
      transformerRef.current.nodes([])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [imageSelected, state.sourceImage])

  const scale = state.canvasScale

  // Clamp panning to workspace bounds (synchronous — no jitter)
  const OVERFLOW = 80 // extra screen pixels past the boundary edge
  const clampOffset = useCallback((ox: number, oy: number, w: number, h: number, s: number) => {
    const minOX = w - PHYS_MAX_X * s - OVERFLOW
    const maxOX = -PHYS_MIN_X * s + OVERFLOW
    const minOY = h - PHYS_MAX_Y * s - OVERFLOW
    const maxOY = -PHYS_MIN_Y * s + OVERFLOW
    const cx = minOX <= maxOX ? Math.max(minOX, Math.min(maxOX, ox)) : (minOX + maxOX) / 2
    const cy = minOY <= maxOY ? Math.max(minOY, Math.min(maxOY, oy)) : (minOY + maxOY) / 2
    return { x: cx, y: cy }
  }, [])

  const { x: offsetX, y: offsetY } = clampOffset(
    state.canvasOffsetX, state.canvasOffsetY,
    dimensions.width, dimensions.height, scale
  )

  // Keep ref in sync for hot-path handlers
  canvasStateRef.current = { scale, offsetX, offsetY, dimW: dimensions.width, dimH: dimensions.height }

  // Convert physical inches to canvas pixels
  const toCanvasX = useCallback((physInches: number) => physInches * scale + offsetX, [scale, offsetX])
  const toCanvasY = useCallback((physInches: number) => physInches * scale + offsetY, [scale, offsetY])
  const toPhysicalX = useCallback((canvasPx: number) => (canvasPx - offsetX) / scale, [scale, offsetX])
  const toPhysicalY = useCallback((canvasPx: number) => (canvasPx - offsetY) / scale, [scale, offsetY])

  // Snap to grid
  const snap = useCallback((value: number) => {
    if (!state.snapToGrid) return value
    return Math.round(value / state.gridSize) * state.gridSize
  }, [state.snapToGrid, state.gridSize])

  // Handle wheel: default = pan, Ctrl = zoom
  // Uses ref to avoid recreating callback on every offset/scale change
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const cs = canvasStateRef.current

    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Ctrl+Scroll = Zoom (toward pointer)
      const zoomFactor = e.evt.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(CANVAS_SCALE_MIN, Math.min(CANVAS_SCALE_MAX, cs.scale * zoomFactor))
      const physX = (pointer.x - cs.offsetX) / cs.scale
      const physY = (pointer.y - cs.offsetY) / cs.scale
      const newOffsetX = pointer.x - physX * newScale
      const newOffsetY = pointer.y - physY * newScale

      dispatch({ type: 'SET_CANVAS_SCALE', scale: newScale })
      dispatch({ type: 'SET_CANVAS_OFFSET', x: newOffsetX, y: newOffsetY })
    } else {
      // Normal scroll = Pan — skip if already at boundary (avoids needless re-renders)
      const dx = e.evt.shiftKey ? -e.evt.deltaY : -e.evt.deltaX
      const dy = e.evt.shiftKey ? 0 : -e.evt.deltaY
      const newClamped = clampOffset(cs.offsetX + dx, cs.offsetY + dy, cs.dimW, cs.dimH, cs.scale)
      if (Math.abs(newClamped.x - cs.offsetX) > 0.1 || Math.abs(newClamped.y - cs.offsetY) > 0.1) {
        dispatch({ type: 'SET_CANVAS_OFFSET', x: newClamped.x, y: newClamped.y })
      }
    }
  }, [dispatch, clampOffset])

  // Two-finger touch: pinch-to-zoom and two-finger pan. Only active when exactly 2 touches; single-touch is left to Konva for dragging.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const getRect = () => container.getBoundingClientRect()
    const touchToLocal = (t: Touch, rect: DOMRect) => ({ x: t.clientX - rect.left, y: t.clientY - rect.top })
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(b.x - a.x, b.y - a.y)
    const center = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      const rect = getRect()
      const t0 = touchToLocal(e.touches[0], rect)
      const t1 = touchToLocal(e.touches[1], rect)
      const cs = canvasStateRef.current
      touchGestureRef.current = {
        active: true,
        initialPinchDistance: distance(t0, t1),
        initialPinchCenter: center(t0, t1),
        initialScale: cs.scale,
        initialOffsetX: cs.offsetX,
        initialOffsetY: cs.offsetY,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const g = touchGestureRef.current
      if (!g?.active || e.touches.length !== 2) return
      e.preventDefault()
      const rect = getRect()
      const t0 = touchToLocal(e.touches[0], rect)
      const t1 = touchToLocal(e.touches[1], rect)
      const currentDistance = distance(t0, t1)
      const currentCenter = center(t0, t1)
      const scaleFactor = currentDistance / g.initialPinchDistance
      const newScale = Math.max(CANVAS_SCALE_MIN, Math.min(CANVAS_SCALE_MAX, g.initialScale * scaleFactor))
      const physX = (g.initialPinchCenter.x - g.initialOffsetX) / g.initialScale
      const physY = (g.initialPinchCenter.y - g.initialOffsetY) / g.initialScale
      let newOffsetX = currentCenter.x - physX * newScale
      let newOffsetY = currentCenter.y - physY * newScale
      const cs = canvasStateRef.current
      const clamped = clampOffset(newOffsetX, newOffsetY, cs.dimW, cs.dimH, newScale)
      dispatch({ type: 'SET_CANVAS_SCALE', scale: newScale })
      dispatch({ type: 'SET_CANVAS_OFFSET', x: clamped.x, y: clamped.y })
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) touchGestureRef.current = null
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    container.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [dispatch, clampOffset])

  // Middle-mouse or right-click for panning
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Eyedropper: left-click to sample pixel color from source image
    if (state.eyedropperActive && e.evt.button === 0) {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage || !state.sourceImage) {
        toast.warning('Upload an image first to sample a color')
        dispatch({ type: 'SET_EYEDROPPER_ACTIVE', active: false })
        return
      }
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const cs = canvasStateRef.current
      const physX = (pointer.x - cs.offsetX) / cs.scale
      const physY = (pointer.y - cs.offsetY) / cs.scale
      const img = state.sourceImage
      if (physX >= img.physicalX && physX <= img.physicalX + img.physicalWidth &&
          physY >= img.physicalY && physY <= img.physicalY + img.physicalHeight) {
        const u = (physX - img.physicalX) / img.physicalWidth
        const v = (physY - img.physicalY) / img.physicalHeight
        const rotated = (img.rotation ?? 0) !== 0
        const srcElement = rotated ? rotatedImageCanvas(img) : img.element
        const srcW = rotated && (img.rotation === 90 || img.rotation === 270) ? img.naturalHeight : img.naturalWidth
        const srcH = rotated && (img.rotation === 90 || img.rotation === 270) ? img.naturalWidth : img.naturalHeight
        const pixelX = Math.min(Math.floor(u * srcW), srcW - 1)
        const pixelY = Math.min(Math.floor(v * srcH), srcH - 1)
        const sampleCanvas = document.createElement('canvas')
        sampleCanvas.width = 1
        sampleCanvas.height = 1
        const sampleCtx = sampleCanvas.getContext('2d')!
        sampleCtx.drawImage(srcElement, pixelX, pixelY, 1, 1, 0, 0, 1, 1)
        const pixel = sampleCtx.getImageData(0, 0, 1, 1).data
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('')
        dispatch({ type: 'SET_FILL_SOLID_COLOR', color: hex })
        dispatch({ type: 'SET_FILL_MODE', mode: 'solid' })
        dispatch({ type: 'SET_EYEDROPPER_ACTIVE', active: false })
        dispatch({ type: 'SET_ACTIVE_TAB', tab: 'preview' })
        toast.success(`Sampled ${hex}`)
      } else {
        toast.warning('Click on the source image to sample a color')
      }
      return
    }
    if (e.evt.button === 1 || e.evt.button === 2) {
      e.evt.preventDefault()
      setIsDraggingCanvas(true)
      lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY }
    }
    // Click on background deselects
    const stage = stageRef.current
    if (e.target === stage) {
      dispatch({ type: 'SELECT_MONITOR', id: null })
      setImageSelected(false)
    }
  }, [dispatch, state.eyedropperActive, state.sourceImage, toast])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isDraggingCanvas && lastPointerPos.current) {
      const dx = e.evt.clientX - lastPointerPos.current.x
      const dy = e.evt.clientY - lastPointerPos.current.y
      lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      const cs = canvasStateRef.current
      const newClamped = clampOffset(cs.offsetX + dx, cs.offsetY + dy, cs.dimW, cs.dimH, cs.scale)
      if (Math.abs(newClamped.x - cs.offsetX) > 0.1 || Math.abs(newClamped.y - cs.offsetY) > 0.1) {
        dispatch({ type: 'SET_CANVAS_OFFSET', x: newClamped.x, y: newClamped.y })
      }
    }
  }, [isDraggingCanvas, dispatch, clampOffset])

  const handleMouseUp = useCallback(() => {
    setIsDraggingCanvas(false)
    lastPointerPos.current = null
  }, [])

  // Context menu on canvas — suppress native; Konva monitors set their own handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (contextMenuHandledRef.current) {
      contextMenuHandledRef.current = false
      return
    }
    setContextMenu(null)
  }, [])

  // Drop on canvas — handles both image files and monitor presets
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverCanvas(false)

    // Check if this is a monitor preset drop
    const presetData = e.dataTransfer.getData('application/monitor-preset')
    if (presetData) {
      try {
        const preset = JSON.parse(presetData) as import('../types').MonitorPreset
        // Calculate physical position from drop coordinates, centering on cursor
        const container = containerRef.current
        if (container) {
          const rect = container.getBoundingClientRect()
          const canvasX = e.clientX - rect.left
          const canvasY = e.clientY - rect.top
          // Use clamped offset so drop position matches visible canvas
          const w = container.clientWidth
          const h = container.clientHeight
          const s = state.canvasScale
          const OVERFLOW = 80
          const minOX = w - PHYS_MAX_X * s - OVERFLOW
          const maxOX = -PHYS_MIN_X * s + OVERFLOW
          const minOY = h - PHYS_MAX_Y * s - OVERFLOW
          const maxOY = -PHYS_MIN_Y * s + OVERFLOW
          const clamp = (v: number, lo: number, hi: number) => (lo <= hi ? Math.max(lo, Math.min(hi, v)) : (lo + hi) / 2)
          const dropOffsetX = clamp(state.canvasOffsetX, minOX, maxOX)
          const dropOffsetY = clamp(state.canvasOffsetY, minOY, maxOY)
          const physCursorX = (canvasX - dropOffsetX) / s
          const physCursorY = (canvasY - dropOffsetY) / s
          // Calculate physical dimensions so we can center on cursor
          const ppi = Math.sqrt(preset.resolutionX ** 2 + preset.resolutionY ** 2) / preset.diagonal
          const physW = preset.resolutionX / ppi
          const physH = preset.resolutionY / ppi
          const physX = physCursorX - physW / 2
          const physY = physCursorY - physH / 2
          // Snap position if enabled
          const snappedX = state.snapToGrid ? Math.round(physX / state.gridSize) * state.gridSize : physX
          const snappedY = state.snapToGrid ? Math.round(physY / state.gridSize) * state.gridSize : physY
          dispatch({ type: 'ADD_MONITOR', preset, x: snappedX, y: snappedY })
          toast.success(`Added ${preset.name}`)
        }
      } catch {
        // Ignore invalid preset data
      }
      return
    }

    // Otherwise handle image file drop
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    const loadedLayoutImagePosition = state.loadedLayoutImagePosition
    const bookmarkPosition = loadedLayoutImagePosition
      ? null
      : getImagePositionBookmark(state.activeLayoutName ?? '_default')
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const imgAspect = img.naturalWidth / img.naturalHeight
        const sixFeet = 72 // inches
        let physWidth = img.naturalHeight > img.naturalWidth ? sixFeet * imgAspect : sixFeet
        let physHeight = img.naturalHeight > img.naturalWidth ? sixFeet : sixFeet / imgAspect
        let physicalX: number
        let physicalY: number
        let usedSavedPosition: 'layout' | 'bookmark' | false = false

        if (loadedLayoutImagePosition) {
          const adapted = adaptSavedPositionToAspectRatio(loadedLayoutImagePosition, imgAspect)
          physicalX = adapted.x
          physicalY = adapted.y
          physWidth = adapted.width
          physHeight = adapted.height
          usedSavedPosition = 'layout'
        } else if (bookmarkPosition) {
          const adapted = adaptSavedPositionToAspectRatio(bookmarkPosition, imgAspect)
          physicalX = adapted.x
          physicalY = adapted.y
          physWidth = adapted.width
          physHeight = adapted.height
          usedSavedPosition = 'bookmark'
        } else {
          const container = containerRef.current
          const viewW = container?.clientWidth ?? 800
          const viewH = container?.clientHeight ?? 500
          const centerPhysX = (viewW / 2 - state.canvasOffsetX) / state.canvasScale
          const centerPhysY = (viewH / 2 - state.canvasOffsetY) / state.canvasScale
          physicalX = centerPhysX - physWidth / 2
          physicalY = centerPhysY - physHeight / 2
        }

        const sourceImage: SourceImage = {
          element: img,
          fileName: file.name,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          physicalX,
          physicalY,
          physicalWidth: physWidth,
          physicalHeight: physHeight,
        }
        dispatch({ type: 'SET_SOURCE_IMAGE', image: sourceImage })
        if (usedSavedPosition === 'layout') {
          toast.success('Image positioned from saved layout')
        } else if (usedSavedPosition === 'bookmark') {
          toast.success('Image positioned from bookmark')
        } else {
          toast.success(`Image loaded: ${file.name}`)
        }
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [state.canvasOffsetX, state.canvasOffsetY, state.canvasScale, state.activeLayoutName, state.loadedLayoutImagePosition, state.snapToGrid, state.gridSize, dispatch, toast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverCanvas(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOverCanvas(false)
  }, [])

  // Generate grid lines
  const gridLines: React.ReactNode[] = []
  const gridSpacing = state.gridSize * scale

  if (gridSpacing > 4) {
    const startX = Math.floor(-offsetX / gridSpacing) * gridSpacing
    for (let x = startX; x < dimensions.width - offsetX; x += gridSpacing) {
      const canvasX = x + offsetX
      if (canvasX < 0 || canvasX > dimensions.width) continue
      const physVal = x / scale
      const isMajor = Math.abs(physVal % (5 * state.gridSize)) < 0.01
      gridLines.push(
        <Line
          key={`v-${x}`}
          points={[canvasX, 0, canvasX, dimensions.height]}
          stroke={isMajor ? '#334155' : '#1e293b'}
          strokeWidth={isMajor ? 1 : 0.5}
          listening={false}
        />
      )
    }
    const startY = Math.floor(-offsetY / gridSpacing) * gridSpacing
    for (let y = startY; y < dimensions.height - offsetY; y += gridSpacing) {
      const canvasY = y + offsetY
      if (canvasY < 0 || canvasY > dimensions.height) continue
      const physVal = y / scale
      const isMajor = Math.abs(physVal % (5 * state.gridSize)) < 0.01
      gridLines.push(
        <Line
          key={`h-${y}`}
          points={[0, canvasY, dimensions.width, canvasY]}
          stroke={isMajor ? '#334155' : '#1e293b'}
          strokeWidth={isMajor ? 1 : 0.5}
          listening={false}
        />
      )
    }
  }


  // Handle monitor drag
  const handleMonitorDragMove = useCallback((monitor: Monitor, e: Konva.KonvaEventObject<DragEvent>) => {
    if (!state.smartAlign) {
      smartAlignSnappedRef.current = { x: false, y: false }
      setActiveGuides([])
      return
    }
    const node = e.target
    const physX = toPhysicalX(node.x())
    const physY = toPhysicalY(node.y())
    const threshold = SMART_ALIGN_THRESHOLD_PX / scale

    const targets: AlignRect[] = state.monitors
      .filter(m => m.id !== monitor.id)
      .map(m => {
        const b = getBezelInches(m)
        return { x: m.physicalX - b.left, y: m.physicalY - b.top, w: m.physicalWidth + b.left + b.right, h: m.physicalHeight + b.top + b.bottom, source: 'monitor' as const }
      })
    if (state.sourceImage) {
      const img = state.sourceImage
      targets.push({ x: img.physicalX, y: img.physicalY, w: img.physicalWidth, h: img.physicalHeight, source: 'image' })
    }

    const db = getBezelInches(monitor)
    const { snapDeltaX, snapDeltaY, guides } = computeAlignmentGuides(
      physX - db.left, physY - db.top,
      monitor.physicalWidth + db.left + db.right, monitor.physicalHeight + db.top + db.bottom,
      targets, threshold,
    )

    smartAlignSnappedRef.current = {
      x: snapDeltaX !== null,
      y: snapDeltaY !== null,
    }

    if (snapDeltaX !== null || snapDeltaY !== null) {
      node.position({
        x: toCanvasX(snapDeltaX !== null ? physX + snapDeltaX : physX),
        y: toCanvasY(snapDeltaY !== null ? physY + snapDeltaY : physY),
      })
    }

    setActiveGuides(guides)
  }, [state.smartAlign, state.monitors, state.sourceImage, scale, toPhysicalX, toPhysicalY, toCanvasX, toCanvasY])

  const handleMonitorDragEnd = useCallback((monitor: Monitor, e: Konva.KonvaEventObject<DragEvent>) => {
    setActiveGuides([])
    const node = e.target
    let newPhysX = toPhysicalX(node.x())
    let newPhysY = toPhysicalY(node.y())
    if (!smartAlignSnappedRef.current.x) newPhysX = snap(newPhysX)
    if (!smartAlignSnappedRef.current.y) newPhysY = snap(newPhysY)
    smartAlignSnappedRef.current = { x: false, y: false }
    dispatch({ type: 'MOVE_MONITOR', id: monitor.id, x: newPhysX, y: newPhysY })
    node.position({ x: toCanvasX(newPhysX), y: toCanvasY(newPhysY) })
  }, [dispatch, snap, toPhysicalX, toPhysicalY, toCanvasX, toCanvasY])

  // Handle image drag (Group position is image center)
  const handleImageDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!state.smartAlign || !state.sourceImage) {
      smartAlignSnappedRef.current = { x: false, y: false }
      setActiveGuides([])
      return
    }
    const node = e.target
    const centerPhysX = toPhysicalX(node.x())
    const centerPhysY = toPhysicalY(node.y())
    const physX = centerPhysX - state.sourceImage.physicalWidth / 2
    const physY = centerPhysY - state.sourceImage.physicalHeight / 2
    const threshold = SMART_ALIGN_THRESHOLD_PX / scale

    const targets: AlignRect[] = state.monitors.map(m => {
      const b = getBezelInches(m)
      return {
        x: m.physicalX - b.left, y: m.physicalY - b.top,
        w: m.physicalWidth + b.left + b.right, h: m.physicalHeight + b.top + b.bottom,
        source: 'image' as const,
      }
    })

    const { snapDeltaX, snapDeltaY, guides } = computeAlignmentGuides(
      physX, physY, state.sourceImage.physicalWidth, state.sourceImage.physicalHeight,
      targets, threshold,
    )

    smartAlignSnappedRef.current = {
      x: snapDeltaX !== null,
      y: snapDeltaY !== null,
    }

    if (snapDeltaX !== null || snapDeltaY !== null) {
      const snappedX = snapDeltaX !== null ? physX + snapDeltaX : physX
      const snappedY = snapDeltaY !== null ? physY + snapDeltaY : physY
      node.position({
        x: toCanvasX(snappedX + state.sourceImage.physicalWidth / 2),
        y: toCanvasY(snappedY + state.sourceImage.physicalHeight / 2),
      })
    }

    setActiveGuides(guides)
  }, [state.smartAlign, state.sourceImage, state.monitors, scale, toPhysicalX, toPhysicalY, toCanvasX, toCanvasY])

  const handleImageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setActiveGuides([])
    smartAlignSnappedRef.current = { x: false, y: false }
    const node = e.target
    if (!state.sourceImage) return
    const centerPhysX = toPhysicalX(node.x())
    const centerPhysY = toPhysicalY(node.y())
    const newPhysX = centerPhysX - state.sourceImage.physicalWidth / 2
    const newPhysY = centerPhysY - state.sourceImage.physicalHeight / 2
    dispatch({ type: 'MOVE_IMAGE', x: newPhysX, y: newPhysY })
  }, [dispatch, toPhysicalX, toPhysicalY, state.sourceImage])

  // Handle image transform (resize via handles). Transformer keeps one corner fixed (e.g. top-left
  // when dragging bottom-right); use that corner (bbox top-left) so the image doesn't jump on release.
  const handleImageTransformEnd = useCallback(() => {
    setImageDeleteButtonPos(null)
    setActiveGuides([])
    const node = imageRef.current
    if (!node || !state.sourceImage) return

    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const newCanvasW = node.width() * scaleX
    const newCanvasH = node.height() * scaleY
    const newPhysW = newCanvasW / scale
    const newPhysH = newCanvasH / scale
    const box = node.getClientRect({ skipTransform: false })
    // Use top-left of transformed box so the anchored corner stays put (no jump when mouse released)
    const newPhysX = toPhysicalX(box.x)
    const newPhysY = toPhysicalY(box.y)

    // Reset the Konva node's scale and local position (we store size in state)
    node.scaleX(1)
    node.scaleY(1)
    node.position({ x: 0, y: 0 })

    dispatch({ type: 'SET_IMAGE_TRANSFORM', x: newPhysX, y: newPhysY, physicalWidth: newPhysW, physicalHeight: newPhysH })
  }, [dispatch, scale, toPhysicalX, toPhysicalY, state.sourceImage])

  // Render source image (wrapped in Group with delete button so they move together)
  const imgW = state.sourceImage ? state.sourceImage.physicalWidth * scale : 0
  const imgH = state.sourceImage ? state.sourceImage.physicalHeight * scale : 0
  const imgRotation = state.sourceImage?.rotation ?? 0
  const imageNode = state.sourceImage ? (
    <Group
      x={toCanvasX(state.sourceImage.physicalX) + imgW / 2}
      y={toCanvasY(state.sourceImage.physicalY) + imgH / 2}
      offset={{ x: imgW / 2, y: imgH / 2 }}
      rotation={imgRotation}
      draggable
      onClick={() => {
        setImageSelected(true)
        dispatch({ type: 'SELECT_MONITOR', id: null })
        setImageMenuAt(null)
      }}
      onTap={() => {
        setImageSelected(true)
        dispatch({ type: 'SELECT_MONITOR', id: null })
        setImageMenuAt(null)
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault()
        contextMenuHandledRef.current = true
        const stage = stageRef.current
        if (!stage) return
        const container = stage.container().getBoundingClientRect()
        setImageSelected(true)
        dispatch({ type: 'SELECT_MONITOR', id: null })
        setContextMenu(null)
        setImageMenuAt({
          x: e.evt.clientX - container.left,
          y: e.evt.clientY - container.top,
        })
      }}
      onDragMove={handleImageDragMove}
      onDragEnd={handleImageDragEnd}
    >
      <KonvaImage
        ref={imageRef}
        image={state.sourceImage.element}
        width={imgW}
        height={imgH}
        opacity={0.7}
        onTransform={() => {
          const n = imageRef.current
          const group = n?.getParent()
          if (!n || !group || !state.sourceImage) return
          const relBox = n.getClientRect({ skipTransform: false, relativeTo: group })
          const bx = relBox.x + relBox.width - 22
          const by = relBox.y + 4
          if (Number.isFinite(bx) && Number.isFinite(by)) setImageDeleteButtonPos({ x: bx, y: by })

          if (state.smartAlign) {
            const absBox = n.getClientRect({ skipTransform: false })
            const physX = toPhysicalX(absBox.x)
            const physY = toPhysicalY(absBox.y)
            const physW = absBox.width / scale
            const physH = absBox.height / scale
            const threshold = SMART_ALIGN_RESIZE_THRESHOLD_PX / scale

            const targets: AlignRect[] = state.monitors.map(m => {
              const b = getBezelInches(m)
              return {
                x: m.physicalX - b.left, y: m.physicalY - b.top,
                w: m.physicalWidth + b.left + b.right, h: m.physicalHeight + b.top + b.bottom,
                source: 'image' as const,
              }
            })

            const { guides } = computeAlignmentGuides(
              physX, physY, physW, physH, targets, threshold,
            )
            setActiveGuides(guides)
          }
        }}
        onTransformEnd={handleImageTransformEnd}
      />
      {/* Kebab menu — left of X when selected; opens Size image to fit / Remove image */}
      {imageSelected && (
        <Group
          x={imageDeleteButtonPos ? imageDeleteButtonPos.x - 22 : imgW - 44}
          y={imageDeleteButtonPos ? imageDeleteButtonPos.y : 4}
          onClick={(e) => {
            e.cancelBubble = true
            const imgX = toCanvasX(state.sourceImage!.physicalX)
            const imgY = toCanvasY(state.sourceImage!.physicalY)
            setImageMenuAt({ x: imgX + imgW - 44, y: imgY + 4 + 22 })
          }}
          onTap={(e) => {
            e.cancelBubble = true
            const imgX = toCanvasX(state.sourceImage!.physicalX)
            const imgY = toCanvasY(state.sourceImage!.physicalY)
            setImageMenuAt({ x: imgX + imgW - 44, y: imgY + 4 + 22 })
          }}
        >
          <Rect width={18} height={18} fill="#475569" cornerRadius={3} />
          <Text x={3} y={2} text="⋮" fontSize={12} fill="#e2e8f0" />
        </Group>
      )}
      {/* Delete button — top-right, follows visual corner during resize (any handle) */}
      {imageSelected && (
        <Group
          x={imageDeleteButtonPos ? imageDeleteButtonPos.x : imgW - 22}
          y={imageDeleteButtonPos ? imageDeleteButtonPos.y : 4}
          onClick={(e) => {
            e.cancelBubble = true
            setImageSelected(false)
            setImageMenuAt(null)
            dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
            toast('Image removed')
          }}
          onTap={(e) => {
            e.cancelBubble = true
            setImageSelected(false)
            setImageMenuAt(null)
            dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
            toast('Image removed')
          }}
        >
          <Rect width={18} height={18} fill="#ef4444" cornerRadius={3} />
          <Text x={4} y={1} text="✕" fontSize={12} fill="#ffffff" />
        </Group>
      )}
    </Group>
  ) : null

  // Render monitors
  const monitorNodes = state.monitors.map((monitor, index) => {
    const cx = toCanvasX(monitor.physicalX)
    const cy = toCanvasY(monitor.physicalY)
    const cw = monitor.physicalWidth * scale
    const ch = monitor.physicalHeight * scale
    const isSelected = state.selectedMonitorId === monitor.id
    const color = getMonitorColor(index)

    const bInches = getBezelInches(monitor)
    const bTop = bInches.top * scale
    const bBottom = bInches.bottom * scale
    const bLeft = bInches.left * scale
    const bRight = bInches.right * scale
    const hasBezels = bTop > 0 || bBottom > 0 || bLeft > 0 || bRight > 0

    return (
      <Group
        key={monitor.id}
        x={cx}
        y={cy}
        draggable
        onDragMove={(e) => handleMonitorDragMove(monitor, e)}
        onDragEnd={(e) => handleMonitorDragEnd(monitor, e)}
        onClick={() => {
          dispatch({ type: 'SELECT_MONITOR', id: monitor.id })
          setImageSelected(false)
          setContextMenu(null)
          setImageMenuAt(null)
        }}
        onTap={() => {
          dispatch({ type: 'SELECT_MONITOR', id: monitor.id })
          setImageSelected(false)
          setContextMenu(null)
          setImageMenuAt(null)
        }}
        onContextMenu={(e) => {
          e.evt.preventDefault()
          contextMenuHandledRef.current = true
          const stage = stageRef.current
          if (!stage) return
          const container = stage.container().getBoundingClientRect()
          setContextMenu({
            x: e.evt.clientX - container.left,
            y: e.evt.clientY - container.top,
            monitorId: monitor.id,
          })
          dispatch({ type: 'SELECT_MONITOR', id: monitor.id })
          setImageSelected(false)
        }}
      >
        {/* Bezel overlay — extends outward from display edges */}
        {hasBezels && (
          <>
            {bTop > 0 && <Rect x={-bLeft} y={-bTop} width={cw + bLeft + bRight} height={bTop} fill={BEZEL_FILL} opacity={BEZEL_OPACITY} listening={false} />}
            {bBottom > 0 && <Rect x={-bLeft} y={ch} width={cw + bLeft + bRight} height={bBottom} fill={BEZEL_FILL} opacity={BEZEL_OPACITY} listening={false} />}
            {bLeft > 0 && <Rect x={-bLeft} y={0} width={bLeft} height={ch} fill={BEZEL_FILL} opacity={BEZEL_OPACITY} listening={false} />}
            {bRight > 0 && <Rect x={cw} y={0} width={bRight} height={ch} fill={BEZEL_FILL} opacity={BEZEL_OPACITY} listening={false} />}
            {/* Outer border of bezel */}
            <Rect
              x={-bLeft} y={-bTop}
              width={cw + bLeft + bRight} height={ch + bTop + bBottom}
              stroke={BEZEL_STROKE}
              strokeWidth={0.5}
              listening={false}
            />
          </>
        )}
        {/* Monitor fill - semi-transparent to see image behind */}
        <Rect
          width={cw}
          height={ch}
          fill={color}
          opacity={0.15}
          stroke={isSelected ? '#ffffff' : color}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={2}
        />
        {/* Monitor border */}
        <Rect
          width={cw}
          height={ch}
          stroke={color}
          strokeWidth={isSelected ? 2.5 : 1.5}
          cornerRadius={2}
          listening={false}
        />
        {/* Label background — pinned to bottom */}
        {(() => {
          const labelH = cw > 100 ? 44 : 28
          const labelW = Math.min(Math.max(cw - 8, 60), 200)
          const labelY = ch - labelH - 4
          return (
            <>
              <Rect
                x={4}
                y={labelY}
                width={labelW}
                height={labelH}
                fill="rgba(0,0,0,0.55)"
                cornerRadius={3}
                listening={false}
              />
              {/* Monitor name */}
              <Text
                x={8}
                y={labelY + 3}
                text={getMonitorDisplayName(monitor)}
                fontSize={cw > 100 ? 11 : 9}
                fill="#ffffff"
                fontStyle="bold"
                listening={false}
                width={Math.min(Math.max(cw - 16, 50), 190)}
                ellipsis
                wrap="none"
                opacity={0.9}
              />
              {/* Resolution + physical dimensions */}
              {cw > 100 && (
                <Text
                  x={8}
                  y={labelY + 17}
                  text={`${monitor.preset.resolutionX}x${monitor.preset.resolutionY} · ${formatDimension(monitor.physicalWidth, state.unit)} x ${formatDimension(monitor.physicalHeight, state.unit)}`}
                  fontSize={9}
                  fill="#94a3b8"
                  listening={false}
                  width={Math.min(Math.max(cw - 16, 50), 190)}
                  ellipsis
                  wrap="none"
                  opacity={0.8}
                />
              )}
              {cw > 100 && (
                <Text
                  x={8}
                  y={labelY + 29}
                  text={`${Math.round(monitor.ppi)} PPI`}
                  fontSize={9}
                  fill="#64748b"
                  listening={false}
                  opacity={0.8}
                />
              )}
            </>
          )
        })()}
        {/* Kebab menu (same as right-click context menu) — left of X when selected */}
        {isSelected && (
          <Group
            x={cw - 42}
            y={4}
            onClick={(e) => {
              e.cancelBubble = true
              setContextMenu({ x: cx + cw - 42, y: cy + 4 + 22, monitorId: monitor.id })
            }}
            onTap={(e) => {
              e.cancelBubble = true
              setContextMenu({ x: cx + cw - 42, y: cy + 4 + 22, monitorId: monitor.id })
            }}
          >
            <Rect width={18} height={18} fill="#475569" cornerRadius={3} />
            <Text x={3} y={2} text="⋮" fontSize={12} fill="#e2e8f0" />
          </Group>
        )}
        {/* Delete button */}
        {isSelected && (
          <Group
            x={cw - 22}
            y={4}
            onClick={(e) => {
              e.cancelBubble = true
              dispatch({ type: 'REMOVE_MONITOR', id: monitor.id })
              toast('Monitor removed')
            }}
            onTap={(e) => {
              e.cancelBubble = true
              dispatch({ type: 'REMOVE_MONITOR', id: monitor.id })
              toast('Monitor removed')
            }}
          >
            <Rect width={18} height={18} fill="#ef4444" cornerRadius={3} />
            <Text x={4} y={1} text="✕" fontSize={12} fill="#ffffff" />
          </Group>
        )}
        {/* Rotate 90° button — bottom-right */}
        <Group
          x={cw - 22}
          y={ch - 22}
          onClick={(e) => {
            e.cancelBubble = true
            const newRotation = (monitor.rotation ?? 0) === 90 ? 'landscape' : 'portrait'
            dispatch({ type: 'ROTATE_MONITOR', id: monitor.id })
            toast(`Monitor rotated to ${newRotation}`)
          }}
          onTap={(e) => {
            e.cancelBubble = true
            const newRotation = (monitor.rotation ?? 0) === 90 ? 'landscape' : 'portrait'
            dispatch({ type: 'ROTATE_MONITOR', id: monitor.id })
            toast(`Monitor rotated to ${newRotation}`)
          }}
        >
          <Rect width={18} height={18} fill="#475569" cornerRadius={3} />
          <Text x={3} y={2} text="↻" fontSize={12} fill="#e2e8f0" />
        </Group>
      </Group>
    )
  })

  // Origin crosshair
  const originLines = (
    <>
      <Line points={[offsetX, 0, offsetX, dimensions.height]} stroke="#475569" strokeWidth={1} dash={[4, 4]} listening={false} opacity={0.5} />
      <Line points={[0, offsetY, dimensions.width, offsetY]} stroke="#475569" strokeWidth={1} dash={[4, 4]} listening={false} opacity={0.5} />
    </>
  )

  // Workspace boundary — darken everything outside the bounds
  const bx = toCanvasX(PHYS_MIN_X)
  const by = toCanvasY(PHYS_MIN_Y)
  const bw = (PHYS_MAX_X - PHYS_MIN_X) * scale
  const bh = (PHYS_MAX_Y - PHYS_MIN_Y) * scale
  const FAR = 20000
  const outsideFill = '#1e293b'
  const workspaceBorder = (
    <>
      {/* Top */}
      <Rect x={-FAR} y={-FAR} width={FAR * 2} height={FAR + by} fill={outsideFill} listening={false} />
      {/* Bottom */}
      <Rect x={-FAR} y={by + bh} width={FAR * 2} height={FAR} fill={outsideFill} listening={false} />
      {/* Left */}
      <Rect x={-FAR} y={by} width={FAR + bx} height={bh} fill={outsideFill} listening={false} />
      {/* Right */}
      <Rect x={bx + bw} y={by} width={FAR} height={bh} fill={outsideFill} listening={false} />
      {/* Border line */}
      <Rect x={bx} y={by} width={bw} height={bh} stroke="#475569" strokeWidth={3} listening={false} />
    </>
  )

  return (
    <div
      ref={containerRef}
      data-editor-canvas
      className={`flex-1 bg-gray-950 relative overflow-hidden ${isDragOverCanvas ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onContextMenu={handleContextMenu}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: state.eyedropperActive ? 'crosshair' : isDraggingCanvas ? 'grabbing' : 'default' }}
      >
        <Layer>
          <Rect width={dimensions.width} height={dimensions.height} fill="#0a0a1a" listening={false} />
          {gridLines}
          {workspaceBorder}
          {originLines}
        </Layer>
        <Layer listening={!state.eyedropperActive}>
          {imageNode}
          {/* Transformer for image resizing */}
          <Transformer
            ref={transformerRef}
            borderStroke="#3b82f6"
            anchorStroke="#3b82f6"
            anchorFill="#1e3a5f"
            anchorSize={8}
            rotateEnabled={false}
            keepRatio={true}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            boundBoxFunc={(_oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) return _oldBox
              return newBox
            }}
          />
          {monitorNodes}
          {activeGuides.map((guide, i) => (
            <Line
              key={`align-${guide.orientation}-${i}`}
              points={guide.orientation === 'vertical'
                ? [toCanvasX(guide.position), 0, toCanvasX(guide.position), dimensions.height]
                : [0, toCanvasY(guide.position), dimensions.width, toCanvasY(guide.position)]
              }
              stroke={guide.source === 'image' ? '#22c55e' : '#ec4899'}
              strokeWidth={1}
              dash={[6, 3]}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>

      {/* Rename monitor modal */}
      {renameMonitorId && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setRenameMonitorId(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium text-gray-200 mb-2">Rename monitor</div>
            <input
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  dispatch({ type: 'SET_MONITOR_DISPLAY_NAME', id: renameMonitorId, displayName: renameInputValue })
                  toast(`Monitor renamed to "${renameInputValue}"`)
                  setRenameMonitorId(null)
                }
                if (e.key === 'Escape') setRenameMonitorId(null)
              }}
              placeholder={state.monitors.find(m => m.id === renameMonitorId)?.preset.name ?? 'Monitor name'}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setRenameMonitorId(null)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_MONITOR_DISPLAY_NAME', id: renameMonitorId, displayName: renameInputValue })
                  toast(`Monitor renamed to "${renameInputValue}"`)
                  setRenameMonitorId(null)
                }}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monitor context menu */}
      {contextMenu && (() => {
        const mon = state.monitors.find(m => m.id === contextMenu.monitorId)
        if (!mon) return null
        return (
          <MonitorContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            monitor={mon}
            onClose={() => setContextMenu(null)}
            onRename={() => {
              setRenameMonitorId(mon.id)
              setRenameInputValue(getMonitorDisplayName(mon))
              setContextMenu(null)
            }}
            onRotate={() => {
              const newRotation = (mon.rotation ?? 0) === 90 ? 'landscape' : 'portrait'
              dispatch({ type: 'ROTATE_MONITOR', id: mon.id })
              toast(`Monitor rotated to ${newRotation}`)
              setContextMenu(null)
            }}
            onDelete={() => {
              dispatch({ type: 'REMOVE_MONITOR', id: mon.id })
              toast('Monitor removed')
              setContextMenu(null)
            }}
            onDuplicate={() => {
              dispatch({ type: 'DUPLICATE_MONITOR', id: mon.id })
              toast.success('Monitor duplicated')
              setContextMenu(null)
            }}
            onSetBezels={() => {
              setBezelEditorMonitorId(mon.id)
              setContextMenu(null)
            }}
          />
        )
      })()}

      {/* Bezel editor popover */}
      {bezelEditorMonitorId && (() => {
        const mon = state.monitors.find(m => m.id === bezelEditorMonitorId)
        if (!mon) return null
        return (
          <BezelEditorPopover
            monitor={mon}
            canvasScale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
            onClose={() => setBezelEditorMonitorId(null)}
            onPreview={(bezels) => {
              const hasAny = bezels.top > 0 || bezels.bottom > 0 || bezels.left > 0 || bezels.right > 0
              dispatch({ type: 'SET_MONITOR_BEZELS', id: mon.id, bezels: hasAny ? bezels : undefined })
            }}
            onConfirm={(bezels) => {
              const hasAny = bezels.top > 0 || bezels.bottom > 0 || bezels.left > 0 || bezels.right > 0
              dispatch({ type: 'SET_MONITOR_BEZELS', id: mon.id, bezels: hasAny ? bezels : undefined })
              toast.success(hasAny ? 'Bezels updated' : 'Bezels removed')
            }}
            onCancel={(originalBezels) => {
              dispatch({ type: 'SET_MONITOR_BEZELS', id: mon.id, bezels: originalBezels })
            }}
          />
        )
      })()}

      {/* Image kebab dropdown — Size image to fit, layout position, bookmark (apply/clear), Remove image */}
      {imageMenuAt && state.sourceImage && (
        <ImageKebabMenu
          x={imageMenuAt.x}
          y={imageMenuAt.y}
          canSizeToFit={state.monitors.length > 0}
          hasLayoutPosition={!!state.loadedLayoutImagePosition}
          savedPosition={(() => {
            const key = state.activeLayoutName ?? '_default'
            return getImagePositionBookmark(key)
          })()}
          onSizeImageToFit={() => handleSizeImageToFit()}
          onSaveImagePosition={() => {
            const img = state.sourceImage!
            const key = state.activeLayoutName ?? '_default'
            setImagePositionBookmark(key, {
              x: img.physicalX,
              y: img.physicalY,
              width: img.physicalWidth,
              height: img.physicalHeight,
              aspectRatio: img.naturalWidth / img.naturalHeight,
            })
            toast.success(state.activeLayoutName ? `Image position bookmarked for '${state.activeLayoutName}'` : 'Image position bookmarked')
          }}
          onApplyLayoutPosition={() => {
            const img = state.sourceImage!
            const layoutPos = state.loadedLayoutImagePosition
            if (!layoutPos) return
            const ar = img.naturalWidth / img.naturalHeight
            const { x, y, width, height } = adaptSavedPositionToAspectRatio(layoutPos, ar)
            dispatch({ type: 'SET_IMAGE_TRANSFORM', x, y, physicalWidth: width, physicalHeight: height })
            toast.success('Image position from layout applied')
          }}
          onApplySavedPosition={() => {
            const img = state.sourceImage!
            const key = state.activeLayoutName ?? '_default'
            const saved = getImagePositionBookmark(key)
            if (!saved) return
            const ar = img.naturalWidth / img.naturalHeight
            const { x, y, width, height } = adaptSavedPositionToAspectRatio(saved, ar)
            dispatch({ type: 'SET_IMAGE_TRANSFORM', x, y, physicalWidth: width, physicalHeight: height })
            toast.success('Bookmarked position applied')
          }}
          onClearSavedPosition={() => {
            const key = state.activeLayoutName ?? '_default'
            deleteImagePositionBookmark(key)
            toast('Bookmarked position cleared')
          }}
          onRemoveImage={() => {
            setImageSelected(false)
            dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
            toast('Image removed')
          }}
          onClose={() => setImageMenuAt(null)}
        />
      )}

      {/* Rulers */}
      <RulerOverlay
        width={dimensions.width}
        height={dimensions.height}
        canvasScale={scale}
        canvasOffsetX={offsetX}
        canvasOffsetY={offsetY}
        unit={state.unit}
      />

      {/* Undo/Redo + Canvas menu (top-right) */}
      <div className="absolute top-8 right-3 flex items-center gap-1.5 select-none z-10">
        <button
          onClick={() => {
            if (canUndo) {
              toast(`Undo: ${undoLabel}`)
              dispatch({ type: 'UNDO' })
            }
          }}
          disabled={!canUndo || state.eyedropperActive}
          className="bg-gray-900/80 backdrop-blur hover:bg-gray-800/90 text-gray-400 hover:text-gray-200 disabled:text-gray-600 disabled:hover:bg-gray-900/80 p-1.5 rounded transition-colors"
          title={canUndo ? `Undo: ${undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
        >
          <IconUndo className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (canRedo) {
              toast(`Redo: ${redoLabel}`)
              dispatch({ type: 'REDO' })
            }
          }}
          disabled={!canRedo || state.eyedropperActive}
          className="bg-gray-900/80 backdrop-blur hover:bg-gray-800/90 text-gray-400 hover:text-gray-200 disabled:text-gray-600 disabled:hover:bg-gray-900/80 p-1.5 rounded transition-colors"
          title={canRedo ? `Redo: ${redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'}
        >
          <IconRedo className="w-3.5 h-3.5" />
        </button>
        <CanvasMenuInner
          hasMonitors={state.monitors.length > 0}
          hasImage={!!state.sourceImage}
          smartAlign={state.smartAlign}
          canSizeImageToFit={state.monitors.length > 0 && !!state.sourceImage}
          onSizeImageToFit={handleSizeImageToFit}
          onOpenEditorShortcuts={() => setShowEditorShortcuts(true)}
          dispatch={dispatch}
          eyedropperActive={state.eyedropperActive}
        />
      </div>

      {showEditorShortcuts && (
        <EditorShortcutsDialog onClose={() => setShowEditorShortcuts(false)} />
      )}

      {/* Custom scrollbars */}
      <CanvasScrollbars
        dimensions={dimensions}
        monitors={state.monitors}
        sourceImage={state.sourceImage}
        canvasScale={state.canvasScale}
        canvasOffsetX={state.canvasOffsetX}
        canvasOffsetY={state.canvasOffsetY}
        dispatch={dispatch}
      />

      {/* Zoom controls + hint */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5 select-none">
        <div className="bg-gray-900/80 backdrop-blur px-3 py-1.5 rounded text-xs text-gray-400 flex items-center gap-2">
          <button
            onClick={() => {
              const pct = (state.canvasScale / DEFAULT_CANVAS_SCALE) * 100
              const newPct = Math.max(75, Math.floor((pct - 0.5) / 25) * 25)
              dispatch({ type: 'SET_CANVAS_SCALE', scale: (newPct / 100) * DEFAULT_CANVAS_SCALE })
            }}
            className="hover:text-white transition-colors px-1"
            title="Zoom out"
          >
            −
          </button>
          <span>{Math.round((state.canvasScale / DEFAULT_CANVAS_SCALE) * 100)}%</span>
          <button
            onClick={() => {
              const pct = (state.canvasScale / DEFAULT_CANVAS_SCALE) * 100
              const newPct = Math.min(ZOOM_PCT_MAX, Math.ceil((pct + 0.5) / 25) * 25)
              dispatch({ type: 'SET_CANVAS_SCALE', scale: (newPct / 100) * DEFAULT_CANVAS_SCALE })
            }}
            className="hover:text-white transition-colors px-1"
            title="Zoom in"
          >
            +
          </button>
          <div className="w-px h-3 bg-gray-700 mx-0.5" />
          <button
            onClick={fitView}
            className="hover:text-white transition-colors px-1"
            title="Fit view (F)"
          >
            Fit
          </button>
        </div>
        <div className="bg-gray-900/60 backdrop-blur px-2 py-1 rounded text-[10px] text-gray-500">
          Scroll to pan · Ctrl+Scroll to zoom · Right-click drag to pan
        </div>
      </div>

      {/* Drop overlay */}
      {isDragOverCanvas && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur rounded-lg px-6 py-4 text-center">
            <div className="text-blue-400 text-sm font-medium">Drop here</div>
          </div>
        </div>
      )}

      {/* Instructions overlay */}
      {state.monitors.length === 0 && !state.sourceImage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-600">
            <div className="text-lg font-medium mb-1">Editor Canvas</div>
            <div className="text-sm">Add monitors from the sidebar, or drag presets here</div>
            <div className="text-xs mt-2 text-gray-700">
              Scroll to pan · Ctrl+Scroll to zoom · Right-click drag to pan · Drop images here
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Item class for image kebab menu buttons. */
const imageMenuItemClass = 'w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 transition-colors'

/**
 * Dropdown for image kebab: Size image to fit, layout position (if any), bookmark (bookmark/apply/clear), Remove image.
 */
function ImageKebabMenu({
  x, y, canSizeToFit,
  hasLayoutPosition, savedPosition,
  onSizeImageToFit, onSaveImagePosition, onApplyLayoutPosition, onApplySavedPosition, onClearSavedPosition,
  onRemoveImage, onClose,
}: {
  x: number
  y: number
  canSizeToFit: boolean
  hasLayoutPosition: boolean
  savedPosition: { aspectRatio: number } | null
  onSizeImageToFit: () => void
  onSaveImagePosition: () => void
  onApplyLayoutPosition: () => void
  onApplySavedPosition: () => void
  onClearSavedPosition: () => void
  onRemoveImage: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])
  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onSizeImageToFit(); onClose() }}
        disabled={!canSizeToFit}
        className={imageMenuItemClass}
      >
        Size image to fit
      </button>
      <div className="border-t border-gray-700" />
      {hasLayoutPosition && (
        <button onClick={() => { onApplyLayoutPosition(); onClose() }} className={imageMenuItemClass}>
          Apply image position from layout
        </button>
      )}
      <button onClick={() => { onSaveImagePosition(); onClose() }} className={imageMenuItemClass}>
        Bookmark image position
      </button>
      {savedPosition && (
        <>
          <button onClick={() => { onApplySavedPosition(); onClose() }} className={imageMenuItemClass}>
            Apply bookmarked position
          </button>
          <button onClick={() => { onClearSavedPosition(); onClose() }} className={imageMenuItemClass}>
            Clear bookmarked position
          </button>
        </>
      )}
      <div className="border-t border-gray-700" />
      <button
        onClick={() => { onRemoveImage(); onClose() }}
        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
      >
        Remove image
      </button>
    </div>
  )
}

/**
 * Right-click context menu on a monitor.
 */
function MonitorContextMenu({
  x, y, monitor: _monitor, onClose, onRename, onRotate, onDelete, onDuplicate, onSetBezels,
}: {
  x: number; y: number; monitor: Monitor
  onClose: () => void
  onRename: () => void
  onRotate: () => void
  onDelete: () => void
  onDuplicate: () => void
  onSetBezels: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const itemClass = 'w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors'

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-44 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
      style={{ left: x, top: y }}
    >
      <button onClick={onSetBezels} className={itemClass}>
        Set Bezels
      </button>
      <button onClick={onRename} className={itemClass}>
        Rename
      </button>
      <button onClick={onRotate} className={itemClass}>
        Rotate 90°
      </button>
      <button onClick={onDuplicate} className={itemClass}>
        Duplicate
      </button>
      <div className="border-t border-gray-700" />
      <button onClick={onDelete} className={`${itemClass} text-red-400 hover:text-red-300`}>
        Delete
      </button>
    </div>
  )
}

const BEZEL_PRESETS: { label: string; bezels: Bezels }[] = [
  { label: 'None', bezels: { top: 0, bottom: 0, left: 0, right: 0 } },
  { label: 'Thin (5 mm)', bezels: { top: 5, bottom: 5, left: 5, right: 5 } },
  { label: 'Standard (8 mm)', bezels: { top: 8, bottom: 8, left: 8, right: 8 } },
  { label: 'Thick (12 mm)', bezels: { top: 12, bottom: 12, left: 12, right: 12 } },
  { label: 'Laptop-style', bezels: { top: 8, bottom: 18, left: 5, right: 5 } },
  { label: 'TV-style', bezels: { top: 15, bottom: 25, left: 15, right: 15 } },
]

/**
 * Popover for editing a monitor's bezel values.
 * Live preview: changes update the canvas immediately. Only check mark or Remove bezels
 * persist; closing without confirm reverts to the values from when the popover opened.
 */
function BezelEditorPopover({
  monitor, canvasScale, offsetX, offsetY, onClose, onPreview, onConfirm, onCancel,
}: {
  monitor: Monitor
  canvasScale: number
  offsetX: number
  offsetY: number
  onClose: () => void
  onPreview: (bezels: Bezels) => void
  onConfirm: (bezels: Bezels) => void
  onCancel: (originalBezels: Bezels | undefined) => void
}) {
  /** Values when popover opened; restored if user closes without confirming */
  const originalBezelsRef = useRef<Bezels | undefined>(
    monitor.bezels ? { ...monitor.bezels } : undefined
  )

  const [symmetric, setSymmetric] = useState(() => {
    const b = monitor.bezels
    if (!b) return true
    return b.top === b.bottom && b.left === b.right && b.top === b.left
  })
  const [top, setTop] = useState(monitor.bezels?.top ?? 0)
  const [bottom, setBottom] = useState(monitor.bezels?.bottom ?? 0)
  const [left, setLeft] = useState(monitor.bezels?.left ?? 0)
  const [right, setRight] = useState(monitor.bezels?.right ?? 0)

  const popoverRef = useRef<HTMLDivElement>(null)

  const handleCancel = useCallback(() => {
    onCancel(originalBezelsRef.current)
    onClose()
  }, [onCancel, onClose])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) handleCancel()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [handleCancel])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCancel])

  /** Update local state and push to canvas (live preview); does not show toast. */
  const applyPreview = (t: number, b: number, l: number, r: number) => {
    setTop(t); setBottom(b); setLeft(l); setRight(r)
    const hasAny = t > 0 || b > 0 || l > 0 || r > 0
    onPreview(hasAny ? { top: t, bottom: b, left: l, right: r } : { top: 0, bottom: 0, left: 0, right: 0 })
  }

  /** Confirm and close: persist + toast. */
  const confirmApply = () => {
    onConfirm({ top, bottom, left, right })
    onClose()
  }

  const handleChange = (edge: 'top' | 'bottom' | 'left' | 'right', val: number) => {
    const v = Math.max(0, Math.min(30, val))
    if (symmetric) {
      applyPreview(v, v, v, v)
    } else {
      const newVals = { top, bottom, left, right, [edge]: v }
      applyPreview(newVals.top, newVals.bottom, newVals.left, newVals.right)
    }
  }

  const handlePreset = (bezels: Bezels) => {
    applyPreview(bezels.top, bezels.bottom, bezels.left, bezels.right)
    const allSame = bezels.top === bezels.bottom && bezels.left === bezels.right && bezels.top === bezels.left
    setSymmetric(allSame)
  }

  const handleSymmetricToggle = () => {
    const next = !symmetric
    setSymmetric(next)
    if (next) {
      const avg = Math.round(Math.max(top, bottom, left, right))
      applyPreview(avg, avg, avg, avg)
    }
  }

  const cx = monitor.physicalX * canvasScale + offsetX + (monitor.physicalWidth * canvasScale) / 2
  const cy = monitor.physicalY * canvasScale + offsetY + (monitor.physicalHeight * canvasScale) / 2
  const popoverLeft = Math.max(8, Math.min(cx - 128, window.innerWidth - 280))
  const gap = 8
  const bezelPopoverMaxHeight = 420
  const preferredTop = cy + (monitor.physicalHeight * canvasScale) / 2 + gap
  const popoverTop = Math.max(gap, Math.min(preferredTop, window.innerHeight - bezelPopoverMaxHeight - gap))

  const inputClass = 'w-14 bg-gray-800 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-100 text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3"
      style={{ left: popoverLeft, top: popoverTop }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-200">Set Bezels</span>
        <button onClick={handleCancel} className="text-gray-500 hover:text-gray-300 transition-colors text-sm" title="Cancel (revert changes)">✕</button>
      </div>

      {/* Preset dropdown */}
      <div className="mb-3">
        <select
          value=""
          onChange={(e) => {
            const preset = BEZEL_PRESETS.find(p => p.label === e.target.value)
            if (preset) handlePreset(preset.bezels)
          }}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="" disabled>Presets</option>
          {BEZEL_PRESETS.map(p => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Symmetric toggle */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={symmetric}
          onChange={handleSymmetricToggle}
          className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
        />
        <span className="text-xs text-gray-300">Symmetric</span>
      </label>

      {/* Bezel inputs — arranged like a monitor outline */}
      <div className="flex flex-col items-center gap-1.5">
        {/* Top */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 w-9 text-right">Top</span>
          <input
            type="number"
            min={0} max={30} step={1}
            value={top}
            onChange={(e) => handleChange('top', Number(e.target.value))}
            className={inputClass}
          />
          <span className="text-[10px] text-gray-500">mm</span>
        </div>
        {/* Left / Right row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 w-9 text-right">Left</span>
            <input
              type="number"
              min={0} max={30} step={1}
              value={left}
              onChange={(e) => handleChange('left', Number(e.target.value))}
              className={inputClass}
              disabled={symmetric}
            />
          </div>
          <div className="w-6 h-6 border border-gray-600 rounded-sm flex items-center justify-center">
            <div className="w-3 h-2 bg-gray-600 rounded-[1px]" />
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0} max={30} step={1}
              value={right}
              onChange={(e) => handleChange('right', Number(e.target.value))}
              className={inputClass}
              disabled={symmetric}
            />
            <span className="text-[10px] text-gray-500">R</span>
          </div>
        </div>
        {/* Bottom */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 w-9 text-right">Btm</span>
          <input
            type="number"
            min={0} max={30} step={1}
            value={bottom}
            onChange={(e) => handleChange('bottom', Number(e.target.value))}
            className={inputClass}
            disabled={symmetric}
          />
          <span className="text-[10px] text-gray-500">mm</span>
        </div>
      </div>

      {/* Footer buttons — only the check mark or Remove bezels persist to the store */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-700">
        <button
          onClick={() => {
            onConfirm({ top: 0, bottom: 0, left: 0, right: 0 })
            onClose()
          }}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
        >
          Remove bezels
        </button>
        <button
          onClick={confirmApply}
          className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center justify-center"
          title="Apply bezels"
        >
          <IconCheck className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Dropdown menu in the top-right corner of the canvas.
 */
function CanvasMenuInner({
  hasMonitors,
  hasImage,
  smartAlign,
  canSizeImageToFit,
  onSizeImageToFit,
  onOpenEditorShortcuts,
  dispatch,
  eyedropperActive,
}: {
  hasMonitors: boolean
  hasImage: boolean
  smartAlign: boolean
  canSizeImageToFit: boolean
  onSizeImageToFit: () => void
  onOpenEditorShortcuts: () => void
  dispatch: Dispatch<any>
  eyedropperActive: boolean
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  // Close menu when eyedropper is activated so user can't use canvas options while sampling
  useEffect(() => {
    if (eyedropperActive) setOpen(false)
  }, [eyedropperActive])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={eyedropperActive}
        className="bg-gray-900/80 backdrop-blur hover:bg-gray-800/90 text-gray-400 hover:text-gray-200 disabled:text-gray-600 disabled:hover:bg-gray-900/80 px-2 py-1.5 rounded transition-colors"
        title="Canvas options"
      >
        <IconKebabVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={() => {
              onOpenEditorShortcuts()
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Editor shortcuts
          </button>
          <div className="border-t border-gray-700" />
          <button
            onClick={() => {
              dispatch({ type: 'TOGGLE_SMART_ALIGN' })
              toast(smartAlign ? 'Align Assist disabled' : 'Align Assist enabled')
              setOpen(false)
            }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
              smartAlign ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            Align Assist
            <span className="shrink-0 w-4 h-4 flex items-center justify-center">
              {smartAlign ? (
                <svg className="w-4 h-4" viewBox="0 0 16 16">
                  <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" className="text-blue-400" />
                  <path d="M4 8l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="12" height="12" rx="1" />
                </svg>
              )}
            </span>
          </button>
          <button
            disabled={!canSizeImageToFit}
            onClick={() => {
              onSizeImageToFit()
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300 disabled:cursor-default transition-colors"
          >
            Size image to fit
          </button>
          <div className="border-t border-gray-700" />
          <button
            disabled={!hasMonitors}
            onClick={() => {
              dispatch({ type: 'CLEAR_ALL_MONITORS' })
              toast('All monitors cleared')
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300 disabled:cursor-default transition-colors"
          >
            Clear all monitors
          </button>
          <button
            disabled={!hasImage}
            onClick={() => {
              dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
              toast('Image removed')
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300 disabled:cursor-default transition-colors"
          >
            Remove image
          </button>
          <div className="border-t border-gray-700" />
          <button
            disabled={!hasMonitors && !hasImage}
            onClick={() => {
              dispatch({ type: 'CLEAR_ALL_MONITORS' })
              dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
              toast.warning('Canvas reset')
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-red-400 disabled:cursor-default transition-colors"
          >
            Reset canvas
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Custom scrollbar overlays that show viewport position relative to content.
 */
function CanvasScrollbars({
  dimensions,
  monitors,
  sourceImage,
  canvasScale,
  canvasOffsetX,
  canvasOffsetY,
  dispatch,
}: {
  dimensions: { width: number; height: number }
  monitors: Monitor[]
  sourceImage: SourceImage | null
  canvasScale: number
  canvasOffsetX: number
  canvasOffsetY: number
  dispatch: React.Dispatch<any>
}) {
  const SCROLLBAR_SIZE = 8
  const MIN_THUMB = 30
  const MARGIN = 2

  // Calculate content bounds in physical space
  const contentBounds = useMemo(() => {
    let minX = 0, minY = 0, maxX = 50, maxY = 30
    for (const m of monitors) {
      minX = Math.min(minX, m.physicalX)
      minY = Math.min(minY, m.physicalY)
      maxX = Math.max(maxX, m.physicalX + m.physicalWidth)
      maxY = Math.max(maxY, m.physicalY + m.physicalHeight)
    }
    if (sourceImage) {
      minX = Math.min(minX, sourceImage.physicalX)
      minY = Math.min(minY, sourceImage.physicalY)
      maxX = Math.max(maxX, sourceImage.physicalX + sourceImage.physicalWidth)
      maxY = Math.max(maxY, sourceImage.physicalY + sourceImage.physicalHeight)
    }
    // Add padding in physical space
    const padX = (maxX - minX) * 0.3
    const padY = (maxY - minY) * 0.3
    return {
      minX: minX - padX,
      minY: minY - padY,
      maxX: maxX + padX,
      maxY: maxY + padY,
    }
  }, [monitors, sourceImage])

  // Convert content bounds to canvas pixels
  const contentMinCX = contentBounds.minX * canvasScale + canvasOffsetX
  const contentMaxCX = contentBounds.maxX * canvasScale + canvasOffsetX
  const contentMinCY = contentBounds.minY * canvasScale + canvasOffsetY
  const contentMaxCY = contentBounds.maxY * canvasScale + canvasOffsetY

  const totalW = contentMaxCX - contentMinCX
  const totalH = contentMaxCY - contentMinCY

  // Horizontal scrollbar
  const hTrackWidth = dimensions.width - SCROLLBAR_SIZE - MARGIN * 2
  const hThumbRatio = Math.min(1, dimensions.width / totalW)
  const hThumbWidth = Math.max(MIN_THUMB, hTrackWidth * hThumbRatio)
  const hScrollRange = hTrackWidth - hThumbWidth
  const hContentScroll = totalW > dimensions.width ? (0 - contentMinCX) / (totalW - dimensions.width) : 0
  const hThumbLeft = Math.max(0, Math.min(hScrollRange, hScrollRange * hContentScroll))

  // Vertical scrollbar
  const vTrackHeight = dimensions.height - SCROLLBAR_SIZE - MARGIN * 2
  const vThumbRatio = Math.min(1, dimensions.height / totalH)
  const vThumbHeight = Math.max(MIN_THUMB, vTrackHeight * vThumbRatio)
  const vScrollRange = vTrackHeight - vThumbHeight
  const vContentScroll = totalH > dimensions.height ? (0 - contentMinCY) / (totalH - dimensions.height) : 0
  const vThumbTop = Math.max(0, Math.min(vScrollRange, vScrollRange * vContentScroll))

  const showH = hThumbRatio < 0.99
  const showV = vThumbRatio < 0.99

  // Drag state refs
  const hDragging = useRef(false)
  const vDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, thumbPos: 0 })

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (hDragging.current) {
        const delta = e.clientX - dragStart.current.x
        const newThumb = Math.max(0, Math.min(hScrollRange, dragStart.current.thumbPos + delta))
        const scrollFraction = hScrollRange > 0 ? newThumb / hScrollRange : 0
        const newContentMinCX = -scrollFraction * (totalW - dimensions.width)
        const newOffsetX = newContentMinCX - contentBounds.minX * canvasScale
        dispatch({ type: 'SET_CANVAS_OFFSET', x: newOffsetX, y: canvasOffsetY })
      }
      if (vDragging.current) {
        const delta = e.clientY - dragStart.current.y
        const newThumb = Math.max(0, Math.min(vScrollRange, dragStart.current.thumbPos + delta))
        const scrollFraction = vScrollRange > 0 ? newThumb / vScrollRange : 0
        const newContentMinCY = -scrollFraction * (totalH - dimensions.height)
        const newOffsetY = newContentMinCY - contentBounds.minY * canvasScale
        dispatch({ type: 'SET_CANVAS_OFFSET', x: canvasOffsetX, y: newOffsetY })
      }
    }
    const handleUp = () => {
      hDragging.current = false
      vDragging.current = false
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [hScrollRange, vScrollRange, totalW, totalH, dimensions, contentBounds, canvasScale, canvasOffsetX, canvasOffsetY, dispatch])

  return (
    <>
      {/* Horizontal scrollbar */}
      {showH && (
        <div
          className="absolute left-0 bg-transparent"
          style={{
            bottom: MARGIN,
            height: SCROLLBAR_SIZE,
            width: hTrackWidth,
            left: MARGIN,
          }}
        >
          <div
            className="absolute top-0 h-full rounded-full bg-gray-600/40 hover:bg-gray-500/50 cursor-pointer transition-colors"
            style={{
              left: hThumbLeft,
              width: hThumbWidth,
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              hDragging.current = true
              dragStart.current = { x: e.clientX, y: e.clientY, thumbPos: hThumbLeft }
            }}
          />
        </div>
      )}
      {/* Vertical scrollbar */}
      {showV && (
        <div
          className="absolute top-0 bg-transparent"
          style={{
            right: MARGIN,
            width: SCROLLBAR_SIZE,
            height: vTrackHeight,
            top: MARGIN,
          }}
        >
          <div
            className="absolute left-0 w-full rounded-full bg-gray-600/40 hover:bg-gray-500/50 cursor-pointer transition-colors"
            style={{
              top: vThumbTop,
              height: vThumbHeight,
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              vDragging.current = true
              dragStart.current = { x: e.clientX, y: e.clientY, thumbPos: vThumbTop }
            }}
          />
        </div>
      )}
    </>
  )
}
