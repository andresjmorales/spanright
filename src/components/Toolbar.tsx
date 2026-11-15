import { useStore, getFocusImage } from '../store'
import { getRecommendedImageSize, getMonitorsBoundingBox, formatDimension, getSourceImagePixelSize, getImageDensityRatio } from '../utils'
import ImageUpload from './ImageUpload'
import ConfigManager from './ConfigManager'
import ShareButton from './ShareButton'

export default function Toolbar() {
  const { state } = useStore()

  const recommended = getRecommendedImageSize(state.monitors)
  const bbox = getMonitorsBoundingBox(state.monitors)
  const hasMonitors = state.monitors.length > 0
  const hasImage = state.images.length > 0
  const focusImage = getFocusImage(state)

  // Check if image is undersized.
  // One image: compare against the recommended size for the whole layout (it is meant to span it all).
  // Several layers: a layer may cover only some monitors, so compare the selected layer's pixel
  // density (as placed) against the sharpest monitor it overlaps.
  let imageSizeStatus: 'ok' | 'warn' | 'error' | null = null
  const rate = (ratio: number) => (ratio >= 1 ? 'ok' : ratio >= 0.7 ? 'warn' : 'error')
  if (hasImage && hasMonitors && state.images.length === 1) {
    const img = getSourceImagePixelSize(state.images[0])
    imageSizeStatus = rate(Math.min(img.width / recommended.width, img.height / recommended.height))
  } else if (focusImage && hasMonitors) {
    const ratio = getImageDensityRatio(focusImage, state.monitors)
    // Small tolerance so a layer sized exactly to a monitor's native resolution reads as correct
    imageSizeStatus = ratio === null ? null : rate(ratio + 0.005)
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-3 sm:px-4 py-2 sm:py-0 min-h-[4.5rem] sm:min-h-0 sm:h-11 flex items-center gap-2 sm:gap-4 flex-wrap">
      {/* Image upload / image details — leftmost */}
      <ImageUpload />

      {/* Monitor count and recommended (related — em dash, no extra spacer) */}
      {hasMonitors && (
        <>
          <div className="w-px h-5 bg-gray-700" />
          <div className="text-xs text-gray-400 min-w-0 overflow-hidden text-ellipsis">
            <span className="hidden md:inline">
              {state.monitors.length} monitor{state.monitors.length > 1 ? 's' : ''}{' '}
              {formatDimension(bbox.width, state.unit)}×{formatDimension(bbox.height, state.unit)} layout ·{' '}
            </span>
            <span className="text-gray-500">Rec:</span>{' '}
            <span className="font-mono text-gray-300">
              {recommended.width}×{recommended.height} px
            </span>
            {hasImage && imageSizeStatus && (
              <span className={`font-mono ml-1 ${
                imageSizeStatus === 'ok' ? 'text-green-400' :
                imageSizeStatus === 'warn' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {state.images.length > 1 && <span className="text-gray-500">Selected: </span>}
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
