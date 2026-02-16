import React, { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { Monitor, SourceImage, MonitorPreset, WindowsMonitorPosition, ActiveTab } from './types'
import { createMonitor } from './utils'

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
  // Windows arrangement
  windowsArrangement: WindowsMonitorPosition[]
  useWindowsArrangement: boolean
  activeTab: ActiveTab
  showTroubleshootingGuide: boolean
}

type Action =
  | { type: 'ADD_MONITOR'; preset: MonitorPreset; x: number; y: number; rotation?: 0 | 90 }
  | { type: 'REMOVE_MONITOR'; id: string }
  | { type: 'ROTATE_MONITOR'; id: string }
  | { type: 'CLEAR_ALL_MONITORS' }
  | { type: 'MOVE_MONITOR'; id: string; x: number; y: number }
  | { type: 'SELECT_MONITOR'; id: string | null }
  | { type: 'SET_SOURCE_IMAGE'; image: SourceImage }
  | { type: 'CLEAR_SOURCE_IMAGE' }
  | { type: 'ROTATE_SOURCE_IMAGE' }
  | { type: 'MOVE_IMAGE'; x: number; y: number }
  | { type: 'SCALE_IMAGE'; physicalWidth: number; physicalHeight: number }
  | { type: 'SET_CANVAS_SCALE'; scale: number }
  | { type: 'PAN_CANVAS'; dx: number; dy: number }
  | { type: 'SET_CANVAS_OFFSET'; x: number; y: number }
  | { type: 'TOGGLE_UNIT' }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'SET_GRID_SIZE'; size: number }
  // Windows arrangement actions
  | { type: 'SET_ACTIVE_TAB'; tab: ActiveTab }
  | { type: 'SET_USE_WINDOWS_ARRANGEMENT'; value: boolean }
  | { type: 'MOVE_WINDOWS_MONITOR'; monitorId: string; pixelX: number; pixelY: number }
  | { type: 'SYNC_WINDOWS_ARRANGEMENT' }
  | { type: 'SET_SHOW_TROUBLESHOOTING_GUIDE'; value: boolean }

const initialState: State = {
  monitors: [],
  sourceImage: null,
  canvasScale: 10, // 10 pixels per inch = 100% zoom
  canvasOffsetX: 50,
  canvasOffsetY: 50,
  unit: 'inches',
  selectedMonitorId: null,
  snapToGrid: false,
  gridSize: 1,
  windowsArrangement: [],
  useWindowsArrangement: false,
  activeTab: 'physical',
  showTroubleshootingGuide: false,
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
      const monitor = createMonitor(action.preset, action.x, action.y, rotation)
      const newMonitors = [...state.monitors, monitor]
      return {
        ...state,
        monitors: newMonitors,
        selectedMonitorId: monitor.id,
        windowsArrangement: generateDefaultWindowsArrangement(newMonitors),
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
    case 'SET_CANVAS_SCALE':
      return { ...state, canvasScale: Math.max(7.5, Math.min(25, action.scale)) }
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
    default:
      return state
  }
}

const StoreContext = createContext<{
  state: State
  dispatch: React.Dispatch<Action>
} | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
