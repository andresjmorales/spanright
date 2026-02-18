import React, { useRef, useEffect, useCallback, useState, useMemo, type Dispatch } from 'react'
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useStore } from '../store'
import { formatDimension, getMonitorsBoundingBox, getMonitorDisplayName } from '../utils'
import type { Monitor, SourceImage } from '../types'

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
const DEFAULT_SCALE = 10

// Physical workspace bounds (inches) — ~12ft x 8ft
const PHYS_MIN_X = 0
const PHYS_MAX_X = 144
const PHYS_MIN_Y = 0
const PHYS_MAX_Y = 96

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
  const { state, dispatch } = useStore()
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
  const [renameMonitorId, setRenameMonitorId] = useState<string | null>(null)
  const [renameInputValue, setRenameInputValue] = useState('')
  // Refs for values used in hot-path event handlers (avoids callback recreation)
  const canvasStateRef = useRef({ scale: 10, offsetX: 50, offsetY: 50, dimW: 800, dimH: 500 })

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

      // Delete selected monitor
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedMonitorId && !imageSelected) {
        dispatch({ type: 'REMOVE_MONITOR', id: state.selectedMonitorId })
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_MONITOR', id: null })
        setImageSelected(false)
      }
      // F key to fit view
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        fitView()
      }
      // Arrow keys to nudge selected monitor
      if (state.selectedMonitorId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const mon = state.monitors.find(m => m.id === state.selectedMonitorId)
        if (mon) {
          // Shift = fine (0.1"), default = 1", Ctrl = large (5")
          const step = e.shiftKey ? 0.1 : e.ctrlKey ? 5 : 1
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
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  // Fit view to all monitors
  const fitView = useCallback(() => {
    if (state.monitors.length === 0) return
    const bbox = getMonitorsBoundingBox(state.monitors)
    const padding = 40 // canvas pixels of padding
    const availW = dimensions.width - padding * 2
    const availH = dimensions.height - padding * 2
    const scaleX = availW / bbox.width
    const scaleY = availH / bbox.height
    const newScale = Math.max(7.5, Math.min(30, Math.min(scaleX, scaleY)))
    const newOffsetX = padding - bbox.minX * newScale + (availW - bbox.width * newScale) / 2
    const newOffsetY = padding - bbox.minY * newScale + (availH - bbox.height * newScale) / 2
    dispatch({ type: 'SET_CANVAS_SCALE', scale: newScale })
    dispatch({ type: 'SET_CANVAS_OFFSET', x: newOffsetX, y: newOffsetY })
  }, [state.monitors, dimensions, dispatch])

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
      const newScale = Math.max(7.5, Math.min(30, cs.scale * zoomFactor))
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

  // Middle-mouse or right-click for panning
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
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
  }, [dispatch])

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

  // Prevent context menu on canvas
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
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
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const imgAspect = img.naturalWidth / img.naturalHeight
        const sixFeet = 72 // inches
        const physWidth = img.naturalHeight > img.naturalWidth ? sixFeet * imgAspect : sixFeet
        const physHeight = img.naturalHeight > img.naturalWidth ? sixFeet : sixFeet / imgAspect

        // Center on current viewport
        const container = containerRef.current
        const viewW = container?.clientWidth ?? 800
        const viewH = container?.clientHeight ?? 500
        const centerPhysX = (viewW / 2 - state.canvasOffsetX) / state.canvasScale
        const centerPhysY = (viewH / 2 - state.canvasOffsetY) / state.canvasScale

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
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [state.canvasOffsetX, state.canvasOffsetY, state.canvasScale, state.snapToGrid, state.gridSize, dispatch])

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
  const handleMonitorDragEnd = useCallback((monitor: Monitor, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const newPhysX = snap(toPhysicalX(node.x()))
    const newPhysY = snap(toPhysicalY(node.y()))
    dispatch({ type: 'MOVE_MONITOR', id: monitor.id, x: newPhysX, y: newPhysY })
    node.position({ x: toCanvasX(newPhysX), y: toCanvasY(newPhysY) })
  }, [dispatch, snap, toPhysicalX, toPhysicalY, toCanvasX, toCanvasY])

  // Handle image drag (Group position is image center)
  const handleImageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
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

    dispatch({ type: 'MOVE_IMAGE', x: newPhysX, y: newPhysY })
    dispatch({ type: 'SCALE_IMAGE', physicalWidth: newPhysW, physicalHeight: newPhysH })
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
      }}
      onTap={() => {
        setImageSelected(true)
        dispatch({ type: 'SELECT_MONITOR', id: null })
      }}
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
          const box = n.getClientRect({ skipTransform: false, relativeTo: group })
          const x = box.x + box.width - 22
          const y = box.y + 4
          if (Number.isFinite(x) && Number.isFinite(y)) setImageDeleteButtonPos({ x, y })
        }}
        onTransformEnd={handleImageTransformEnd}
      />
      {/* Delete button — top-right, follows visual corner during resize (any handle) */}
      {imageSelected && (
        <Group
          x={imageDeleteButtonPos ? imageDeleteButtonPos.x : imgW - 22}
          y={imageDeleteButtonPos ? imageDeleteButtonPos.y : 4}
          onClick={(e) => {
            e.cancelBubble = true
            setImageSelected(false)
            dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
          }}
          onTap={(e) => {
            e.cancelBubble = true
            setImageSelected(false)
            dispatch({ type: 'CLEAR_SOURCE_IMAGE' })
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

    return (
      <Group
        key={monitor.id}
        x={cx}
        y={cy}
        draggable
        onDragEnd={(e) => handleMonitorDragEnd(monitor, e)}
        onClick={() => {
          dispatch({ type: 'SELECT_MONITOR', id: monitor.id })
          setImageSelected(false)
        }}
        onTap={() => {
          dispatch({ type: 'SELECT_MONITOR', id: monitor.id })
          setImageSelected(false)
        }}
      >
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
        {/* Delete button */}
        {isSelected && (
          <Group
            x={cw - 22}
            y={4}
            onClick={(e) => {
              e.cancelBubble = true
              dispatch({ type: 'REMOVE_MONITOR', id: monitor.id })
            }}
            onTap={(e) => {
              e.cancelBubble = true
              dispatch({ type: 'REMOVE_MONITOR', id: monitor.id })
            }}
          >
            <Rect width={18} height={18} fill="#ef4444" cornerRadius={3} />
            <Text x={4} y={1} text="✕" fontSize={12} fill="#ffffff" />
          </Group>
        )}
        {/* Pencil icon — rename (when selected), left of rotate */}
        {isSelected && (
          <Group
            x={cw - 42}
            y={ch - 22}
            onClick={(e) => {
              e.cancelBubble = true
              setRenameMonitorId(monitor.id)
              setRenameInputValue(getMonitorDisplayName(monitor))
            }}
            onTap={(e) => {
              e.cancelBubble = true
              setRenameMonitorId(monitor.id)
              setRenameInputValue(getMonitorDisplayName(monitor))
            }}
          >
            <Rect width={16} height={16} fill="#64748b" cornerRadius={2} />
            <Text x={2} y={1} text="✎" fontSize={11} fill="#e2e8f0" />
          </Group>
        )}
        {/* Rotate 90° button — bottom-right */}
        <Group
          x={cw - 22}
          y={ch - 22}
          onClick={(e) => {
            e.cancelBubble = true
            dispatch({ type: 'ROTATE_MONITOR', id: monitor.id })
          }}
          onTap={(e) => {
            e.cancelBubble = true
            dispatch({ type: 'ROTATE_MONITOR', id: monitor.id })
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
        style={{ cursor: isDraggingCanvas ? 'grabbing' : 'default' }}
      >
        <Layer>
          <Rect width={dimensions.width} height={dimensions.height} fill="#0a0a1a" listening={false} />
          {gridLines}
          {workspaceBorder}
          {originLines}
        </Layer>
        <Layer>
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

      {/* Rulers */}
      <RulerOverlay
        width={dimensions.width}
        height={dimensions.height}
        canvasScale={scale}
        canvasOffsetX={offsetX}
        canvasOffsetY={offsetY}
        unit={state.unit}
      />

      {/* Canvas menu (top-right) */}
      <CanvasMenu
        hasMonitors={state.monitors.length > 0}
        hasImage={!!state.sourceImage}
        snapToGrid={state.snapToGrid}
        dispatch={dispatch}
      />

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
              const pct = (state.canvasScale / DEFAULT_SCALE) * 100
              const newPct = Math.max(75, Math.floor((pct - 0.5) / 25) * 25)
              dispatch({ type: 'SET_CANVAS_SCALE', scale: (newPct / 100) * DEFAULT_SCALE })
            }}
            className="hover:text-white transition-colors px-1"
            title="Zoom out"
          >
            −
          </button>
          <span>{Math.round((state.canvasScale / DEFAULT_SCALE) * 100)}%</span>
          <button
            onClick={() => {
              const pct = (state.canvasScale / DEFAULT_SCALE) * 100
              const newPct = Math.min(300, Math.ceil((pct + 0.5) / 25) * 25)
              dispatch({ type: 'SET_CANVAS_SCALE', scale: (newPct / 100) * DEFAULT_SCALE })
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

/**
 * Dropdown menu in the top-right corner of the canvas.
 */
function CanvasMenu({
  hasMonitors,
  hasImage,
  snapToGrid,
  dispatch,
}: {
  hasMonitors: boolean
  hasImage: boolean
  snapToGrid: boolean
  dispatch: Dispatch<any>
}) {
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

  return (
    <div ref={menuRef} className="absolute top-8 right-3 select-none z-10">
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-gray-900/80 backdrop-blur hover:bg-gray-800/90 text-gray-400 hover:text-gray-200 px-2 py-1.5 rounded transition-colors"
        title="Canvas options"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={() => {
              dispatch({ type: 'TOGGLE_SNAP' })
              setOpen(false)
            }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
              snapToGrid ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            Snap to Grid
            <span className="shrink-0 w-4 h-4 flex items-center justify-center">
              {snapToGrid ? (
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
          <div className="border-t border-gray-700" />
          <button
            disabled={!hasMonitors}
            onClick={() => {
              dispatch({ type: 'CLEAR_ALL_MONITORS' })
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
