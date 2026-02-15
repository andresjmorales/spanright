import { StoreProvider } from './store'
import MonitorPresetsSidebar from './components/MonitorPresetsSidebar'
import EditorCanvas from './components/EditorCanvas'
import Toolbar from './components/Toolbar'
import PreviewPanel from './components/PreviewPanel'

export default function App() {
  return (
    <StoreProvider>
      <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <h1 className="text-sm font-bold text-gray-100 tracking-tight">
              Wallpaper Resizer
            </h1>
          </div>
          <span className="text-xs text-gray-500">
            Multi-Monitor Alignment Tool
          </span>
        </header>

        {/* Toolbar */}
        <Toolbar />

        {/* Main editor area */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <MonitorPresetsSidebar />
          {/* Canvas */}
          <EditorCanvas />
        </div>

        {/* Preview & Export */}
        <PreviewPanel />
      </div>
    </StoreProvider>
  )
}
