import { useState } from 'react'

interface TroubleshootingGuideProps {
  onClose: () => void
}

type Platform = 'windows' | 'macos' | 'linux'

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

function PlatformTabs({ active, onChange }: { active: Platform; onChange: (p: Platform) => void }) {
  const tabs: { id: Platform; label: string }[] = [
    { id: 'windows', label: 'Windows' },
    { id: 'macos', label: 'macOS' },
    { id: 'linux', label: 'Linux' },
  ]
  return (
    <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
            active === t.id
              ? 'bg-gray-700 text-gray-100'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/60'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function WindowsContent() {
  return (
    <>
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
          <strong className="text-gray-300">Why does this help?</strong> Span mode scales your image to fit the Windows virtual desktop bounding box — the exterior rectangle that contains your entire display setup (side-by-side, stacked vertical, or mixed). If any monitor is even a few pixels offset, Windows will stretch the image to compensate, causing visible bleed. Tile mode places the image at exact 1:1 pixel scale with no resizing, bypassing the issue entirely.
        </p>
      </div>

      <div className="space-y-2">
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

        <AccordionSection title="My wallpaper looks slightly zoomed in or shifted">
          <p className="text-sm text-gray-300 leading-relaxed">
            Check that all your monitors are set to <strong className="text-gray-100">100% scaling</strong>. Open Settings &gt; System &gt; Display, click on each monitor individually, and verify the Scale setting.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            If you need to run a monitor at higher than 100% scaling (common on high-DPI laptops), be aware that Windows may factor this into the span calculation differently. In this case, <strong className="text-gray-100">Tile mode is strongly recommended</strong> over Span.
          </p>
        </AccordionSection>

        <AccordionSection title="How do I verify my wallpaper dimensions are correct?">
          <p className="text-sm text-gray-300 leading-relaxed">
            Right-click your downloaded wallpaper file &gt; Properties &gt; Details tab. Check the <strong className="text-gray-100">Width</strong> and <strong className="text-gray-100">Height</strong> values.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            Your image dimensions match the <strong className="text-gray-100">bounding box</strong> of your Windows arrangement: the smallest rectangle that contains every monitor. Width = horizontal extent (e.g. two 1920×1080 side-by-side → 3840px; stacked vertically → 1920px). Height = vertical extent (e.g. stacked → 2160px). So the image is exactly the size Windows expects for the virtual desktop.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            If these numbers don't match, go back to Spanright and verify your monitor resolutions are entered correctly.
          </p>
        </AccordionSection>

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

        <AccordionSection title="The wallpaper sections appear on the wrong monitors">
          <p className="text-sm text-gray-300 leading-relaxed">
            Spanright's output matches the bounding box of your Windows arrangement (positions and order). Windows applies that same image based on your display arrangement in Settings &gt; Display — so the layout there (left-to-right, top-to-bottom, or mixed) must match what you set in the Virtual Layout tab.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            If these orders don't match, the wallpaper sections will appear on the wrong screens.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            <strong className="text-gray-100">To fix:</strong> Open Settings &gt; System &gt; Display and make sure your monitors are arranged in the same left-to-right order as your Spanright layout. You can drag monitors to reorder them. Click <strong className="text-gray-100">"Identify"</strong> to see which number corresponds to which physical screen.
          </p>
        </AccordionSection>
      </div>
    </>
  )
}

function MacOSContent() {
  return (
    <>
      {/* Priority Tip Callout */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-blue-300">
            macOS has no native Span mode
          </h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          Unlike Windows, macOS doesn't support setting a single image across all displays. You'll need to crop each monitor's region from the Spanright output and set them individually, or use a third-party wallpaper tool that supports multi-monitor spanning.
        </p>
      </div>

      <div className="space-y-2">
        <AccordionSection title="How do I find my display arrangement?">
          <p className="text-sm text-gray-300 leading-relaxed">
            Open <strong className="text-gray-100">System Settings &gt; Displays</strong>, then click <strong className="text-gray-100">Arrange</strong> (or look for the arrangement area showing display rectangles). Drag displays to match your physical layout.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            The arrangement here determines how your cursor moves between screens and how macOS maps coordinates across displays. Replicate this layout in Spanright's Virtual Layout tab.
          </p>
        </AccordionSection>

        <AccordionSection title="Retina / HiDPI displays and resolution">
          <p className="text-sm text-gray-300 leading-relaxed">
            Retina displays report <strong className="text-gray-100">logical pixels</strong> to most apps (e.g. a Retina MacBook may report as 1440×900 while the actual panel is 2880×1800). When adding monitors in Spanright, use the <strong className="text-gray-100">actual hardware pixel resolution</strong>, not the scaled/logical resolution.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            To find your actual resolution: open <strong className="text-gray-100">System Settings &gt; Displays</strong> and hold <strong className="text-gray-100">Option</strong> while clicking a scaling option to see the native resolution, or check <strong className="text-gray-100">About This Mac &gt; Displays</strong>.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Using the logical resolution instead of the actual resolution will produce a wallpaper that's too small and appears blurry on Retina screens.
          </p>
        </AccordionSection>

        <AccordionSection title="How do I set the wallpaper from Spanright's output?">
          <p className="text-sm text-gray-300 leading-relaxed">
            Since macOS sets wallpapers per-display, you'll need to crop the Spanright output for each monitor:
          </p>
          <ol className="text-sm text-gray-300 leading-relaxed list-decimal list-inside space-y-1.5 ml-1">
            <li>Open the downloaded image in <strong className="text-gray-100">Preview</strong> or an image editor.</li>
            <li>For each monitor, crop the region matching that monitor's position and resolution in the output image.</li>
            <li>Open <strong className="text-gray-100">System Settings &gt; Wallpaper</strong> (or right-click desktop &gt; Change Wallpaper).</li>
            <li>Click on each display in the wallpaper settings and assign its cropped image.</li>
          </ol>
          <p className="text-xs text-gray-400 leading-relaxed">
            Third-party tools like <strong className="text-gray-300">Multi Monitor Wallpaper</strong> or <strong className="text-gray-300">Display Maid</strong> can automate this process.
          </p>
        </AccordionSection>

        <AccordionSection title="The wallpaper looks blurry on one or more displays">
          <p className="text-sm text-gray-300 leading-relaxed">
            This is usually a Retina resolution mismatch. Make sure your Spanright monitor definitions use the <strong className="text-gray-100">actual hardware pixel resolution</strong>, not the scaled resolution macOS reports. A Retina display at "looks like 1440×900" is actually 2880×1800 — use the latter.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            Also check that your source image is large enough — Spanright shows a recommended resolution banner in the toolbar.
          </p>
        </AccordionSection>
      </div>
    </>
  )
}

function LinuxContent() {
  return (
    <>
      {/* Priority Tip Callout */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-blue-300">
            Wallpaper handling varies by desktop environment
          </h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          Linux has no single standard for multi-monitor wallpapers. Some desktop environments (like GNOME) support spanning a single image across displays, while others require per-monitor wallpapers or external tools. The exact steps depend on your DE and display server (X11 vs Wayland).
        </p>
      </div>

      <div className="space-y-2">
        <AccordionSection title="How do I find my display arrangement?">
          <p className="text-sm text-gray-300 leading-relaxed">
            This depends on your desktop environment:
          </p>
          <ul className="text-sm text-gray-300 leading-relaxed list-disc list-inside space-y-1.5 ml-1">
            <li><strong className="text-gray-100">GNOME:</strong> Open <strong className="text-gray-100">Settings &gt; Displays</strong>. Drag the display rectangles to arrange them.</li>
            <li><strong className="text-gray-100">KDE Plasma:</strong> Open <strong className="text-gray-100">System Settings &gt; Display and Monitor &gt; Display Configuration</strong>.</li>
            <li><strong className="text-gray-100">Command line:</strong> Use <code className="text-gray-300 bg-gray-800 px-1 rounded">xrandr --query</code> (X11) or <code className="text-gray-300 bg-gray-800 px-1 rounded">wlr-randr</code> (Wayland/wlroots) to see display positions.</li>
          </ul>
          <p className="text-sm text-gray-300 leading-relaxed">
            Replicate the arrangement you see in Spanright's Virtual Layout tab.
          </p>
        </AccordionSection>

        <AccordionSection title="How do I set the wallpaper from Spanright's output?">
          <p className="text-sm text-gray-300 leading-relaxed">
            Common methods for applying a spanned wallpaper:
          </p>
          <ul className="text-sm text-gray-300 leading-relaxed list-disc list-inside space-y-1.5 ml-1">
            <li><strong className="text-gray-100">GNOME:</strong> Use <code className="text-gray-300 bg-gray-800 px-1 rounded">gsettings set org.gnome.desktop.background picture-options 'spanned'</code> then set the image URI. Or use <strong className="text-gray-100">Settings &gt; Background</strong> and choose the image — GNOME 42+ supports "Span" in the background settings.</li>
            <li><strong className="text-gray-100">KDE Plasma:</strong> Right-click the desktop &gt; Configure Desktop &gt; Wallpaper. Some versions support spanning; you may need to set each monitor's portion individually.</li>
            <li><strong className="text-gray-100">feh (X11):</strong> <code className="text-gray-300 bg-gray-800 px-1 rounded">feh --bg-scale /path/to/wallpaper.png</code> will scale across your combined display area.</li>
            <li><strong className="text-gray-100">nitrogen (X11):</strong> Select the image and choose "Scaled" or "Zoomed" fitting.</li>
            <li><strong className="text-gray-100">swaybg (Wayland/Sway):</strong> <code className="text-gray-300 bg-gray-800 px-1 rounded">swaybg -i /path/to/wallpaper.png -m fill</code></li>
            <li><strong className="text-gray-100">Hyprpaper (Hyprland):</strong> Configure in <code className="text-gray-300 bg-gray-800 px-1 rounded">~/.config/hypr/hyprpaper.conf</code></li>
          </ul>
          <p className="text-xs text-gray-400 leading-relaxed">
            If your tool doesn't support spanning, crop per-monitor regions from the output (similar to the macOS approach) and set each monitor individually.
          </p>
        </AccordionSection>

        <AccordionSection title="HiDPI / fractional scaling issues">
          <p className="text-sm text-gray-300 leading-relaxed">
            If you use fractional scaling (e.g. 150% or 200%), your desktop environment may report a logical resolution that differs from the panel's native resolution. When adding monitors in Spanright, use the <strong className="text-gray-100">native hardware resolution</strong>.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            You can check your actual resolution with <code className="text-gray-300 bg-gray-800 px-1 rounded">xrandr --query</code> (look for the active mode, e.g. <code className="text-gray-300 bg-gray-800 px-1 rounded">2560x1440+0+0</code>) or <code className="text-gray-300 bg-gray-800 px-1 rounded">wlr-randr</code> on Wayland.
          </p>
        </AccordionSection>

        <AccordionSection title="The wallpaper doesn't align across monitors">
          <p className="text-sm text-gray-300 leading-relaxed">
            Verify that your Spanright Virtual Layout matches what your display server reports. On X11, run <code className="text-gray-300 bg-gray-800 px-1 rounded">xrandr --query</code> and check the position offsets (e.g. <code className="text-gray-300 bg-gray-800 px-1 rounded">2560x1440+1920+0</code> means the display is at x=1920, y=0).
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            Some wallpaper tools scale the image differently. Try different fit modes ("fill", "scale", "span") or switch tools to see which produces correct alignment.
          </p>
        </AccordionSection>
      </div>
    </>
  )
}

export default function TroubleshootingGuide({ onClose }: TroubleshootingGuideProps) {
  const [platform, setPlatform] = useState<Platform>('windows')

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

          {/* Platform Tabs */}
          <PlatformTabs active={platform} onChange={setPlatform} />

          {/* Platform-specific content */}
          {platform === 'windows' && <WindowsContent />}
          {platform === 'macos' && <MacOSContent />}
          {platform === 'linux' && <LinuxContent />}

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
