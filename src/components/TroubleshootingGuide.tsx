import { useState } from 'react'

interface TroubleshootingGuideProps {
  onClose: () => void
}

function AccordionSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-700/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/40 hover:bg-gray-800/70 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-200">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-3 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-gray-700/40 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

export default function TroubleshootingGuide({ onClose }: TroubleshootingGuideProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Content */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 my-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors z-10"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Hero / Intro */}
          <div>
            <h2 className="text-xl font-bold text-gray-100">
              Troubleshooting Guide
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Getting your wallpaper to display perfectly across all your monitors.
            </p>
          </div>

          {/* Priority Tip Callout */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-blue-300">
                If Span isn't working, try Tile
              </h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Your wallpaper is designed for Windows <strong className="text-blue-300">Span</strong> mode, and that should work perfectly in most setups. But if you're seeing stretching, bleed, or misalignment, try switching to <strong className="text-blue-300">Tile</strong> instead: right-click your desktop &gt; Personalize &gt; Background, and change the fit mode.
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-gray-300">Why does this help?</strong> Span mode scales your image to fit the Windows virtual desktop bounding box. If any monitor is even a few pixels offset in your display arrangement, Windows will stretch the image to compensate, causing visible bleed. Tile mode places the image at exact 1:1 pixel scale with no resizing, bypassing the issue entirely.
            </p>
          </div>

          {/* Accordion Sections */}
          <div className="space-y-2">

            {/* Section: Virtual Desktop Misalignment */}
            <AccordionSection title="I see a few pixels of overflow/bleed between monitors">
              <p className="text-sm text-gray-300 leading-relaxed">
                This usually means your Windows display arrangement has a small vertical offset. Even a few pixels will cause Windows to scale your wallpaper.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                To check, open PowerShell and run:
              </p>
              <div className="bg-gray-950 border border-gray-700 rounded-md p-3 font-mono text-xs text-gray-300 overflow-x-auto">
                <div>Add-Type -AssemblyName System.Windows.Forms</div>
                <div>[System.Windows.Forms.SystemInformation]::VirtualScreen</div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Look at the <strong className="text-gray-100">Y</strong> and <strong className="text-gray-100">Height</strong> values. If Y is anything other than 0, or Height is larger than your tallest monitor's vertical resolution, one of your monitors is offset.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                <strong className="text-gray-100">To fix:</strong> Open Settings &gt; System &gt; Display. Carefully drag your monitors so they're perfectly aligned. The snap behavior can sometimes leave a few pixels of offset — zoom in and adjust carefully. Then re-run the PowerShell command to verify.
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                If you'd rather not adjust your display arrangement (since it affects cursor movement between screens), just use <strong className="text-gray-300">Tile</strong> mode instead of Span, which bypasses this issue entirely.
              </p>
            </AccordionSection>

            {/* Section: Display Scaling */}
            <AccordionSection title="My wallpaper looks slightly zoomed in or shifted">
              <p className="text-sm text-gray-300 leading-relaxed">
                Check that all your monitors are set to <strong className="text-gray-100">100% scaling</strong>. Open Settings &gt; System &gt; Display, click on each monitor individually, and verify the Scale setting.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                If you need to run a monitor at higher than 100% scaling (common on high-DPI laptops), be aware that Windows may factor this into the span calculation differently. In this case, <strong className="text-gray-100">Tile mode is strongly recommended</strong> over Span.
              </p>
            </AccordionSection>

            {/* Section: Verifying Output */}
            <AccordionSection title="How do I verify my wallpaper dimensions are correct?">
              <p className="text-sm text-gray-300 leading-relaxed">
                Right-click your downloaded wallpaper file &gt; Properties &gt; Details tab. Check the <strong className="text-gray-100">Width</strong> and <strong className="text-gray-100">Height</strong> values.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Your image width should equal the sum of all your monitors' horizontal resolutions. For example: 1920 + 1920 + 2560 = 6400px wide.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Your image height should equal the tallest monitor's vertical resolution (plus any vertical offset if your monitors aren't top-aligned in the Windows arrangement).
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                If these numbers don't match, go back to Spanright and verify your monitor resolutions are entered correctly.
              </p>
            </AccordionSection>

            {/* Section: Diagnostic Test */}
            <AccordionSection title="I want to test if my setup is aligned correctly">
              <p className="text-sm text-gray-300 leading-relaxed">
                Try creating a simple test wallpaper to diagnose alignment issues:
              </p>
              <ol className="text-sm text-gray-300 leading-relaxed list-decimal list-inside space-y-1.5 ml-1">
                <li>In Spanright, set up your monitor layout as usual.</li>
                <li>Use a test image with a grid pattern or clearly marked regions — or just use a solid color with distinct colored blocks where each monitor boundary should be.</li>
                <li>Apply the wallpaper using <strong className="text-gray-100">Tile</strong> mode.</li>
                <li>Check each monitor: do the boundaries line up exactly at the screen edges? If you see part of the next monitor's section bleeding over, your Windows display arrangement may have a small offset (see the "Virtual Desktop Misalignment" section above).</li>
              </ol>
            </AccordionSection>

            {/* Section: Monitor Order Mismatch */}
            <AccordionSection title="The wallpaper sections appear on the wrong monitors">
              <p className="text-sm text-gray-300 leading-relaxed">
                Spanright stitches the wallpaper left-to-right based on the physical layout you've built. Windows applies it left-to-right based on your display arrangement in Settings &gt; Display.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                If these orders don't match, the wallpaper sections will appear on the wrong screens.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                <strong className="text-gray-100">To fix:</strong> Open Settings &gt; System &gt; Display and make sure your monitors are arranged in the same left-to-right order as your Spanright layout. You can drag monitors to reorder them. Click <strong className="text-gray-100">"Identify"</strong> to see which number corresponds to which physical screen.
              </p>
            </AccordionSection>

          </div>

          {/* Footer */}
          <button
            onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
