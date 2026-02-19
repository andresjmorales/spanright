import { useState } from 'react'
import { useStore } from '../store'
import { buildShareUrl } from '../urlLayout'
import { useToast } from './Toast'

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

    const url = buildShareUrl(monitors)

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
      className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-default ${
        copied
          ? 'bg-green-600/20 text-green-400 border-green-500/50'
          : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
      }`}
      title={hasMonitors ? 'Copy shareable link to clipboard' : 'Add monitors to share'}
    >
      <span className="flex items-center gap-1.5">
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
        {copied ? 'Copied!' : 'Share Layout'}
      </span>
    </button>
  )
}
