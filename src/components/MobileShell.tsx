import { getLayoutFromHash } from '../urlLayout'
import type { LayoutEntry } from '../urlLayout'

const GITHUB_URL = 'https://github.com/andresjmorales/spanright'

function ReadOnlyLayoutSummary({ monitors }: { monitors: LayoutEntry[] }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 text-left">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Shared layout ({monitors.length} monitor{monitors.length !== 1 ? 's' : ''})
      </h3>
      <ul className="space-y-1.5 text-sm text-gray-200">
        {monitors.map((mon, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-gray-500">{mon.preset.resolutionX}×{mon.preset.resolutionY}</span>
            <span>{(mon.displayName?.trim() || '') || mon.preset.name}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 mt-2">
        Open on desktop to edit and export this layout.
      </p>
    </div>
  )
}

export default function MobileShell({
  onOpenFullEditor,
}: {
  onOpenFullEditor: () => void
}) {
  const layoutFromUrl = getLayoutFromHash()

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-950 text-gray-100">
      <div className="flex flex-col flex-1 p-6 max-w-md mx-auto w-full gap-6">
        <div className="text-center space-y-2">
          <img src="/spanright-logo-large.png" alt="" className="h-12 w-auto mx-auto" />
          <h1 className="text-xl font-bold text-gray-100">Spanright</h1>
          <p className="text-sm text-gray-400">
            Multi-Monitor Wallpaper Alignment Tool
          </p>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed text-center">
          Create pixel-perfect spanning wallpapers for non-standard multi-monitor setups.
          Arrange monitors in physical space, position your image, and export a stitched
          wallpaper that aligns correctly on Windows, macOS, and Linux.
        </p>

        {layoutFromUrl && layoutFromUrl.length > 0 && (
          <ReadOnlyLayoutSummary monitors={layoutFromUrl} />
        )}

        <div className="rounded-lg bg-amber-950/40 border border-amber-700/50 p-4 text-sm text-amber-100">
          <p className="font-medium mb-1">For the best experience</p>
          <p className="text-amber-200/90">
            Open Spanright on a desktop browser to build and edit layouts, upload images,
            and download your wallpaper.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            View on GitHub
          </a>
          <button
            type="button"
            onClick={onOpenFullEditor}
            className="w-full py-3 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 text-sm font-medium transition-colors"
          >
            Open full editor
          </button>
        </div>
      </div>
    </div>
  )
}
