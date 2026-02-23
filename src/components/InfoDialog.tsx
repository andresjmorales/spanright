import { VIDEO_DEMO_URL } from '../appConstants'

interface InfoDialogProps {
  onClose: () => void
}

export default function InfoDialog({ onClose }: InfoDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors z-10"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              How Spanright Generates Your Wallpaper
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Understanding how the two layout tabs work together
            </p>
          </div>

          <p>
            <a
              href={VIDEO_DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 text-sm"
            >
              Watch a video demo
            </a>
          </p>

          {/* Step 1 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">One wide image, sized to your virtual layout</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Spanright generates a single wide image that covers your entire multi-monitor setup. On Windows, you apply it using <strong className="text-gray-300">Span</strong> mode; on other platforms you may need to crop per-monitor or use a wallpaper tool that supports spanning. Each monitor gets the correct slice of this image.
                </p>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">Your OS uses its own display arrangement</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Your operating system paints this image based on how your monitors are arranged in your display settings, starting from the top-left corner. The left-to-right order and vertical offsets determine which slice each monitor gets.
                </p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Spanright's output is the <strong className="text-gray-300">bounding box</strong> of that arrangement — the smallest rectangle that contains all your monitors. Side-by-side, stacked vertically, or any mix all work: the image size matches the virtual desktop your OS uses.
                </p>
              </div>
            </div>
          </section>

          {/* Virtual layout in detail: what it controls and why empty area doesn't show */}
          <section className="space-y-2 bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
            <h3 className="text-sm font-medium text-gray-200">Virtual layout in detail</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your OS display arrangement defines the <strong className="text-gray-300">virtual desktop</strong>: where the cursor and windows move between monitors. If one display is above the other, the cursor crosses at the shared top edge; side-by-side, at the vertical edge between them. Offsets change where that &quot;seam&quot; is. Matching the Virtual Layout tab to your OS ensures the output image lines up with how the OS will paint it.
            </p>
            <p className="text-xs text-gray-400 leading-relaxed mt-2">
              <strong className="text-gray-300">Why empty area doesn&apos;t show:</strong> The OS (Windows, macOS, Linux) paints the wallpaper from the top-left over that bounding box. Each monitor only displays the rectangle of the image at its position — so only pixels that fall inside a monitor&apos;s rectangle are ever shown on a screen. Gaps in the image (from different resolutions or vertical offsets) lie outside every monitor&apos;s rectangle, so no physical display ever shows them. You only see the parts that map to your actual monitors.
            </p>
          </section>

          {/* Illustration: Your desk → Your OS sees (same resolution = two identical rectangles) */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Your desk</div>
                <div className="relative w-32 h-16">
                  {/* 16:9 each — laptop smaller, monitor larger */}
                  <div className="absolute left-0 bottom-0 w-12 border border-cyan-500/60 bg-cyan-500/10 rounded-sm flex items-center justify-center" style={{ height: 27 }}>
                    <span className="text-[8px] text-cyan-400">Laptop</span>
                  </div>
                  <div className="absolute left-14 top-0 w-16 h-9 border border-blue-500/60 bg-blue-500/10 rounded-sm flex items-center justify-center">
                    <span className="text-[8px] text-blue-400">Monitor</span>
                  </div>
                </div>
              </div>

              <div className="text-gray-600 text-lg">&rarr;</div>

              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Your OS sees</div>
                <div className="flex gap-px items-stretch">
                  {/* Same 16:9 aspect ratio as desk rectangles; two identical (same resolution) */}
                  <div className="shrink-0 border border-cyan-500/60 bg-cyan-500/10 rounded-l-md rounded-r-sm flex items-center justify-center" style={{ width: 40, height: 22.5 }}>
                    <span className="text-[8px] text-cyan-400">1</span>
                  </div>
                  <div className="shrink-0 border border-blue-500/60 bg-blue-500/10 rounded-r-md rounded-l-sm flex items-center justify-center" style={{ width: 40, height: 22.5 }}>
                    <span className="text-[8px] text-blue-400">2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Illustration 2 (hidden — user will explain via YouTube): bounding box and empty area when resolutions/offsets differ */}
          {false && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 text-center">Different resolutions or offset → bounding box has empty area</div>
              <div className="flex justify-center">
                <div className="relative rounded" style={{ width: 112, height: 76 }}>
                  <div className="absolute inset-0 border-2 border-dashed border-amber-500/50 rounded" />
                  <div className="absolute left-0 top-0 border border-cyan-500/60 bg-cyan-500/10 rounded-tl flex items-center justify-center" style={{ width: 56, height: 56 }}>
                    <span className="text-[8px] text-cyan-400">1</span>
                  </div>
                  <div className="absolute left-[56px] top-5 border border-blue-500/60 bg-blue-500/10 rounded-tr flex items-center justify-center" style={{ width: 56, height: 56 }}>
                    <span className="text-[8px] text-blue-400">2</span>
                  </div>
                  <div className="absolute left-14 top-0 w-14 h-5 bg-gray-600/70 rounded-b flex items-center justify-center">
                    <span className="text-[7px] text-gray-400 leading-tight text-center">Empty area</span>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-gray-500 mt-2 text-center">Output image = full dashed box; each monitor only shows its rectangle. The gap is never displayed.</p>
            </div>
          )}

          {/* Step 3 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">Two layouts, one wallpaper</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  The <strong className="text-gray-300">Physical Layout</strong> tab controls what part of your image each monitor shows — based on real-world size and position on your desk. The <strong className="text-gray-300">Virtual Layout</strong> tab controls how the output image is stitched together — matching how your OS will paint it. On the Physical Layout canvas, <strong className="text-gray-300">right-click</strong> any monitor to rename, rotate, duplicate, delete, or set optional bezel borders (for alignment and real-world bezel compensation).
                </p>
              </div>
            </div>
          </section>

          {/* Step 4 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">4</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">You don't need to change your OS settings</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Just tell Spanright how your monitors are currently arranged in your OS display settings. If your arrangement roughly matches your physical layout with monitors top-aligned, you can skip this step entirely — the default "auto-aligned" option handles it.
                </p>
              </div>
            </div>
          </section>

          {/* How to check — platform-specific */}
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 space-y-3">
            <div className="text-xs font-medium text-gray-300">How to check your display arrangement (to replicate in the Virtual Layout tab):</div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Windows</div>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Open <strong className="text-gray-300">Settings &gt; System &gt; Display</strong></li>
                <li>Look at the monitor rectangles at the top of the page</li>
                <li>Note their left-to-right order and vertical positions</li>
                <li>Replicate that layout in the Virtual Layout tab</li>
              </ol>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">macOS</div>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Open <strong className="text-gray-300">System Settings &gt; Displays &gt; Arrange</strong></li>
                <li>Note the position of each display rectangle</li>
                <li>Replicate that layout in the Virtual Layout tab</li>
              </ol>
              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                Retina/HiDPI displays report logical pixels, not physical pixels. Use your display's actual pixel resolution (e.g. 2880&times;1800, not the scaled resolution) when adding monitors in Spanright.
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Linux</div>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Open your DE's display settings (<strong className="text-gray-300">GNOME Settings &gt; Displays</strong>, <strong className="text-gray-300">KDE System Settings &gt; Display</strong>, or use <strong className="text-gray-300">xrandr</strong>)</li>
                <li>Note the monitor positions and order</li>
                <li>Replicate that layout in the Virtual Layout tab</li>
              </ol>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 text-center">
            Having trouble with your wallpaper? Check the <strong className="text-gray-400">Troubleshooting</strong> guide in the header bar.
          </p>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
