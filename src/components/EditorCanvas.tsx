import React, { useRef, useEffect, useCallback, useState, useMemo, type Dispatch } from 'react'
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useStore } from '../store'
import { formatDimension, getMonitorsBoundingBox } from '../utils'
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    const newScale = Math.max(2, Math.min(20, Math.min(scaleX, scaleY)))
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
  const offsetX = state.canvasOffsetX
  const offsetY = state.canvasOffsetY

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
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Ctrl+Scroll = Zoom (toward pointer)
      const oldScale = state.canvasScale
      const zoomFactor = e.evt.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(2, Math.min(20, oldScale * zoomFactor))
      const physX = (pointer.x - state.canvasOffsetX) / oldScale
      const physY = (pointer.y - state.canvasOffsetY) / oldScale
      const newOffsetX = pointer.x - physX * newScale
      const newOffsetY = pointer.y - physY * newScale

      dispatch({ type: 'SET_CANVAS_SCALE', scale: newScale })
      dispatch({ type: 'SET_CANVAS_OFFSET', x: newOffsetX, y: newOffsetY })
    } else {
      // Normal scroll = Pan (vertical by default, horizontal with Shift)
      if (e.evt.shiftKey) {
        dispatch({ type: 'PAN_CANVAS', dx: -e.evt.deltaY, dy: 0 })
      } else {
        dispatch({ type: 'PAN_CANVAS', dx: -e.evt.deltaX, dy: -e.evt.deltaY })
      }
    }
  }, [state.canvasScale, state.canvasOffsetX, state.canvasOffsetY, dispatch])

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
      dispatch({ type: 'PAN_CANVAS', dx, dy })
    }
  }, [isDraggingCanvas, dispatch])

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
        // Calculate physical position from drop coordinates
        const container = containerRef.current
        if (container) {
          const rect = container.getBoundingClientRect()
          const canvasX = e.clientX - rect.left
          const canvasY = e.clientY - rect.top
          const physX = (canvasX - state.canvasOffsetX) / state.canvasScale
          const physY = (canvasY - state.canvasOffsetY) / state.canvasScale
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
        const bbox = getMonitorsBoundingBox(state.monitors)
        const imgAspect = img.naturalWidth / img.naturalHeight
        let physWidth: number, physHeight: number

        if (bbox.width > 0 && bbox.height > 0) {
          const bboxAspect = bbox.width / bbox.height
          if (imgAspect > bboxAspect) {
            physHeight = bbox.height * 1.1
            physWidth = physHeight * imgAspect
          } else {
            physWidth = bbox.width * 1.1
            physHeight = physWidth / imgAspect
          }
        } else {
          physWidth = 30
          physHeight = physWidth / imgAspect
        }

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
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [state.monitors, state.canvasOffsetX, state.canvasOffsetY, state.canvasScale, state.snapToGrid, state.gridSize, dispatch])

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
  const unitMultiplier = state.unit === 'cm' ? 2.54 : 1

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

  // Grid labels
  const gridLabels: React.ReactNode[] = []
  if (gridSpacing > 20) {
    const majorStep = 5 * state.gridSize
    const startXLabel = Math.floor(-offsetX / (majorStep * scale)) * majorStep
    for (let physX = startXLabel; physX * scale + offsetX < dimensions.width; physX += majorStep) {
      const cx = physX * scale + offsetX
      if (cx < 30 || cx > dimensions.width) continue
      const displayVal = state.unit === 'cm' ? (physX * unitMultiplier).toFixed(0) : physX.toFixed(0)
      gridLabels.push(
        <Text key={`lx-${physX}`} x={cx + 2} y={2} text={displayVal} fontSize={9} fill="#475569" listening={false} />
      )
    }
    const startYLabel = Math.floor(-offsetY / (majorStep * scale)) * majorStep
    for (let physY = startYLabel; physY * scale + offsetY < dimensions.height; physY += majorStep) {
      const cy = physY * scale + offsetY
      if (cy < 15 || cy > dimensions.height) continue
      const displayVal = state.unit === 'cm' ? (physY * unitMultiplier).toFixed(0) : physY.toFixed(0)
      gridLabels.push(
        <Text key={`ly-${physY}`} x={2} y={cy + 2} text={displayVal} fontSize={9} fill="#475569" listening={false} />
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

  // Handle image drag
  const handleImageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const newPhysX = toPhysicalX(node.x())
    const newPhysY = toPhysicalY(node.y())
    dispatch({ type: 'MOVE_IMAGE', x: newPhysX, y: newPhysY })
  }, [dispatch, toPhysicalX, toPhysicalY])

  // Handle image transform (resize via handles)
  const handleImageTransformEnd = useCallback(() => {
    const node = imageRef.current
    if (!node || !state.sourceImage) return

    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const newCanvasW = node.width() * scaleX
    const newCanvasH = node.height() * scaleY
    const newPhysW = newCanvasW / scale
    const newPhysH = newCanvasH / scale
    const newPhysX = toPhysicalX(node.x())
    const newPhysY = toPhysicalY(node.y())

    // Reset the Konva node's scale (we store size in state)
    node.scaleX(1)
    node.scaleY(1)

    dispatch({ type: 'MOVE_IMAGE', x: newPhysX, y: newPhysY })
    dispatch({ type: 'SCALE_IMAGE', physicalWidth: newPhysW, physicalHeight: newPhysH })
  }, [dispatch, scale, toPhysicalX, toPhysicalY, state.sourceImage])

  // Render source image
  const imageNode = state.sourceImage ? (
    <KonvaImage
      ref={imageRef}
      image={state.sourceImage.element}
      x={toCanvasX(state.sourceImage.physicalX)}
      y={toCanvasY(state.sourceImage.physicalY)}
      width={state.sourceImage.physicalWidth * scale}
      height={state.sourceImage.physicalHeight * scale}
      opacity={0.7}
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
      onTransformEnd={handleImageTransformEnd}
    />
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
        {/* Label background */}
        <Rect
          x={4}
          y={4}
          width={Math.min(Math.max(cw - 8, 60), 200)}
          height={cw > 100 ? 44 : 28}
          fill="rgba(0,0,0,0.75)"
          cornerRadius={3}
          listening={false}
        />
        {/* Monitor name */}
        <Text
          x={8}
          y={7}
          text={monitor.preset.name}
          fontSize={cw > 100 ? 11 : 9}
          fill="#ffffff"
          fontStyle="bold"
          listening={false}
          width={Math.min(Math.max(cw - 16, 50), 190)}
          ellipsis
          wrap="none"
        />
        {/* Resolution + physical dimensions */}
        {cw > 100 && (
          <Text
            x={8}
            y={21}
            text={`${monitor.preset.resolutionX}x${monitor.preset.resolutionY} · ${formatDimension(monitor.physicalWidth, state.unit)} x ${formatDimension(monitor.physicalHeight, state.unit)}`}
            fontSize={9}
            fill="#94a3b8"
            listening={false}
            width={Math.min(Math.max(cw - 16, 50), 190)}
            ellipsis
            wrap="none"
          />
        )}
        {cw > 100 && (
          <Text
            x={8}
            y={33}
            text={`${Math.round(monitor.ppi)} PPI`}
            fontSize={9}
            fill="#64748b"
            listening={false}
          />
        )}
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

  return (
    <div
      ref={containerRef}
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
          {originLines}
          {gridLabels}
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

      {/* Canvas menu (top-right) */}
      <CanvasMenu
        hasMonitors={state.monitors.length > 0}
        hasImage={!!state.sourceImage}
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
            onClick={() => dispatch({ type: 'SET_CANVAS_SCALE', scale: state.canvasScale * 0.8 })}
            className="hover:text-white transition-colors px-1"
            title="Zoom out"
          >
            −
          </button>
          <span>{Math.round(state.canvasScale)}px/in</span>
          <button
            onClick={() => dispatch({ type: 'SET_CANVAS_SCALE', scale: state.canvasScale * 1.25 })}
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
  dispatch,
}: {
  hasMonitors: boolean
  hasImage: boolean
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
    <div ref={menuRef} className="absolute top-3 right-3 select-none z-10">
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
