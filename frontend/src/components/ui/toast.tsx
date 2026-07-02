import {
  useState,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface Toast {
  id: string
  message: string
  type?: 'default' | 'success' | 'warning' | 'danger'
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a <ToastContainer>')
  }
  return context
}

const typeStyles: Record<string, string> = {
  default: 'border-border',
  success: 'border-success/30',
  warning: 'border-warning/30',
  danger: 'border-danger/30',
}

export interface ToastContainerProps {
  children?: ReactNode
  className?: string
}

export function ToastContainer({ children, className }: ToastContainerProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50 flex flex-col gap-2',
            className,
          )}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'flex items-center gap-3 rounded-[var(--radius-lg)] border bg-bg-tertiary px-4 py-3 shadow-lg min-w-[280px] max-w-sm',
                typeStyles[toast.type ?? 'default'],
              )}
            >
              <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
