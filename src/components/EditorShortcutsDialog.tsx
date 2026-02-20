import { useEffect } from 'react'

interface EditorShortcutsDialogProps {
  onClose: () => void
}

/** One shortcut row: keys on the right, description on the left. */
function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-gray-300">{description}</span>
      <kbd className="shrink-0 px-2 py-0.5 text-xs font-mono bg-gray-800 text-gray-200 border border-gray-600 rounded">
        {keys}
      </kbd>
    </div>
  )
}

export default function EditorShortcutsDialog({ onClose }: EditorShortcutsDialogProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="editor-shortcuts-title"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="p-6 space-y-5">
          <div>
            <h2 id="editor-shortcuts-title" className="text-lg font-semibold text-gray-100">
              Editor shortcuts
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Physical Layout canvas · Use ⌘ on Mac instead of Ctrl where shown
            </p>
          </div>

          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">General</h3>
            <div className="space-y-0 divide-y divide-gray-800">
              <ShortcutRow keys="Ctrl+Z" description="Undo" />
              <ShortcutRow keys="Ctrl+Shift+Z or Ctrl+Y" description="Redo" />
              <ShortcutRow keys="F" description="Fit view to monitors" />
              <ShortcutRow keys="A" description="Align Assist (toggle)" />
              <ShortcutRow keys="S" description="Size image to fit" />
              <ShortcutRow keys="Escape" description="Deselect monitor/image or cancel eyedropper" />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Canvas actions</h3>
            <div className="space-y-0 divide-y divide-gray-800">
              <ShortcutRow keys="Ctrl+Alt+M" description="Clear all monitors" />
              <ShortcutRow keys="Ctrl+Alt+I" description="Remove image" />
              <ShortcutRow keys="Ctrl+Alt+R" description="Reset canvas" />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Destructive actions use Ctrl+Alt+… to avoid conflicts (e.g. Ctrl+I = Italic; Ctrl+Shift+R = browser reload).
            </p>
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Nudge (monitor or image)</h3>
            <p className="text-xs text-gray-400 mb-2">
              With a monitor or the image selected, move it in physical space.
            </p>
            <div className="space-y-0 divide-y divide-gray-800">
              <ShortcutRow keys="Arrow keys" description="Nudge 0.1″" />
              <ShortcutRow keys="Shift+Arrow" description="Nudge 1″" />
              <ShortcutRow keys="Ctrl+Arrow" description="Nudge 5″" />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Delete</h3>
            <div className="space-y-0 divide-y divide-gray-800">
              <ShortcutRow keys="Delete or Backspace" description="Remove selected monitor, or remove image when image is selected" />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Canvas</h3>
            <div className="space-y-0 divide-y divide-gray-800">
              <ShortcutRow keys="Scroll" description="Pan" />
              <ShortcutRow keys="Ctrl+Scroll" description="Zoom toward pointer" />
              <ShortcutRow keys="Right-click + drag" description="Pan" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
