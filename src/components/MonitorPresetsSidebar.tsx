import { useState } from 'react'
import { MONITOR_PRESETS, COMMON_ASPECT_RATIOS, COMMON_RESOLUTIONS } from '../presets'
import type { MonitorPreset } from '../types'
import { useStore } from '../store'
import { calculatePPI, calculatePhysicalDimensions, formatDimension } from '../utils'

export default function MonitorPresetsSidebar() {
  const { state, dispatch } = useStore()
  const [showCustom, setShowCustom] = useState(false)
  const [customDiagonal, setCustomDiagonal] = useState('27')
  const [customAspect, setCustomAspect] = useState<[number, number]>([16, 9])
  const [customResIdx, setCustomResIdx] = useState(1)
  const [searchFilter, setSearchFilter] = useState('')

  function addPreset(preset: MonitorPreset) {
    // Place at a default position, slightly offset for each new monitor
    const offset = state.monitors.length * 2
    dispatch({ type: 'ADD_MONITOR', preset, x: 5 + offset, y: 5 })
  }

  function addCustom() {
    const res = COMMON_RESOLUTIONS[customResIdx]
    if (!res) return
    const preset: MonitorPreset = {
      name: `Custom ${customDiagonal}" ${res.w}x${res.h}`,
      diagonal: parseFloat(customDiagonal),
      aspectRatio: customAspect,
      resolutionX: res.w,
      resolutionY: res.h,
    }
    addPreset(preset)
    setShowCustom(false)
  }

  const filtered = MONITOR_PRESETS.filter(p =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  )

  // Group presets
  const laptops = filtered.filter(p => p.diagonal < 20)
  const standard = filtered.filter(p => p.diagonal >= 20 && p.aspectRatio[0] === 16)
  const ultrawides = filtered.filter(p => p.aspectRatio[0] >= 21)

  return (
    <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Monitor Presets
        </h2>
        <input
          type="text"
          placeholder="Search presets..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {laptops.length > 0 && (
          <PresetGroup title="Laptops" presets={laptops} onAdd={addPreset} unit={state.unit} />
        )}
        {standard.length > 0 && (
          <PresetGroup title="Standard Monitors" presets={standard} onAdd={addPreset} unit={state.unit} />
        )}
        {ultrawides.length > 0 && (
          <PresetGroup title="Ultrawides" presets={ultrawides} onAdd={addPreset} unit={state.unit} />
        )}
      </div>

      <div className="p-3 border-t border-gray-800">
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors"
          >
            + Custom Monitor
          </button>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300">Custom Monitor</h3>
            <div>
              <label className="text-xs text-gray-500">Diagonal (inches)</label>
              <input
                type="number"
                value={customDiagonal}
                onChange={e => setCustomDiagonal(e.target.value)}
                min="5"
                max="100"
                step="0.1"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Aspect Ratio</label>
              <select
                value={`${customAspect[0]}:${customAspect[1]}`}
                onChange={e => {
                  const [a, b] = e.target.value.split(':').map(Number)
                  setCustomAspect([a, b])
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {COMMON_ASPECT_RATIOS.map(([a, b]) => (
                  <option key={`${a}:${b}`} value={`${a}:${b}`}>{a}:{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Resolution</label>
              <select
                value={customResIdx}
                onChange={e => setCustomResIdx(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {COMMON_RESOLUTIONS.map((r, i) => (
                  <option key={i} value={i}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addCustom}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-1.5 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PresetGroup({
  title,
  presets,
  onAdd,
  unit,
}: {
  title: string
  presets: MonitorPreset[]
  onAdd: (p: MonitorPreset) => void
  unit: 'inches' | 'cm'
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">
        {title}
      </h3>
      <div className="space-y-1">
        {presets.map((preset, i) => {
          const ppi = calculatePPI(preset.resolutionX, preset.resolutionY, preset.diagonal)
          const { width, height } = calculatePhysicalDimensions(preset.resolutionX, preset.resolutionY, ppi)
          return (
            <button
              key={`${preset.name}-${i}`}
              onClick={() => onAdd(preset)}
              className="w-full text-left bg-gray-800 hover:bg-gray-750 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded p-2 transition-colors group"
            >
              <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                {preset.name}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {preset.resolutionX}x{preset.resolutionY} &middot;{' '}
                {formatDimension(width, unit)} x {formatDimension(height, unit)} &middot;{' '}
                {Math.round(ppi)} PPI
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
