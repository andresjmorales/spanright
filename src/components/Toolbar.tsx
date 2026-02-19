import { useStore } from '../store'
import { getRecommendedImageSize, getMonitorsBoundingBox, formatDimension } from '../utils'
import ImageUpload from './ImageUpload'
import ConfigManager from './ConfigManager'
import ShareButton from './ShareButton'

export default function Toolbar() {
  const { state } = useStore()

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
    <div className="bg-gray-900 border-b border-gray-800 px-4 h-11 flex items-center gap-4 flex-wrap">
      {/* Image upload / image details — leftmost */}
      <ImageUpload />

      {/* Monitor count and recommended (related — em dash, no extra spacer) */}
      {hasMonitors && (
        <>
          <div className="w-px h-5 bg-gray-700" />
          <div className="text-xs text-gray-400">
            {state.monitors.length} monitor{state.monitors.length > 1 ? 's' : ''}{' '}
            {formatDimension(bbox.width, state.unit)} x {formatDimension(bbox.height, state.unit)} layout
            {' — '}
            <span className="text-gray-500">Recommended:</span>{' '}
            <span className="font-mono text-gray-300">
              {recommended.width} x {recommended.height} px
            </span>
            {hasImage && imageSizeStatus && (
              <span className={`font-mono ml-1 ${
                imageSizeStatus === 'ok' ? 'text-green-400' :
                imageSizeStatus === 'warn' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {imageSizeStatus === 'ok' && '✓ Correct size'}
                {imageSizeStatus === 'warn' && '⚠ Slightly undersized'}
                {imageSizeStatus === 'error' && '✗ Undersized'}
              </span>
            )}
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      <div className="w-px h-5 bg-gray-700" />
      {/* Saved Layouts — right side, left of Share */}
      <ConfigManager />

      {/* Share layout */}
      <ShareButton />
    </div>
  )
}
