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
              How Windows Span Mode Works
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Understanding how Spanwright generates your wallpaper
            </p>
          </div>

          {/* Step 1 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">One wide image, stretched across all screens</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Spanwright generates a single wide image that Windows will stretch across all your monitors using <strong className="text-gray-300">Span</strong> mode. Each monitor gets a slice of this image.
                </p>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">Windows uses its own display arrangement</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Windows paints this image based on how your monitors are arranged in <strong className="text-gray-300">Settings &gt; Display</strong>, starting from the top-left corner. The left-to-right order and vertical offsets in Windows determine which slice each monitor gets.
                </p>
              </div>
            </div>
          </section>

          {/* Illustration placeholder */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-center gap-6">
              {/* Physical layout illustration */}
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Your desk</div>
                <div className="relative w-32 h-16">
                  <div className="absolute left-0 bottom-0 w-12 h-9 border border-cyan-500/60 bg-cyan-500/10 rounded-sm flex items-center justify-center">
                    <span className="text-[8px] text-cyan-400">Laptop</span>
                  </div>
                  <div className="absolute right-0 top-0 w-20 h-14 border border-blue-500/60 bg-blue-500/10 rounded-sm flex items-center justify-center">
                    <span className="text-[8px] text-blue-400">Monitor</span>
                  </div>
                </div>
              </div>

              <div className="text-gray-600 text-lg">&rarr;</div>

              {/* Windows arrangement illustration */}
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Windows sees</div>
                <div className="relative w-32 h-14">
                  <div className="absolute left-0 top-0 w-10 h-8 border border-cyan-500/60 bg-cyan-500/10 rounded-sm flex items-center justify-center">
                    <span className="text-[8px] text-cyan-400">1</span>
                  </div>
                  <div className="absolute right-0 top-0 w-18 h-12 border border-blue-500/60 bg-blue-500/10 rounded-sm flex items-center justify-center" style={{ width: '72px', height: '48px', right: '0' }}>
                    <span className="text-[8px] text-blue-400">2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">Two layouts, one wallpaper</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  The <strong className="text-gray-300">Physical Layout</strong> tab controls what part of your image each monitor shows — based on real-world size and position on your desk. The <strong className="text-gray-300">Windows Arrangement</strong> tab controls how the output image is stitched together — matching how Windows will paint it.
                </p>
              </div>
            </div>
          </section>

          {/* Step 4 */}
          <section className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">4</span>
              <div>
                <h3 className="text-sm font-medium text-gray-200">You don't need to change Windows settings</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Just tell Spanwright how your monitors are currently arranged in Windows. If your Windows arrangement roughly matches your physical layout with monitors top-aligned, you can skip this step entirely — the default "auto-aligned" option handles it.
                </p>
              </div>
            </div>
          </section>

          {/* How to check */}
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 space-y-1.5">
            <div className="text-xs font-medium text-gray-300">How to check your Windows arrangement:</div>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Open <strong className="text-gray-300">Settings &gt; System &gt; Display</strong></li>
              <li>Look at the monitor rectangles at the top of the page</li>
              <li>Note their left-to-right order and vertical positions</li>
              <li>Replicate that layout in the Windows Arrangement tab</li>
            </ol>
          </div>

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
