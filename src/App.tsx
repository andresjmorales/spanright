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
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
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
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
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

  // Show welcome dialog on first visit
  useEffect(() => {
    if (!localStorage.getItem(WELCOME_SEEN_KEY)) {
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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-xs">Quick Start</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => dispatch({ type: 'SET_SHOW_HOW_IT_WORKS', value: true })}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="How It Works"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs">How It Works</span>
        </button>
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
        <button
          onClick={() => setShowAbout(true)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="About Spanright"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 16v-4m0-4h.01" />
          </svg>
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
