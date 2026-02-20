import { useState } from 'react'
import { useStore } from '../store'
import { buildShareUrl } from '../urlLayout'
import { useToast } from './Toast'
import { IconCheckSimple, IconShare } from '../icons'

export default function ShareButton() {
  const { state } = useStore()
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const hasMonitors = state.monitors.length > 0

  const handleShare = async () => {
    const monitors = state.monitors.map(m => ({
      preset: m.preset,
      physicalX: m.physicalX,
      physicalY: m.physicalY,
      rotation: m.rotation,
      displayName: m.displayName,
      bezels: m.bezels,
    }))

    const imagePosition = state.sourceImage
      ? {
          x: state.sourceImage.physicalX,
          y: state.sourceImage.physicalY,
          width: state.sourceImage.physicalWidth,
          height: state.sourceImage.physicalHeight,
          aspectRatio: state.sourceImage.naturalWidth / state.sourceImage.naturalHeight,
        }
      : null

    const url = buildShareUrl(monitors, imagePosition)

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Share link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — update the hash so the user can copy manually
      window.location.hash = url.split('#')[1] ?? ''
      toast('Share link set in URL — copy it from the address bar')
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={!hasMonitors}
      className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-default min-w-[7rem] justify-center ${
        copied
          ? 'bg-green-600/20 text-green-400 border-green-500/50'
          : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
      }`}
      title={hasMonitors ? 'Copy shareable link to clipboard' : 'Add monitors to share'}
    >
      <span className="flex items-center gap-1.5 justify-center">
        {copied ? <IconCheckSimple className="w-3.5 h-3.5" /> : <IconShare className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Share Layout'}
      </span>
    </button>
  )
}
