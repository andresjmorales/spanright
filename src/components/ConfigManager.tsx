import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '../store'
import { useToast } from './Toast'
import type { SavedConfig, SavedImagePosition } from '../types'
import { PRELOADED_LAYOUTS, decodePreloadedLayout } from '../preloadedLayouts'
import { deleteImagePositionBookmark } from '../imagePositionStorage'
import { IconBookmark, IconPlus, IconTrash } from '../icons'

const STORAGE_KEY = 'spanright-saved-configs'
const MAX_CONFIGS = 24

/** Validation limits for imported layouts (match app rules). */
const IMPORT_MIN_DIAGONAL = 5
const IMPORT_MAX_DIAGONAL = 120
const IMPORT_MAX_ASPECT_RATIO = 10
const LAYOUT_NAME_MAX_LENGTH = 40

const EXPORT_FILENAME_PREFIX = 'spanright-layouts'

/** Dropdown width in px (w-72 = 18rem) for viewport clamp. */
const SAVED_LAYOUTS_DROPDOWN_WIDTH_PX = 288
const VIEWPORT_PADDING_PX = 8

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

function validateImportedLayouts(data: unknown): { valid: true; configs: SavedConfig[] } | { valid: false; error: string } {
  if (!Array.isArray(data)) {
    return { valid: false, error: 'File must be a JSON array of layouts.' }
  }
  const configs: SavedConfig[] = []
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Layout ${i + 1}: invalid entry.` }
    }
    const { id, name, savedAt, monitors: rawMonitors, imagePosition: rawImg } = item as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim()) {
      return { valid: false, error: `Layout ${i + 1}: name is required.` }
    }
    if (name.length > LAYOUT_NAME_MAX_LENGTH) {
      return { valid: false, error: `Layout "${name.slice(0, 20)}…": name must be ${LAYOUT_NAME_MAX_LENGTH} characters or less.` }
    }
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) {
      return { valid: false, error: `Layout "${name}": savedAt must be a number.` }
    }
    if (!Array.isArray(rawMonitors) || rawMonitors.length === 0) {
      return { valid: false, error: `Layout "${name}": must have at least one monitor.` }
    }
    const monitors: SavedConfig['monitors'] = []
    for (let j = 0; j < rawMonitors.length; j++) {
      const mon = rawMonitors[j] as Record<string, unknown>
      const preset = mon.preset as Record<string, unknown> | undefined
      if (!preset || typeof preset !== 'object') {
        return { valid: false, error: `Layout "${name}", monitor ${j + 1}: preset is required.` }
      }
      const diagonal = Number(preset.diagonal)
      const ar = preset.aspectRatio
      const resX = Number(preset.resolutionX)
      const resY = Number(preset.resolutionY)
      if (!Number.isFinite(diagonal) || diagonal < IMPORT_MIN_DIAGONAL || diagonal > IMPORT_MAX_DIAGONAL) {
        return { valid: false, error: `Layout "${name}", monitor ${j + 1}: diagonal must be ${IMPORT_MIN_DIAGONAL}–${IMPORT_MAX_DIAGONAL}".` }
      }
      if (!Array.isArray(ar) || ar.length !== 2 || !Number.isFinite(ar[0]) || !Number.isFinite(ar[1]) || (ar[0] as number) <= 0 || (ar[1] as number) <= 0) {
        return { valid: false, error: `Layout "${name}", monitor ${j + 1}: aspectRatio must be [number, number].` }
      }
      const ratio = Math.max((ar[0] as number) / (ar[1] as number), (ar[1] as number) / (ar[0] as number))
      if (ratio > IMPORT_MAX_ASPECT_RATIO) {
        return { valid: false, error: `Layout "${name}", monitor ${j + 1}: aspect ratio cannot exceed ${IMPORT_MAX_ASPECT_RATIO}:1.` }
      }
      if (!Number.isFinite(resX) || !Number.isFinite(resY) || resX < 1 || resY < 1) {
        return { valid: false, error: `Layout "${name}", monitor ${j + 1}: resolution must be positive numbers.` }
      }
      const presetName = typeof preset.name === 'string' ? preset.name : `Monitor ${j + 1}`
      const physicalX = Number(mon.physicalX)
      const physicalY = Number(mon.physicalY)
      if (!Number.isFinite(physicalX) || !Number.isFinite(physicalY)) {
        return { valid: false, error: `Layout "${name}", monitor ${j + 1}: physicalX and physicalY are required.` }
      }
      const rotation = mon.rotation === 90 ? 90 : 0
      const displayName = typeof mon.displayName === 'string' ? mon.displayName : undefined
      let bezels: SavedConfig['monitors'][0]['bezels'] | undefined
      if (mon.bezels != null && typeof mon.bezels === 'object') {
        const b = mon.bezels as Record<string, unknown>
        const t = Number(b.top), bot = Number(b.bottom), l = Number(b.left), r = Number(b.right)
        if (Number.isFinite(t) && Number.isFinite(bot) && Number.isFinite(l) && Number.isFinite(r) && t >= 0 && bot >= 0 && l >= 0 && r >= 0) {
          bezels = { top: t, bottom: bot, left: l, right: r }
        }
      }
      monitors.push({
        preset: {
          name: presetName,
          diagonal,
          aspectRatio: [ar[0] as number, ar[1] as number],
          resolutionX: resX,
          resolutionY: resY,
        },
        physicalX,
        physicalY,
        rotation,
        displayName,
        bezels,
      })
    }
    let imagePosition: SavedImagePosition | null = null
    if (rawImg != null && typeof rawImg === 'object') {
      const img = rawImg as Record<string, unknown>
      const x = Number(img.x), y = Number(img.y), w = Number(img.width), h = Number(img.height), ar = Number(img.aspectRatio)
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && Number.isFinite(ar) && w > 0 && h > 0 && ar > 0) {
        imagePosition = { x, y, width: w, height: h, aspectRatio: ar }
      }
    }
    configs.push({
      id: typeof id === 'string' ? id : crypto.randomUUID(),
      name: name.trim(),
      savedAt,
      monitors,
      imagePosition: imagePosition ?? undefined,
    })
  }
  return { valid: true, configs }
}

export default function ConfigManager() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [configs, setConfigs] = useState<SavedConfig[]>([])
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [dropdownAlignRight, setDropdownAlignRight] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Keep dropdown inside viewport when opening (align right if it would overflow)
  useEffect(() => {
    if (!open || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    const wouldOverflowRight = rect.left + SAVED_LAYOUTS_DROPDOWN_WIDTH_PX > window.innerWidth - VIEWPORT_PADDING_PX
    setDropdownAlignRight(wouldOverflowRight)
  }, [open])

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
    // Use current canvas image position when present; otherwise keep layout image position (e.g. from shared link)
    const img = state.sourceImage
    const imagePosition: SavedImagePosition | null = img
      ? {
          x: img.physicalX,
          y: img.physicalY,
          width: img.physicalWidth,
          height: img.physicalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight,
        }
      : state.loadedLayoutImagePosition ?? null
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
        bezels: m.bezels,
      })),
      imagePosition,
    }
    const updated = [newConfig, ...configs].slice(0, MAX_CONFIGS)
    setConfigs(updated)
    saveConfigs(updated)
    dispatch({ type: 'SET_ACTIVE_LAYOUT_NAME', name: newConfig.name })
    dispatch({ type: 'SET_LOADED_LAYOUT_IMAGE_POSITION', position: imagePosition })
    toast.success(`Layout saved: ${newConfig.name}`)
    setSaveName('')
    setShowSaveInput(false)
  }

  const handleLoad = (config: SavedConfig) => {
    dispatch({
      type: 'LOAD_LAYOUT',
      monitors: config.monitors,
      layoutName: config.name,
      imagePosition: config.imagePosition ?? null,
    })
    toast.success(`Layout loaded: ${config.name}`)
    setOpen(false)
  }

  const preloadedWithMonitors = useMemo(() => {
    return PRELOADED_LAYOUTS.map(entry => ({
      entry,
      monitors: decodePreloadedLayout(entry),
    })).filter(({ monitors }) => monitors && monitors.length > 0) as { entry: typeof PRELOADED_LAYOUTS[number]; monitors: SavedConfig['monitors'] }[]
  }, [])

  const handleLoadPreloaded = (monitors: SavedConfig['monitors'], name: string) => {
    dispatch({ type: 'LOAD_LAYOUT', monitors, layoutName: name, imagePosition: null })
    toast.success(`Layout loaded: ${name}`)
    setOpen(false)
  }

  const handleDelete = (id: string) => {
    const config = configs.find(c => c.id === id)
    if (config) deleteImagePositionBookmark(config.name)
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

  const handleExport = () => {
    if (configs.length === 0) {
      toast('No layouts to export.')
      return
    }
    const json = JSON.stringify(configs, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${EXPORT_FILENAME_PREFIX}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${configs.length} layout${configs.length !== 1 ? 's' : ''}`)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        const result = validateImportedLayouts(data)
        if (!result.valid) {
          toast(result.error)
          return
        }
        const slotLeft = Math.max(0, MAX_CONFIGS - configs.length)
        if (slotLeft === 0) {
          toast(`Already at maximum of ${MAX_CONFIGS} layouts. Remove some to import.`)
          return
        }
        const toAdd = result.configs.slice(0, slotLeft).map(c => ({
          ...c,
          id: crypto.randomUUID(),
        }))
        const updated = [...configs, ...toAdd]
        setConfigs(updated)
        saveConfigs(updated)
        const skipped = result.configs.length - toAdd.length
        toast.success(
          skipped > 0
            ? `Imported ${toAdd.length} layout${toAdd.length !== 1 ? 's' : ''}. ${skipped} skipped (max ${MAX_CONFIGS}).`
            : `Imported ${toAdd.length} layout${toAdd.length !== 1 ? 's' : ''}`,
        )
      } catch {
        toast('Invalid JSON file.')
      }
    }
    reader.readAsText(file)
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
          <IconBookmark className="w-3.5 h-3.5" />
          Saved Layouts
          {configs.length > 0 && (
            <span className="text-[10px] text-gray-500">({configs.length})</span>
          )}
        </span>
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden ${dropdownAlignRight ? 'right-0 left-auto' : 'left-0'}`}
        >
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
                <IconPlus className="w-3.5 h-3.5" />
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

          {/* Layout list (saved layouts) */}
          <div className="max-h-64 overflow-y-auto">
            {configs.length === 0 && preloadedWithMonitors.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-600">
                No saved layouts yet. Add layouts in <code className="text-gray-500">preloadedLayouts.ts</code> or save your current layout above.
              </div>
            ) : configs.length === 0 ? null : (
              configs.map((config) => (
                <div
                  key={config.id}
                  className="group flex items-center gap-2 px-2.5 py-2 hover:bg-gray-800/60 border-b border-gray-800/50 last:border-b-0"
                >
                  {confirmDeleteId === config.id ? (
                    <div className="flex-1 flex items-center justify-end gap-2 pr-2">
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
                          {config.monitors.length} monitor{config.monitors.length !== 1 ? 's' : ''}
                          {config.imagePosition ? ', 1 image position' : ', no image position'}
                          {' · '}{formatDate(config.savedAt)}
                        </div>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(config.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5"
                        title="Delete"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Export / Import */}
          <div className="p-2 border-t border-gray-800 flex gap-1.5">
            <button
              type="button"
              onClick={handleExport}
              disabled={configs.length === 0}
              className="flex-1 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={configs.length >= MAX_CONFIGS}
              className="flex-1 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
          </div>

          {/* Quick layouts (from preloadedLayouts.ts) */}
          {preloadedWithMonitors.length > 0 && (
            <div className="p-2 border-t border-gray-800">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2.5 mb-1.5">Quick layouts</div>
              {preloadedWithMonitors.map(({ entry, monitors }) => (
                <button
                  key={entry.name}
                  onClick={() => handleLoadPreloaded(monitors, entry.name)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors flex items-center gap-1.5"
                >
                  <span className="font-medium truncate">{entry.name}</span>
                  <span className="text-gray-600 shrink-0">{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}, no image position</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

