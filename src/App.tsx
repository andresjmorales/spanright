import { StoreProvider, useStore } from './store'
import MonitorPresetsSidebar from './components/MonitorPresetsSidebar'
import EditorCanvas from './components/EditorCanvas'
import Toolbar from './components/Toolbar'
import PreviewPanel from './components/PreviewPanel'
import WindowsArrangementCanvas from './components/WindowsArrangementCanvas'
import TroubleshootingGuide from './components/TroubleshootingGuide'
import type { ActiveTab } from './types'

function TabButton({ tab, label, active, onClick }: { tab: ActiveTab; label: string; active: boolean; onClick: (tab: ActiveTab) => void }) {
  return (
    <button
      onClick={() => onClick(tab)}
      className={`px-4 py-1.5 text-xs font-medium rounded-t transition-colors relative ${
        active
          ? 'bg-gray-950 text-gray-100 border-t border-x border-gray-700'
          : 'bg-gray-900 text-gray-500 hover:text-gray-300 border-t border-x border-transparent'
      }`}
    >
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-950" />
      )}
    </button>
  )
}

function AppContent() {
  const { state, dispatch } = useStore()
  const tab = state.activeTab

  const setTab = (t: ActiveTab) => dispatch({ type: 'SET_ACTIVE_TAB', tab: t })

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/spanwright-logo-large.png" alt="Spanwright" className="h-6 w-auto" />
          <h1 className="text-sm font-bold text-gray-100 tracking-tight">
            Spanwright
          </h1>
        </div>
        <span className="text-xs text-gray-500 flex-1">
          Multi-Monitor Wallpaper Alignment Tool
        </span>
        <button
          onClick={() => dispatch({ type: 'SET_SHOW_TROUBLESHOOTING_GUIDE', value: true })}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="Troubleshooting Guide"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs">Troubleshooting</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 flex items-end gap-1 shrink-0">
        <TabButton tab="physical" label="Physical Layout" active={tab === 'physical'} onClick={setTab} />
        <TabButton tab="windows" label="Windows Arrangement" active={tab === 'windows'} onClick={setTab} />
        <TabButton tab="preview" label="Preview & Export" active={tab === 'preview'} onClick={setTab} />
      </div>

      {/* Tab content */}
      {tab === 'physical' && (
        <>
          <Toolbar />
          <div className="flex flex-1 min-h-0 relative">
            <EditorCanvas />
            <MonitorPresetsSidebar />
          </div>
        </>
      )}

      {tab === 'windows' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <WindowsArrangementCanvas />
        </div>
      )}

      {tab === 'preview' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <PreviewPanel />
        </div>
      )}

      {/* Troubleshooting Guide Modal */}
      {state.showTroubleshootingGuide && (
        <TroubleshootingGuide onClose={() => dispatch({ type: 'SET_SHOW_TROUBLESHOOTING_GUIDE', value: false })} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  )
}
