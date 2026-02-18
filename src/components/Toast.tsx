import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

type ToastVariant = 'info' | 'success' | 'warning'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  exiting?: boolean
}

interface ToastContextValue {
  toast: ((message: string, variant?: ToastVariant) => void) & {
    success: (message: string) => void
    warning: (message: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION = 2500
const EXIT_DURATION = 300

const variantStyles: Record<ToastVariant, string> = {
  info: 'border-gray-600',
  success: 'border-green-500/60',
  warning: 'border-amber-500/60',
}

const variantDot: Record<ToastVariant, string> = {
  info: 'bg-gray-400',
  success: 'bg-green-400',
  warning: 'bg-amber-400',
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border bg-gray-900/95 backdrop-blur shadow-lg text-sm text-gray-200 pointer-events-auto transition-all ${variantStyles[t.variant]} ${
        t.exiting
          ? 'animate-toast-exit'
          : 'animate-toast-enter'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variantDot[t.variant]}`} />
      <span className="flex-1 min-w-0">{t.message}</span>
      <button
        onClick={() => onDismiss(t.id)}
        className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors ml-1"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const existing = timersRef.current.get(id)
    if (existing) clearTimeout(existing)
    timersRef.current.delete(id)

    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, EXIT_DURATION)
  }, [])

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, variant }])

    const timer = setTimeout(() => dismiss(id), DURATION)
    timersRef.current.set(id, timer)
  }, [dismiss])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t))
    }
  }, [])

  const toastFn = useCallback(
    Object.assign(
      (message: string, variant?: ToastVariant) => addToast(message, variant),
      {
        success: (message: string) => addToast(message, 'success'),
        warning: (message: string) => addToast(message, 'warning'),
      }
    ),
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toast: toastFn }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
