import React, { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { Monitor, SourceImage, MonitorPreset, WindowsMonitorPosition, ActiveTab, Bezels } from './types'
import { createMonitor } from './utils'

const MAX_HISTORY = 50

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
  // Undo/redo (internal)
  _undoStack: UndoableSnapshot[]
  _redoStack: UndoableSnapshot[]
  _continuousKey: string | null
}

type Action =
  | { type: 'ADD_MONITOR'; preset: MonitorPreset; x: number; y: number; rotation?: 0 | 90; displayName?: string }
  | { type: 'REMOVE_MONITOR'; id: string }
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
  // Composite / undo-redo
  | { type: 'LOAD_LAYOUT'; monitors: { preset: MonitorPreset; physicalX: number; physicalY: number; rotation?: 0 | 90; displayName?: string; bezels?: Bezels }[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }

const initialState: State = {
  monitors: [],
  sourceImage: null,
  canvasScale: DEFAULT_CANVAS_SCALE,
  canvasOffsetX: 50,
  canvasOffsetY: 50,
  unit: 'inches',
  selectedMonitorId: null,
  snapToGrid: false,
  gridSize: 1,
  smartAlign: true,
  windowsArrangement: [],
  useWindowsArrangement: false,
  activeTab: 'physical',
  showTroubleshootingGuide: false,
  showHowItWorks: false,
  _undoStack: [],
  _redoStack: [],
  _continuousKey: null,
}

/** Strip width in pixels for output (depends on rotation). */
function getMonitorStripWidth(m: Monitor): number {
  return (m.rotation ?? 0) === 90 ? m.preset.resolutionY : m.preset.resolutionX
}

/**
 * Generate a default Windows arrangement from the physical layout:
 * same left-to-right order, all top-aligned, laid out side-by-side by pixel width.
 */
function generateDefaultWindowsArrangement(monitors: Monitor[]): WindowsMonitorPosition[] {
  const sorted = [...monitors].sort((a, b) => a.physicalX - b.physicalX)
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
        windowsArrangement: generateDefaultWindowsArrangement(newMonitors),
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
        windowsArrangement: generateDefaultWindowsArrangement(newMonitors),
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
        windowsArrangement: generateDefaultWindowsArrangement(newMonitors),
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
    case 'CLEAR_SOURCE_IMAGE':
      return { ...state, sourceImage: null }
    case 'ROTATE_SOURCE_IMAGE': {
      if (!state.sourceImage) return state
      const r = state.sourceImage.rotation ?? 0
      const next: 0 | 90 | 180 | 270 = r === 270 ? 0 : (r + 90) as 0 | 90 | 180 | 270
      return { ...state, sourceImage: { ...state.sourceImage, rotation: next } }
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
      return {
        ...state,
        monitors,
        selectedMonitorId: null,
        windowsArrangement: generateDefaultWindowsArrangement(monitors),
      }
    }
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
    case 'TOGGLE_UNIT':
      return { ...state, unit: state.unit === 'inches' ? 'cm' : 'inches' }
    case 'TOGGLE_SNAP':
      return { ...state, snapToGrid: !state.snapToGrid }
    case 'TOGGLE_SMART_ALIGN':
      return { ...state, smartAlign: !state.smartAlign }
    case 'SET_GRID_SIZE':
      return { ...state, gridSize: action.size }
    // Windows arrangement
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }
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
    default:
      return state
  }
}

// --- Undo/redo machinery ---

const DISCRETE_UNDOABLE: Record<string, string> = {
  'ADD_MONITOR': 'Add monitor',
  'REMOVE_MONITOR': 'Remove monitor',
  'ROTATE_MONITOR': 'Rotate monitor',
  'CLEAR_ALL_MONITORS': 'Clear all monitors',
  'SET_SOURCE_IMAGE': 'Load image',
  'CLEAR_SOURCE_IMAGE': 'Remove image',
  'SET_MONITOR_DISPLAY_NAME': 'Rename monitor',
  'SET_MONITOR_BEZELS': 'Set bezels',
  'LOAD_LAYOUT': 'Load layout',
  'SET_IMAGE_TRANSFORM': 'Resize image',
}

const CONTINUOUS_UNDOABLE: Record<string, string> = {
  'MOVE_MONITOR': 'Move monitor',
  'MOVE_IMAGE': 'Move image',
  'SCALE_IMAGE': 'Resize image',
}

function getContinuousKey(action: Action): string {
  if (action.type === 'MOVE_MONITOR') return `MOVE_MONITOR:${action.id}`
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
