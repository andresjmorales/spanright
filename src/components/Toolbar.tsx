import { useStore } from '../store'
import { getRecommendedImageSize, getMonitorsBoundingBox, formatDimension } from '../utils'
import ImageUpload from './ImageUpload'
import ConfigManager from './ConfigManager'

export default function Toolbar() {
  const { state, dispatch } = useStore()

  const recommended = getRecommendedImageSize(state.monitors)
  const bbox = getMonitorsBoundingBox(state.monitors)
  const hasMonitors = state.monitors.length > 0
  const hasImage = !!state.sourceImage

  // Check if image is undersized
  let imageSizeStatus: 'ok' | 'warn' | 'error' | null = null
  if (hasImage && hasMonitors) {
    const img = state.sourceImage!
    if (img.naturalWidth >= recommended.width && img.naturalHeight >= recommended.height) {
      imageSizeStatus = 'ok'
    } else if (img.naturalWidth >= recommended.width * 0.7 && img.naturalHeight >= recommended.height * 0.7) {
      imageSizeStatus = 'warn'
    } else {
      imageSizeStatus = 'error'
    }
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-4 flex-wrap">
      {/* Image upload */}
      <ImageUpload />

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Unit toggle — hidden for now, cm support kept in backend */}

      {/* Config manager */}
      <ConfigManager />

      {/* Snap toggle */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_SNAP' })}
        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
          state.snapToGrid
            ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
            : 'bg-gray-800 text-gray-500 border-gray-700'
        }`}
      >
        Snap to Grid
      </button>

      {/* Monitor count */}
      {hasMonitors && (
        <>
          <div className="w-px h-6 bg-gray-700" />
          <div className="text-xs text-gray-400">
            {state.monitors.length} monitor{state.monitors.length > 1 ? 's' : ''}{' '}
            &middot; {formatDimension(bbox.width, state.unit)} x {formatDimension(bbox.height, state.unit)} layout
          </div>
        </>
      )}

      {/* Recommended image size */}
      {hasMonitors && (
        <>
          <div className="w-px h-6 bg-gray-700" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Recommended:</span>
            <span className="text-xs text-gray-300 font-mono">
              {recommended.width} x {recommended.height} px
            </span>
            {hasImage && imageSizeStatus && (
              <span className={`text-xs font-mono ${
                imageSizeStatus === 'ok' ? 'text-green-400' :
                imageSizeStatus === 'warn' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                (Your image: {state.sourceImage!.naturalWidth} x {state.sourceImage!.naturalHeight})
                {imageSizeStatus === 'ok' && ' ✓'}
                {imageSizeStatus === 'warn' && ' ⚠ Slightly undersized'}
                {imageSizeStatus === 'error' && ' ✗ Undersized'}
              </span>
            )}
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  )
}
