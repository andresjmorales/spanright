import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { useToast } from './Toast'
import type { SavedConfig } from '../types'

const STORAGE_KEY = 'spanright-saved-configs'
const MAX_CONFIGS = 10

function loadConfigs(): SavedConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveConfigs(configs: SavedConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

export default function ConfigManager() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [configs, setConfigs] = useState<SavedConfig[]>([])
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)

  // Load on mount
  useEffect(() => {
    setConfigs(loadConfigs())
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowSaveInput(false)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus save input when shown
  useEffect(() => {
    if (showSaveInput && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [showSaveInput])

  const handleSave = () => {
    if (!saveName.trim() || state.monitors.length === 0) return
    const newConfig: SavedConfig = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      savedAt: Date.now(),
      monitors: state.monitors.map(m => ({
        preset: m.preset,
        physicalX: m.physicalX,
        physicalY: m.physicalY,
        rotation: m.rotation,
        displayName: m.displayName,
      })),
    }
    const updated = [newConfig, ...configs].slice(0, MAX_CONFIGS)
    setConfigs(updated)
    saveConfigs(updated)
    toast.success(`Layout saved: ${newConfig.name}`)
    setSaveName('')
    setShowSaveInput(false)
  }

  const handleLoad = (config: SavedConfig) => {
    dispatch({ type: 'LOAD_LAYOUT', monitors: config.monitors })
    toast.success(`Layout loaded: ${config.name}`)
    setOpen(false)
  }

  const handleDelete = (id: string) => {
    const updated = configs.filter(c => c.id !== id)
    setConfigs(updated)
    saveConfigs(updated)
    toast('Layout deleted')
    setConfirmDeleteId(null)
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setShowSaveInput(false); setConfirmDeleteId(null) }}
        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
          open
            ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
            : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
        }`}
        title="Saved Layouts"
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Saved Layouts
          {configs.length > 0 && (
            <span className="text-[10px] text-gray-500">({configs.length})</span>
          )}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Save current */}
          <div className="p-2 border-b border-gray-800">
            {!showSaveInput ? (
              <button
                onClick={() => {
                  setSaveName(`Setup ${configs.length + 1}`)
                  setShowSaveInput(true)
                }}
                disabled={state.monitors.length === 0}
                className="w-full text-left px-2.5 py-1.5 text-xs text-blue-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-40 disabled:cursor-default flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Save current layout
                {state.monitors.length === 0 && (
                  <span className="text-gray-600 ml-auto">No monitors</span>
                )}
                {configs.length >= MAX_CONFIGS && state.monitors.length > 0 && (
                  <span className="text-gray-600 ml-auto">Replaces oldest</span>
                )}
              </button>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); handleSave() }}
                className="flex gap-1.5"
              >
                <input
                  ref={saveInputRef}
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Layout name..."
                  className="flex-1 bg-gray-800 border border-gray-600 focus:border-blue-500 rounded px-2 py-1 text-xs text-gray-100 outline-none"
                  maxLength={40}
                />
                <button
                  type="submit"
                  disabled={!saveName.trim()}
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveInput(false)}
                  className="px-1.5 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ✕
                </button>
              </form>
            )}
          </div>

          {/* Layout list */}
          <div className="max-h-64 overflow-y-auto">
            {configs.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-600">
                No saved layouts yet
              </div>
            ) : (
              configs.map((config) => (
                <div
                  key={config.id}
                  className="group flex items-center gap-2 px-2.5 py-2 hover:bg-gray-800/60 border-b border-gray-800/50 last:border-b-0"
                >
                  {confirmDeleteId === config.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-red-400">Delete?</span>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleLoad(config)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="text-xs font-medium text-gray-200 truncate">
                          {config.name}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {config.monitors.length} monitor{config.monitors.length !== 1 ? 's' : ''} · {formatDate(config.savedAt)}
                        </div>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(config.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
