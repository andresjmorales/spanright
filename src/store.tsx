import React, { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { Monitor, SourceImage, MonitorPreset } from './types'
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
}

type Action =
  | { type: 'ADD_MONITOR'; preset: MonitorPreset; x: number; y: number }
  | { type: 'REMOVE_MONITOR'; id: string }
  | { type: 'MOVE_MONITOR'; id: string; x: number; y: number }
  | { type: 'SELECT_MONITOR'; id: string | null }
  | { type: 'SET_SOURCE_IMAGE'; image: SourceImage }
  | { type: 'CLEAR_SOURCE_IMAGE' }
  | { type: 'MOVE_IMAGE'; x: number; y: number }
  | { type: 'SCALE_IMAGE'; physicalWidth: number; physicalHeight: number }
  | { type: 'SET_CANVAS_SCALE'; scale: number }
  | { type: 'PAN_CANVAS'; dx: number; dy: number }
  | { type: 'SET_CANVAS_OFFSET'; x: number; y: number }
  | { type: 'TOGGLE_UNIT' }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'SET_GRID_SIZE'; size: number }

const initialState: State = {
  monitors: [],
  sourceImage: null,
  canvasScale: 10, // 10 pixels per inch on canvas
  canvasOffsetX: 50,
  canvasOffsetY: 50,
  unit: 'inches',
  selectedMonitorId: null,
  snapToGrid: true,
  gridSize: 1,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_MONITOR': {
      const monitor = createMonitor(action.preset, action.x, action.y)
      return { ...state, monitors: [...state.monitors, monitor], selectedMonitorId: monitor.id }
    }
    case 'REMOVE_MONITOR':
      return {
        ...state,
        monitors: state.monitors.filter(m => m.id !== action.id),
        selectedMonitorId: state.selectedMonitorId === action.id ? null : state.selectedMonitorId,
      }
    case 'MOVE_MONITOR':
      return {
        ...state,
        monitors: state.monitors.map(m =>
          m.id === action.id ? { ...m, physicalX: action.x, physicalY: action.y } : m
        ),
      }
    case 'SELECT_MONITOR':
      return { ...state, selectedMonitorId: action.id }
    case 'SET_SOURCE_IMAGE':
      return { ...state, sourceImage: action.image }
    case 'CLEAR_SOURCE_IMAGE':
      return { ...state, sourceImage: null }
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
      return { ...state, canvasScale: Math.max(2, Math.min(40, action.scale)) }
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
