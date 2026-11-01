import React, { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { Monitor, SourceImage, MonitorPreset, WindowsMonitorPosition, ActiveTab, Bezels, FillMode, SavedImagePosition, SavedWindowsPosition, OutputFormat } from './types'
import { createMonitor, getMonitorDisplayName, getSourceImageAspect } from './utils'

const MAX_HISTORY = 50

const CUSTOM_PRESETS_STORAGE_KEY = 'spanright-custom-presets-v1'

/** Canvas zoom: scale = pixels per inch. 100% = DEFAULT_CANVAS_SCALE. */
export const CANVAS_SCALE_MIN = 7.5
export const CANVAS_SCALE_MAX = 40
export const DEFAULT_CANVAS_SCALE = 10

interface UndoableSnapshot {
  monitors: Monitor[]
  sourceImage: SourceImage | null
  windowsArrangement: WindowsMonitorPosition[]
  useWindowsArrangement: boolean
  selectedMonitorId: string | null
  label: string
}

type PresetGroupId = 'laptops' | 'standard' | 'ultrawides' | 'custom'

const DEFAULT_PRESET_GROUP_EXPANDED: Record<PresetGroupId, boolean> = {
  laptops: true,
  standard: true,
  ultrawides: true,
  custom: true,
}

interface State {
  monitors: Monitor[]
  sourceImage: SourceImage | null
  canvasScale: number
  canvasOffsetX: number
  canvasOffsetY: number
  unit: 'inches' | 'cm'
  selectedMonitorId: string | null
  snapToGrid: boolean
  gridSize: number // in inches
  smartAlign: boolean
  // Windows arrangement
  windowsArrangement: WindowsMonitorPosition[]
  useWindowsArrangement: boolean
  activeTab: ActiveTab
  showTroubleshootingGuide: boolean
  showHowItWorks: boolean
  // Fill (empty area) options — not undoable
  fillMode: FillMode
  fillSolidColor: string
  /** Preferred output format for download (PNG/JPEG). */
  outputFormat: OutputFormat
  /** JPEG quality (percentage, 50–100) for exports when using JPEG. */
  jpegQuality: number
  /** Most recently used custom monitor presets (up to 24), persisted in localStorage. */
  customPresets: MonitorPreset[]
  eyedropperActive: boolean
  /** Monitor presets sidebar collapsed (persists across tab switch so eyedropper→preview→canvas keeps it collapsed) */
  presetsSidebarCollapsed: boolean
  /** Per-category expanded state for monitor presets sidebar (persists across tab switch) */
  presetsGroupExpanded: Record<PresetGroupId, boolean>
  /** Active layout name (set when loading/saving a layout); null = use "_default" for image position bookmark key */
  activeLayoutName: string | null
  /** Image position from the current layout (set when loading or saving a layout); used for upload and Apply from layout */
  loadedLayoutImagePosition: SavedImagePosition | null
  // Undo/redo (internal)
  _undoStack: UndoableSnapshot[]
  _redoStack: UndoableSnapshot[]
  _continuousKey: string | null
}

type Action =
  | { type: 'ADD_MONITOR'; preset: MonitorPreset; x: number; y: number; rotation?: 0 | 90; displayName?: string }
  | { type: 'REMOVE_MONITOR'; id: string }
  | { type: 'DUPLICATE_MONITOR'; id: string }
  | { type: 'SET_MONITOR_DISPLAY_NAME'; id: string; displayName: string }
  | { type: 'SET_MONITOR_BEZELS'; id: string; bezels: Bezels | undefined }
  | { type: 'ROTATE_MONITOR'; id: string }
  | { type: 'CLEAR_ALL_MONITORS' }
  | { type: 'MOVE_MONITOR'; id: string; x: number; y: number }
  | { type: 'SELECT_MONITOR'; id: string | null }
  | { type: 'SET_SOURCE_IMAGE'; image: SourceImage }
  | { type: 'CLEAR_SOURCE_IMAGE' }
  | { type: 'ROTATE_SOURCE_IMAGE' }
  | { type: 'MOVE_IMAGE'; x: number; y: number }
  | { type: 'SCALE_IMAGE'; physicalWidth: number; physicalHeight: number }
  | { type: 'SET_IMAGE_TRANSFORM'; x: number; y: number; physicalWidth: number; physicalHeight: number }
  | { type: 'SET_CANVAS_SCALE'; scale: number }
  | { type: 'PAN_CANVAS'; dx: number; dy: number }
  | { type: 'SET_CANVAS_OFFSET'; x: number; y: number }
  | { type: 'TOGGLE_UNIT' }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'TOGGLE_SMART_ALIGN' }
  | { type: 'SET_GRID_SIZE'; size: number }
  // Windows arrangement actions
  | { type: 'SET_ACTIVE_TAB'; tab: ActiveTab }
  | { type: 'SET_USE_WINDOWS_ARRANGEMENT'; value: boolean }
  | { type: 'MOVE_WINDOWS_MONITOR'; monitorId: string; pixelX: number; pixelY: number }
  | { type: 'SYNC_WINDOWS_ARRANGEMENT' }
  | { type: 'SET_SHOW_TROUBLESHOOTING_GUIDE'; value: boolean }
  | { type: 'SET_SHOW_HOW_IT_WORKS'; value: boolean }
  // Fill (empty area)
  | { type: 'SET_FILL_MODE'; mode: FillMode }
  | { type: 'SET_FILL_SOLID_COLOR'; color: string }
  | { type: 'SET_EYEDROPPER_ACTIVE'; active: boolean }
  | { type: 'SET_PRESETS_SIDEBAR_COLLAPSED'; collapsed: boolean }
  | { type: 'SET_PRESETS_GROUP_EXPANDED'; groupId: PresetGroupId; expanded: boolean }
  | { type: 'SET_OUTPUT_FORMAT'; format: OutputFormat }
  | { type: 'SET_JPEG_QUALITY'; quality: number }
  | { type: 'ADD_RECENT_CUSTOM_PRESET'; preset: MonitorPreset }
  | { type: 'REMOVE_RECENT_CUSTOM_PRESET'; index: number }
  | { type: 'SET_ACTIVE_LAYOUT_NAME'; name: string | null }
  | { type: 'SET_LOADED_LAYOUT_IMAGE_POSITION'; position: SavedImagePosition | null }
  | { type: 'CLEAR_LOADED_LAYOUT_IMAGE_POSITION' }
  // Composite / undo-redo
  | { type: 'LOAD_LAYOUT'; monitors: { preset: MonitorPreset; physicalX: number; physicalY: number; rotation?: 0 | 90; displayName?: string; bezels?: Bezels }[]; layoutName?: string; imagePosition?: SavedImagePosition | null; windowsArrangement?: SavedWindowsPosition[] | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }

const UNIT_STORAGE_KEY = 'spanright-unit'

function getInitialUnit(): 'inches' | 'cm' {
  try {
    return localStorage.getItem(UNIT_STORAGE_KEY) === 'cm' ? 'cm' : 'inches'
  } catch {
    return 'inches'
  }
}

function loadCustomPresets(): MonitorPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is MonitorPreset =>
      p &&
      typeof p.name === 'string' &&
      typeof p.diagonal === 'number' &&
      Array.isArray(p.aspectRatio) &&
      p.aspectRatio.length === 2 &&
      typeof p.aspectRatio[0] === 'number' &&
      typeof p.aspectRatio[1] === 'number' &&
      typeof p.resolutionX === 'number' &&
      typeof p.resolutionY === 'number'
    ).slice(-24)
  } catch {
    return []
  }
}

function saveCustomPresets(presets: MonitorPreset[]) {
  try {
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets.slice(-24)))
  } catch {
    /* ignore */
  }
}

const initialState: State = {
  monitors: [],
  sourceImage: null,
  canvasScale: DEFAULT_CANVAS_SCALE,
  canvasOffsetX: 50,
  canvasOffsetY: 50,
  unit: getInitialUnit(),
  selectedMonitorId: null,
  snapToGrid: false,
  gridSize: 1,
  smartAlign: true,
  windowsArrangement: [],
  useWindowsArrangement: false,
  activeTab: 'physical',
  showTroubleshootingGuide: false,
  showHowItWorks: false,
  fillMode: 'solid',
  fillSolidColor: '#000000',
  outputFormat: 'png',
  jpegQuality: 92,
  customPresets: loadCustomPresets(),
  eyedropperActive: false,
  presetsSidebarCollapsed: false,
  presetsGroupExpanded: { ...DEFAULT_PRESET_GROUP_EXPANDED },
  activeLayoutName: null,
  loadedLayoutImagePosition: null,
  _undoStack: [],
  _redoStack: [],
  _continuousKey: null,
}

/** Strip width in pixels for output (depends on rotation). */
function getMonitorStripWidth(m: Monitor): number {
  return (m.rotation ?? 0) === 90 ? m.preset.resolutionY : m.preset.resolutionX
}

function getMonitorStripHeight(m: Monitor): number {
  return (m.rotation ?? 0) === 90 ? m.preset.resolutionX : m.preset.resolutionY
}

/** True when two monitors are physically one above the other (they share more width than height). */
function arePhysicallyStacked(a: Monitor, b: Monitor): boolean {
  const xOverlap = Math.min(a.physicalX + a.physicalWidth, b.physicalX + b.physicalWidth) - Math.max(a.physicalX, b.physicalX)
  const yOverlap = Math.min(a.physicalY + a.physicalHeight, b.physicalY + b.physicalHeight) - Math.max(a.physicalY, b.physicalY)
  return xOverlap > 0 && xOverlap > Math.max(0, yOverlap)
}

/**
 * How a stacked monitor most likely lines up with its neighbor in the OS arrangement:
 * 0 = left edges aligned, 0.5 = centered, 1 = right edges aligned — whichever is
 * closest to the physical horizontal offset (ties prefer centered).
 */
export function stackedAlignment(m: Monitor, n: Monitor): 0 | 0.5 | 1 {
  const left = Math.abs(m.physicalX - n.physicalX)
  const center = Math.abs(m.physicalX + m.physicalWidth / 2 - (n.physicalX + n.physicalWidth / 2))
  const right = Math.abs(m.physicalX + m.physicalWidth - (n.physicalX + n.physicalWidth))
  if (center <= left && center <= right) return 0.5
  return left <= right ? 0 : 1
}

/**
 * Generate a default (auto) Windows arrangement from the physical layout.
 *
 * Side-by-side layouts: same left-to-right order, all top-aligned, laid out by pixel width.
 * Layouts with physically stacked monitors: each monitor is attached to its nearest
 * already-placed neighbor — stacked neighbors go above/below, side-by-side neighbors go
 * left/right, top-aligned.
 *
 * Stacked monitors are left-aligned, centered or right-aligned with their neighbor,
 * whichever is closest to the physical offset. Users rarely hand-tune a stacked
 * arrangement in their OS to match the desk exactly, so the likeliest real arrangement
 * is one of these snapped alignments rather than the proportional physical offset.
 */
export function generateDefaultWindowsArrangement(monitors: Monitor[]): WindowsMonitorPosition[] {
  const sorted = [...monitors].sort((a, b) => a.physicalX - b.physicalX)
  const hasStack = monitors.some((a, i) => monitors.some((b, j) => i < j && arePhysicallyStacked(a, b)))
  if (!hasStack) {
    let xOffset = 0
    return sorted.map(m => {
      const pos: WindowsMonitorPosition = {
        monitorId: m.id,
        pixelX: xOffset,
        pixelY: 0,
      }
      xOffset += getMonitorStripWidth(m)
      return pos
    })
  }

  type Placed = { m: Monitor; x: number; y: number; w: number; h: number }
  const cx = (m: Monitor) => m.physicalX + m.physicalWidth / 2
  const cy = (m: Monitor) => m.physicalY + m.physicalHeight / 2
  const first = sorted[0]
  const placed: Placed[] = [{ m: first, x: 0, y: 0, w: getMonitorStripWidth(first), h: getMonitorStripHeight(first) }]
  const remaining = sorted.slice(1)
  const overlapsPlaced = (x: number, y: number, w: number, h: number) =>
    placed.some(p => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y)

  while (remaining.length > 0) {
    // Nearest (by physical center) unplaced monitor to any placed one
    let best = { i: 0, n: placed[0], d: Infinity }
    remaining.forEach((m, i) => {
      for (const n of placed) {
        const d = Math.hypot(cx(m) - cx(n.m), cy(m) - cy(n.m))
        if (d < best.d) best = { i, n, d }
      }
    })
    const m = remaining.splice(best.i, 1)[0]
    // Prefer attaching beside a placed monitor in the same row (shares height), so rows stay
    // contiguous; otherwise attach to the nearest monitor.
    const sameRow = placed
      .filter(p => !arePhysicallyStacked(m, p.m) &&
        Math.min(m.physicalY + m.physicalHeight, p.m.physicalY + p.m.physicalHeight) > Math.max(m.physicalY, p.m.physicalY))
      .sort((a, b) => Math.abs(cx(a.m) - cx(m)) - Math.abs(cx(b.m) - cx(m)))[0]
    const n = sameRow ?? best.n
    const w = getMonitorStripWidth(m)
    const h = getMonitorStripHeight(m)
    let x: number, y: number
    if (arePhysicallyStacked(m, n.m)) {
      y = cy(m) > cy(n.m) ? n.y + n.h : n.y - h
      x = Math.round(n.x + stackedAlignment(m, n.m) * (n.w - w))
    } else {
      x = cx(m) > cx(n.m) ? n.x + n.w : n.x - w
      y = n.y
    }
    if (overlapsPlaced(x, y, w, h)) {
      // No free spot next to its neighbor: append on the right, top-aligned
      x = Math.max(...placed.map(p => p.x + p.w))
      y = Math.min(...placed.map(p => p.y))
    }
    placed.push({ m, x, y, w, h })
  }

  const minX = Math.min(...placed.map(p => p.x))
  const minY = Math.min(...placed.map(p => p.y))
  return placed.map(p => ({ monitorId: p.m.id, pixelX: p.x - minX, pixelY: p.y - minY }))
}

/**
 * Arrangement after the monitor list changed (add/remove/duplicate/rotate).
 * Auto mode regenerates from the physical layout. A custom arrangement is kept:
 * existing positions stay put, and any monitor that is new or now overlaps
 * another is appended to the right edge, top-aligned.
 */
function updateArrangementForMonitors(state: State, monitors: Monitor[]): WindowsMonitorPosition[] {
  if (!state.useWindowsArrangement) return generateDefaultWindowsArrangement(monitors)
  const prev = new Map(state.windowsArrangement.map(wp => [wp.monitorId, wp]))
  const placed: { wp: WindowsMonitorPosition; w: number; h: number }[] = []
  const pending: Monitor[] = []
  const overlaps = (x: number, y: number, w: number, h: number) =>
    placed.some(p => x < p.wp.pixelX + p.w && x + w > p.wp.pixelX && y < p.wp.pixelY + p.h && y + h > p.wp.pixelY)
  for (const m of monitors) {
    const wp = prev.get(m.id)
    const w = getMonitorStripWidth(m)
    const h = getMonitorStripHeight(m)
    if (wp && !overlaps(wp.pixelX, wp.pixelY, w, h)) placed.push({ wp: { ...wp }, w, h })
    else pending.push(m)
  }
  let nextX = placed.length ? Math.max(...placed.map(p => p.wp.pixelX + p.w)) : 0
  const topY = placed.length ? Math.min(...placed.map(p => p.wp.pixelY)) : 0
  for (const m of pending) {
    placed.push({ wp: { monitorId: m.id, pixelX: nextX, pixelY: topY }, w: 0, h: 0 })
    nextX += getMonitorStripWidth(m)
  }
  const byMonitor = new Map(placed.map(p => [p.wp.monitorId, p.wp]))
  return monitors.map(m => byMonitor.get(m.id)!)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_MONITOR': {
      const rotation = action.rotation ?? 0
      const monitor = createMonitor(action.preset, action.x, action.y, rotation, action.displayName)
      const newMonitors = [...state.monitors, monitor]
      return {
        ...state,
        monitors: newMonitors,
        selectedMonitorId: monitor.id,
        windowsArrangement: updateArrangementForMonitors(state, newMonitors),
      }
    }
    case 'SET_MONITOR_DISPLAY_NAME': {
      const name = action.displayName.trim()
      return {
        ...state,
        monitors: state.monitors.map(m =>
          m.id === action.id ? { ...m, displayName: name || undefined } : m
        ),
      }
    }
    case 'SET_MONITOR_BEZELS': {
      return {
        ...state,
        monitors: state.monitors.map(m =>
          m.id === action.id ? { ...m, bezels: action.bezels } : m
        ),
      }
    }
    case 'REMOVE_MONITOR': {
      const newMonitors = state.monitors.filter(m => m.id !== action.id)
      return {
        ...state,
        monitors: newMonitors,
        selectedMonitorId: state.selectedMonitorId === action.id ? null : state.selectedMonitorId,
        windowsArrangement: updateArrangementForMonitors(state, newMonitors),
      }
    }
    case 'DUPLICATE_MONITOR': {
      const source = state.monitors.find(m => m.id === action.id)
      if (!source) return state
      const baseName = getMonitorDisplayName(source).replace(/\s*-\s*Copy\s+\d+$/i, '').trim()
      const copyPrefix = `${baseName} - Copy `
      let maxCopy = 0
      for (const m of state.monitors) {
        const name = getMonitorDisplayName(m)
        if (name === baseName) maxCopy = Math.max(maxCopy, 0)
        else if (name.startsWith(copyPrefix)) {
          const suffix = name.slice(copyPrefix.length)
          if (/^\d+$/.test(suffix)) maxCopy = Math.max(maxCopy, parseInt(suffix, 10))
        }
      }
      const copyName = `${baseName} - Copy ${maxCopy + 1}`
      const offsetX = source.physicalWidth * 0.2
      const offsetY = source.physicalHeight * 0.15
      const newMonitor = createMonitor(
        source.preset,
        source.physicalX + offsetX,
        source.physicalY + offsetY,
        source.rotation ?? 0,
        copyName,
        source.bezels ? { ...source.bezels } : undefined,
      )
      const newMonitors = [...state.monitors, newMonitor]
      return {
        ...state,
        monitors: newMonitors,
        selectedMonitorId: newMonitor.id,
        windowsArrangement: updateArrangementForMonitors(state, newMonitors),
      }
    }
    case 'ROTATE_MONITOR': {
      const m = state.monitors.find(m => m.id === action.id)
      if (!m) return state
      const centerX = m.physicalX + m.physicalWidth / 2
      const centerY = m.physicalY + m.physicalHeight / 2
      const currentRotation = m.rotation ?? 0
      const newRotation: 0 | 90 = currentRotation === 90 ? 0 : 90
      const newW = m.physicalHeight
      const newH = m.physicalWidth
      const newMonitors = state.monitors.map(mon =>
        mon.id === action.id
          ? {
              ...mon,
              physicalX: centerX - newW / 2,
              physicalY: centerY - newH / 2,
              physicalWidth: newW,
              physicalHeight: newH,
              rotation: newRotation,
            }
          : mon
      )
      return {
        ...state,
        monitors: newMonitors,
        windowsArrangement: updateArrangementForMonitors(state, newMonitors),
      }
    }
    case 'CLEAR_ALL_MONITORS':
      return { ...state, monitors: [], selectedMonitorId: null, windowsArrangement: [] }
    case 'MOVE_MONITOR': {
      const newMonitors = state.monitors.map(m =>
        m.id === action.id ? { ...m, physicalX: action.x, physicalY: action.y } : m
      )
      // Auto-sync Windows arrangement if not using custom arrangement
      const newArrangement = state.useWindowsArrangement
        ? state.windowsArrangement
        : generateDefaultWindowsArrangement(newMonitors)
      return {
        ...state,
        monitors: newMonitors,
        windowsArrangement: newArrangement,
      }
    }
    case 'SELECT_MONITOR':
      return { ...state, selectedMonitorId: action.id }
    case 'SET_SOURCE_IMAGE':
      return { ...state, sourceImage: action.image }
    case 'CLEAR_SOURCE_IMAGE': {
      const retainedPosition: SavedImagePosition | null =
        state.sourceImage
          ? {
              x: state.sourceImage.physicalX,
              y: state.sourceImage.physicalY,
              width: state.sourceImage.physicalWidth,
              height: state.sourceImage.physicalHeight,
              aspectRatio: getSourceImageAspect(state.sourceImage),
            }
          : null
      return {
        ...state,
        sourceImage: null,
        loadedLayoutImagePosition: retainedPosition ?? state.loadedLayoutImagePosition,
      }
    }
    case 'ROTATE_SOURCE_IMAGE': {
      if (!state.sourceImage) return state
      const r = state.sourceImage.rotation ?? 0
      const next: 0 | 90 | 180 | 270 = r === 270 ? 0 : (r + 90) as 0 | 90 | 180 | 270
      // A quarter turn swaps the image's physical footprint; keep it centered in place.
      const img = state.sourceImage
      const cx = img.physicalX + img.physicalWidth / 2
      const cy = img.physicalY + img.physicalHeight / 2
      return {
        ...state,
        sourceImage: {
          ...img,
          rotation: next,
          physicalX: cx - img.physicalHeight / 2,
          physicalY: cy - img.physicalWidth / 2,
          physicalWidth: img.physicalHeight,
          physicalHeight: img.physicalWidth,
        },
      }
    }
    case 'MOVE_IMAGE':
      return state.sourceImage
        ? { ...state, sourceImage: { ...state.sourceImage, physicalX: action.x, physicalY: action.y } }
        : state
    case 'SCALE_IMAGE':
      return state.sourceImage
        ? {
            ...state,
            sourceImage: {
              ...state.sourceImage,
              physicalWidth: action.physicalWidth,
              physicalHeight: action.physicalHeight,
            },
          }
        : state
    case 'SET_IMAGE_TRANSFORM':
      return state.sourceImage
        ? {
            ...state,
            sourceImage: {
              ...state.sourceImage,
              physicalX: action.x,
              physicalY: action.y,
              physicalWidth: action.physicalWidth,
              physicalHeight: action.physicalHeight,
            },
          }
        : state
    case 'LOAD_LAYOUT': {
      const monitors = action.monitors.map(m =>
        createMonitor(m.preset, m.physicalX, m.physicalY, m.rotation ?? 0, m.displayName, m.bezels)
      )
      const hasCustomArrangement = Array.isArray(action.windowsArrangement) && action.windowsArrangement.length === monitors.length
      const arrangement: WindowsMonitorPosition[] = hasCustomArrangement
        ? action.windowsArrangement!.map((wp, i) => ({
            monitorId: monitors[i].id,
            pixelX: wp.pixelX,
            pixelY: wp.pixelY,
          }))
        : generateDefaultWindowsArrangement(monitors)
      return {
        ...state,
        monitors,
        selectedMonitorId: null,
        windowsArrangement: arrangement,
        useWindowsArrangement: hasCustomArrangement,
        activeLayoutName: action.layoutName ?? state.activeLayoutName,
        loadedLayoutImagePosition: action.imagePosition ?? null,
      }
    }
    case 'SET_ACTIVE_LAYOUT_NAME':
      return { ...state, activeLayoutName: action.name }
    case 'SET_LOADED_LAYOUT_IMAGE_POSITION':
      return { ...state, loadedLayoutImagePosition: action.position }
    case 'CLEAR_LOADED_LAYOUT_IMAGE_POSITION':
      return { ...state, loadedLayoutImagePosition: null }
    case 'SET_CANVAS_SCALE':
      return { ...state, canvasScale: Math.max(CANVAS_SCALE_MIN, Math.min(CANVAS_SCALE_MAX, action.scale)) }
    case 'PAN_CANVAS':
      return {
        ...state,
        canvasOffsetX: state.canvasOffsetX + action.dx,
        canvasOffsetY: state.canvasOffsetY + action.dy,
      }
    case 'SET_CANVAS_OFFSET':
      return { ...state, canvasOffsetX: action.x, canvasOffsetY: action.y }
    case 'TOGGLE_UNIT': {
      const next = state.unit === 'inches' ? 'cm' : 'inches'
      try {
        localStorage.setItem(UNIT_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return { ...state, unit: next }
    }
    case 'TOGGLE_SNAP':
      return { ...state, snapToGrid: !state.snapToGrid }
    case 'TOGGLE_SMART_ALIGN':
      return { ...state, smartAlign: !state.smartAlign }
    case 'SET_GRID_SIZE':
      return { ...state, gridSize: action.size }
    // Windows arrangement
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.tab,
        // Exit eyedropper when leaving Physical layout (only place color picking works)
        eyedropperActive: action.tab === 'physical' ? state.eyedropperActive : false,
      }
    case 'SET_USE_WINDOWS_ARRANGEMENT': {
      if (!action.value) {
        // Switching back to auto: regenerate from physical layout
        return {
          ...state,
          useWindowsArrangement: false,
          windowsArrangement: generateDefaultWindowsArrangement(state.monitors),
        }
      }
      return { ...state, useWindowsArrangement: true }
    }
    case 'MOVE_WINDOWS_MONITOR':
      return {
        ...state,
        windowsArrangement: state.windowsArrangement.map(wp =>
          wp.monitorId === action.monitorId
            ? { ...wp, pixelX: action.pixelX, pixelY: action.pixelY }
            : wp
        ),
      }
    case 'SYNC_WINDOWS_ARRANGEMENT':
      return {
        ...state,
        windowsArrangement: generateDefaultWindowsArrangement(state.monitors),
      }
    case 'SET_SHOW_TROUBLESHOOTING_GUIDE':
      return { ...state, showTroubleshootingGuide: action.value }
    case 'SET_SHOW_HOW_IT_WORKS':
      return { ...state, showHowItWorks: action.value }
    case 'SET_FILL_MODE':
      return { ...state, fillMode: action.mode }
    case 'SET_FILL_SOLID_COLOR':
      return { ...state, fillSolidColor: action.color }
    case 'SET_EYEDROPPER_ACTIVE':
      return { ...state, eyedropperActive: action.active }
    case 'SET_PRESETS_SIDEBAR_COLLAPSED':
      return { ...state, presetsSidebarCollapsed: action.collapsed }
    case 'SET_PRESETS_GROUP_EXPANDED':
      return {
        ...state,
        presetsGroupExpanded: {
          ...state.presetsGroupExpanded,
          [action.groupId]: action.expanded,
        },
      }
    case 'SET_OUTPUT_FORMAT':
      return { ...state, outputFormat: action.format }
    case 'SET_JPEG_QUALITY': {
      const clamped = Math.min(100, Math.max(50, Math.round(action.quality)))
      return { ...state, jpegQuality: clamped }
    }
    case 'ADD_RECENT_CUSTOM_PRESET': {
      const next = [...state.customPresets, action.preset].slice(-24)
      saveCustomPresets(next)
      return { ...state, customPresets: next }
    }
    case 'REMOVE_RECENT_CUSTOM_PRESET': {
      const next = state.customPresets.filter((_, i) => i !== action.index)
      saveCustomPresets(next)
      return { ...state, customPresets: next }
    }
    default:
      return state
  }
}

// --- Undo/redo machinery ---

const DISCRETE_UNDOABLE: Record<string, string> = {
  'ADD_MONITOR': 'Add monitor',
  'REMOVE_MONITOR': 'Remove monitor',
  'DUPLICATE_MONITOR': 'Duplicate monitor',
  'ROTATE_MONITOR': 'Rotate monitor',
  'CLEAR_ALL_MONITORS': 'Clear all monitors',
  'SET_SOURCE_IMAGE': 'Load image',
  'CLEAR_SOURCE_IMAGE': 'Remove image',
  'SET_MONITOR_DISPLAY_NAME': 'Rename monitor',
  'LOAD_LAYOUT': 'Load layout',
  'SET_IMAGE_TRANSFORM': 'Resize image',
  'ROTATE_SOURCE_IMAGE': 'Rotate image',
}

const CONTINUOUS_UNDOABLE: Record<string, string> = {
  'MOVE_MONITOR': 'Move monitor',
  'MOVE_IMAGE': 'Move image',
  'SCALE_IMAGE': 'Resize image',
  // Bezel popover dispatches on every live-preview change; coalesce into one undo step
  'SET_MONITOR_BEZELS': 'Set bezels',
}

function getContinuousKey(action: Action): string {
  if (action.type === 'MOVE_MONITOR') return `MOVE_MONITOR:${action.id}`
  if (action.type === 'SET_MONITOR_BEZELS') return `SET_MONITOR_BEZELS:${action.id}`
  return action.type
}

function takeSnapshot(state: State, label: string): UndoableSnapshot {
  return {
    monitors: state.monitors,
    sourceImage: state.sourceImage,
    windowsArrangement: state.windowsArrangement,
    useWindowsArrangement: state.useWindowsArrangement,
    selectedMonitorId: state.selectedMonitorId,
    label,
  }
}

function restoreSnapshot(state: State, snapshot: UndoableSnapshot): State {
  return {
    ...state,
    monitors: snapshot.monitors,
    sourceImage: snapshot.sourceImage,
    windowsArrangement: snapshot.windowsArrangement,
    useWindowsArrangement: snapshot.useWindowsArrangement,
    selectedMonitorId: snapshot.selectedMonitorId,
  }
}

function undoableReducer(state: State, action: Action): State {
  if (action.type === 'UNDO') {
    if (state._undoStack.length === 0) return state
    const snapshot = state._undoStack[state._undoStack.length - 1]
    const currentSnapshot = takeSnapshot(state, snapshot.label)
    return {
      ...restoreSnapshot(state, snapshot),
      _undoStack: state._undoStack.slice(0, -1),
      _redoStack: [...state._redoStack, currentSnapshot],
      _continuousKey: null,
    }
  }

  if (action.type === 'REDO') {
    if (state._redoStack.length === 0) return state
    const snapshot = state._redoStack[state._redoStack.length - 1]
    const currentSnapshot = takeSnapshot(state, snapshot.label)
    return {
      ...restoreSnapshot(state, snapshot),
      _undoStack: [...state._undoStack, currentSnapshot],
      _redoStack: state._redoStack.slice(0, -1),
      _continuousKey: null,
    }
  }

  let newUndoStack = state._undoStack
  let newRedoStack = state._redoStack
  let newContinuousKey = state._continuousKey

  const discreteLabel = DISCRETE_UNDOABLE[action.type]
  const continuousLabel = CONTINUOUS_UNDOABLE[action.type]

  if (discreteLabel) {
    const snapshot = takeSnapshot(state, discreteLabel)
    newUndoStack = [...state._undoStack, snapshot].slice(-MAX_HISTORY)
    newRedoStack = []
    newContinuousKey = null
  } else if (continuousLabel) {
    const key = getContinuousKey(action)
    if (key !== state._continuousKey) {
      const snapshot = takeSnapshot(state, continuousLabel)
      newUndoStack = [...state._undoStack, snapshot].slice(-MAX_HISTORY)
      newRedoStack = []
      newContinuousKey = key
    }
  } else {
    newContinuousKey = null
  }

  const newState = reducer(state, action)

  return {
    ...newState,
    _undoStack: newUndoStack,
    _redoStack: newRedoStack,
    _continuousKey: newContinuousKey,
  }
}

const StoreContext = createContext<{
  state: State
  dispatch: React.Dispatch<Action>
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
} | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(undoableReducer, initialState)
  const canUndo = state._undoStack.length > 0
  const canRedo = state._redoStack.length > 0
  const undoLabel = canUndo ? state._undoStack[state._undoStack.length - 1].label : null
  const redoLabel = canRedo ? state._redoStack[state._redoStack.length - 1].label : null

  return (
    <StoreContext.Provider value={{ state, dispatch, canUndo, canRedo, undoLabel, redoLabel }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
