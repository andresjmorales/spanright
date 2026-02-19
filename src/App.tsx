import { useState, useEffect } from 'react'
import { StoreProvider, useStore } from './store'
import MonitorPresetsSidebar from './components/MonitorPresetsSidebar'
import EditorCanvas from './components/EditorCanvas'
import Toolbar from './components/Toolbar'
import PreviewPanel from './components/PreviewPanel'
import WindowsArrangementCanvas from './components/WindowsArrangementCanvas'
import TroubleshootingGuide from './components/TroubleshootingGuide'
import InfoDialog from './components/InfoDialog'
import { ToastProvider } from './components/Toast'
import type { ActiveTab } from './types'
import { getLayoutFromHash, clearLayoutHash } from './urlLayout'
import { IconClose, IconBook, IconLightbulb, IconInfoCircle } from './icons'

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

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-sm w-full mx-4">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <IconClose className="w-5 h-5" />
        </button>
        <div className="p-6 text-center space-y-3">
          <img src="/spanright-logo-large.png" alt="Spanright" className="h-10 w-auto mx-auto" />
          <h2 className="text-lg font-bold text-gray-100">Spanright</h2>
          <p className="text-sm text-gray-400">
            Multi-Monitor Wallpaper Alignment Tool
          </p>
          <p className="text-sm text-gray-300">
            Source code and documentation on{' '}
            <a
              href="https://github.com/andresjmorales/spanright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              GitHub
            </a>
          </p>
          <p className="text-sm text-gray-300">
            Created by{' '}
            <a
              href="https://andresmorales.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              Andrés
            </a>
          </p>
          <button
            onClick={onClose}
            className="mt-2 w-full bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const WELCOME_SEEN_KEY = 'spanright-welcome-seen'

function WelcomeDialog({ onClose }: { onClose: () => void }) {
  const handleClose = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors z-10"
        >
          <IconClose className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-5">
          <div className="text-center">
            <img src="/spanright-logo-large.png" alt="Spanright" className="h-8 w-auto mx-auto mb-2" />
            <h2 className="text-lg font-bold text-gray-100">Welcome to Spanright</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create pixel-perfect multi-monitor wallpapers in a few steps.</p>
          </div>

          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
              <div>
                <div className="text-sm font-medium text-gray-200">Add your monitors</div>
                <div className="text-xs text-gray-400 mt-0.5">Pick presets from the sidebar or add custom ones. Optionally add bezel widths. Drag them on the canvas to match your desk layout.</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
              <div>
                <div className="text-sm font-medium text-gray-200">Upload an image</div>
                <div className="text-xs text-gray-400 mt-0.5">Drop in your wallpaper source image. Drag and resize it to cover the monitors how you'd like.</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
              <div>
                <div className="text-sm font-medium text-gray-200">Check your virtual layout</div>
                <div className="text-xs text-gray-400 mt-0.5">The <strong className="text-gray-300">Virtual Layout</strong> tab lets you match how your displays are arranged in your OS display settings, if needed.</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">4</span>
              <div>
                <div className="text-sm font-medium text-gray-200">Preview &amp; export</div>
                <div className="text-xs text-gray-400 mt-0.5">Head to <strong className="text-gray-300">Preview &amp; Export</strong> to see the stitched result and download it. On Windows, use <strong className="text-gray-300">Span</strong> mode; on macOS/Linux, see the troubleshooting guide for setup steps.</div>
              </div>
            </li>
          </ol>

          <button
            onClick={handleClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { state, dispatch } = useStore()
  const [showAbout, setShowAbout] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const tab = state.activeTab

  // On mount: load layout from URL hash if present, otherwise show welcome on first visit
  useEffect(() => {
    const layoutFromHash = getLayoutFromHash()
    if (layoutFromHash) {
      dispatch({ type: 'LOAD_LAYOUT', monitors: layoutFromHash })
      clearLayoutHash()
    } else if (!localStorage.getItem(WELCOME_SEEN_KEY)) {
      setShowWelcome(true)
    }
  }, [])

  const setTab = (t: ActiveTab) => dispatch({ type: 'SET_ACTIVE_TAB', tab: t })

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <a
          href="/"
          onClick={(e) => { e.preventDefault() }}
          className="flex items-center gap-2 no-underline"
        >
          <img src="/spanright-logo-large.png" alt="Spanright" className="h-6 w-auto" />
          <h1 className="text-sm font-bold text-gray-100 tracking-tight">
            Spanright
          </h1>
        </a>
        <span className="text-xs text-gray-500">
          Multi-Monitor Wallpaper Alignment Tool
        </span>
        <button
          onClick={() => setShowWelcome(true)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="Quick Start"
        >
          <IconBook className="w-4 h-4" />
          <span className="text-xs">Quick Start</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => dispatch({ type: 'SET_SHOW_HOW_IT_WORKS', value: true })}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="How It Works"
        >
          <IconLightbulb className="w-4 h-4" />
          <span className="text-xs">How It Works</span>
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_SHOW_TROUBLESHOOTING_GUIDE', value: true })}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="Troubleshooting Guide"
        >
          <IconInfoCircle className="w-4 h-4" />
          <span className="text-xs">Troubleshooting</span>
        </button>
        <button
          onClick={() => setShowAbout(true)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="About Spanright"
        >
          <IconInfoCircle className="w-4 h-4" />
          <span className="text-xs">About</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 flex items-end gap-1 shrink-0">
        <TabButton tab="physical" label="Physical Layout" active={tab === 'physical'} onClick={setTab} />
        <TabButton tab="windows" label="Virtual Layout" active={tab === 'windows'} onClick={setTab} />
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

      {/* How It Works Modal */}
      {state.showHowItWorks && (
        <InfoDialog onClose={() => dispatch({ type: 'SET_SHOW_HOW_IT_WORKS', value: false })} />
      )}

      {/* Troubleshooting Guide Modal */}
      {state.showTroubleshootingGuide && (
        <TroubleshootingGuide onClose={() => dispatch({ type: 'SET_SHOW_TROUBLESHOOTING_GUIDE', value: false })} />
      )}

      {/* About Modal */}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}

      {/* Welcome / Quick Start Modal */}
      {showWelcome && <WelcomeDialog onClose={() => setShowWelcome(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </StoreProvider>
  )
}
